/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setCachedAccessToken,
} from './services/auth';
import {
  DriveFile,
  listDriveFiles,
  listAllFilesRecursively,
} from './services/drive';
import {
  pickLocalDirectory,
  getStoredDirectoryHandle,
  clearStoredDirectoryHandle,
  checkStoredPermission,
  verifyPermission,
  getOrCreateSubdirectory,
  saveFallbackFolderName,
  getFallbackFolderName,
  clearFallbackFolder,
  isFileSystemAccessSupported,
  isInsideIframe,
} from './services/localFileSystem';
import {
  downloadManager,
  DownloadTask,
  SpeedTelemetry,
} from './services/downloadManager';
import {
  syncEngine,
  WatchedItem,
  SyncEngineState,
  SyncLogEntry,
} from './services/syncEngine';
import { exportSelectedFilesToZip, exportAllDriveToZip, ZipAllProgress } from './services/zipExport';
import {
  clearZipAllCheckpoint,
  getZipAllCheckpointSummary,
  ZipAllCheckpointSummary,
} from './services/zipCheckpoint';
import { generateUserGuidePDF } from './services/pdfGenerator';
import { ExecutionActivityModal } from './components/ExecutionActivityModal';
import { DownloadAllZipModal } from './components/DownloadAllZipModal';
import { ZipProgressModal } from './components/ZipProgressModal';

import { Header } from './components/Header';
import { FolderSelectorCard } from './components/FolderSelectorCard';
import { FolderModal } from './components/FolderModal';
import { SpeedEngineBar } from './components/SpeedEngineBar';
import { AutoSyncPanel } from './components/AutoSyncPanel';
import { DriveExplorer } from './components/DriveExplorer';
import { TransfersDrawer } from './components/TransfersDrawer';
import { CenterProgressOverlay } from './components/CenterProgressOverlay';
import { DownloadSuccessModal } from './components/DownloadSuccessModal';
import {
  Zap,
  Cloud,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Flame,
  CheckCircle,
  AlertCircle,
  FolderSync,
} from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [needsAuth, setNeedsAuth] = useState<boolean>(false);

  // Local folder state
  const [localDirHandle, setLocalDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [isSelectingFolder, setIsSelectingFolder] = useState<boolean>(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);
  const [isNativeDisk, setIsNativeDisk] = useState<boolean>(false);

  // Google Drive files & navigation
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'Meu Drive' },
  ]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Download Manager state
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [telemetry, setTelemetry] = useState<SpeedTelemetry>({
    currentSpeedBytes: 0,
    peakSpeedBytes: 0,
    totalDownloadedBytes: 0,
    activeCount: 0,
    queuedCount: 0,
    completedCount: 0,
    errorCount: 0,
    isPaused: false,
    hasActiveDownloads: false,
  });
  const [concurrency, setConcurrency] = useState<number>(downloadManager.getConcurrency());
  const [turboMultiChunk, setTurboMultiChunk] = useState<boolean>(
    downloadManager.isTurboMultiChunk()
  );

  // Sync Engine state
  const [syncState, setSyncState] = useState<SyncEngineState>({
    isActive: true,
    isChecking: false,
    intervalSeconds: 10,
    lastCheckTimestamp: null,
    watchedItems: [],
    recentLogs: [],
  });

  // Modal / Toast alerts
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState<boolean>(false);
  const [isDownloadAllModalOpen, setIsDownloadAllModalOpen] = useState<boolean>(false);
  const [isDownloadingAllZip, setIsDownloadingAllZip] = useState<boolean>(false);
  const [isCancellingDownloadAll, setIsCancellingDownloadAll] = useState<boolean>(false);
  const [savedZipCheckpoint, setSavedZipCheckpoint] = useState<ZipAllCheckpointSummary | null>(null);
  const [downloadAllProgress, setDownloadAllProgress] = useState<ZipAllProgress>({
    phase: 'scanning',
    percent: 0,
    currentItem: '',
    processedFiles: 0,
    totalFiles: 0,
    folderCount: 0,
    downloadedBytes: 0,
    totalBytesExpected: 0,
  });
  const downloadAllAbortRef = useRef<AbortController | null>(null);
  const [isZipModalOpen, setIsZipModalOpen] = useState<boolean>(false);
  const [isCancellingZip, setIsCancellingZip] = useState<boolean>(false);
  const [zipSelectedCount, setZipSelectedCount] = useState<number>(0);
  const [zipProgress, setZipProgress] = useState<ZipAllProgress>({
    phase: 'scanning',
    percent: 0,
    currentItem: '',
    processedFiles: 0,
    totalFiles: 0,
    folderCount: 0,
    downloadedBytes: 0,
    totalBytesExpected: 0,
  });
  const zipAbortRef = useRef<AbortController | null>(null);
  const downloadStartTimeRef = useRef<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasExplicitDownloadsChoiceRef = useRef<boolean>(false);
  const [downloadStats, setDownloadStats] = useState<{
    count: number;
    errorCount: number;
    folderCount: number;
    bytes: number;
    elapsedSeconds: number;
    averageSpeedBytes: number;
    peakSpeedBytes: number;
    isZip?: boolean;
  }>({
    count: 0,
    errorCount: 0,
    folderCount: 0,
    bytes: 0,
    elapsedSeconds: 0,
    averageSpeedBytes: 0,
    peakSpeedBytes: 0,
    isZip: false,
  });

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setFeedbackToast({ type, message });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => setFeedbackToast(null), 4000);
  }, []);

  // 1. Initialize Auth and restore stored folder handle
  useEffect(() => {
    const unsubscribeAuth = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setCachedAccessToken(accessToken);
        downloadManager.setAccessToken(accessToken);
        syncEngine.setAccessToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setCachedAccessToken(null);
        downloadManager.setAccessToken(null);
        syncEngine.setAccessToken(null);
        setNeedsAuth(true);
      }
    );

    // Try restoring directory handle from IndexedDB or fallback
    getStoredDirectoryHandle().then(async (handle) => {
      if (handle) {
        try {
          const permState = await checkStoredPermission(handle, true);
          if (permState !== 'denied') {
            setLocalDirHandle(handle);
            setLocalFolderName(handle.name);
            setIsNativeDisk(true);
            downloadManager.setTargetDirectory(handle);
            return;
          }
        } catch {
          // ignore
        }
      }
      // Check fallback folder
      const fallback = getFallbackFolderName();
      if (fallback) {
        setLocalFolderName(`Downloads / ${fallback}`);
        setIsNativeDisk(false);
      } else {
        // Automatically default to Downloads / DriveSync so user always has ready-to-go destination
        saveFallbackFolderName('DriveSync');
        setLocalFolderName('Downloads / DriveSync');
        setIsNativeDisk(false);
      }
    });

    // Subscribe to DownloadManager updates
    let previousActiveCount = 0;
    let previousCompletedCount = 0;
    let previousErrorCount = 0;
    let previousTotalBytes = 0;
    const unsubscribeDownloads = downloadManager.subscribe((updatedTasks, updatedTelemetry) => {
      setTasks([...updatedTasks]);
      setTelemetry({ ...updatedTelemetry });

      const allQueueFinished =
        previousActiveCount > 0 &&
        updatedTelemetry.activeCount === 0 &&
        updatedTelemetry.queuedCount === 0 &&
        !updatedTelemetry.isPaused &&
        (updatedTelemetry.completedCount > previousCompletedCount ||
          updatedTelemetry.errorCount > previousErrorCount);

      if (allQueueFinished) {
        const startTs = downloadStartTimeRef.current;
        const elapsed = startTs ? Math.max(0, Math.round((Date.now() - startTs) / 1000)) : 0;
        const batchCount = Math.max(0, updatedTelemetry.completedCount - previousCompletedCount);
        const batchErrors = Math.max(0, updatedTelemetry.errorCount - previousErrorCount);
        const batchBytes = Math.max(0, updatedTelemetry.totalDownloadedBytes - previousTotalBytes);
        const avgSpeed = batchBytes > 0 ? Math.round(batchBytes / Math.max(1, elapsed)) : 0;

        const uniqueFolders = new Set<string>();
        updatedTasks
          .filter((t) => t.status === 'completed')
          .slice(0, batchCount || 1)
          .forEach((t) => {
            if (t.pathSegments && t.pathSegments.length > 0) {
              uniqueFolders.add(t.pathSegments.join('/'));
            }
          });

        setDownloadStats({
          count: batchCount,
          errorCount: batchErrors,
          folderCount: Math.max(1, uniqueFolders.size),
          bytes: batchBytes,
          elapsedSeconds: elapsed,
          averageSpeedBytes: avgSpeed,
          peakSpeedBytes: updatedTelemetry.peakSpeedBytes,
          isZip: false,
        });
        downloadStartTimeRef.current = null;
        previousCompletedCount = updatedTelemetry.completedCount;
        previousErrorCount = updatedTelemetry.errorCount;
        previousTotalBytes = updatedTelemetry.totalDownloadedBytes;
        setIsSuccessModalOpen(true);
      } else if (updatedTelemetry.completedCount < previousCompletedCount) {
        // History was cleared
        previousCompletedCount = updatedTelemetry.completedCount;
        previousErrorCount = updatedTelemetry.errorCount;
        previousTotalBytes = updatedTelemetry.totalDownloadedBytes;
      }

      previousActiveCount = updatedTelemetry.activeCount;
    });

    // Subscribe to SyncEngine updates
    const unsubscribeSync = syncEngine.subscribe((updatedSyncState) => {
      setSyncState({ ...updatedSyncState });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDownloads();
      unsubscribeSync();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // 2. Fetch Drive files when token or folder changes
  const loadFiles = useCallback(
    async (folderId: string) => {
      if (!token) return;
      setIsLoadingFiles(true);
      try {
        const resp = await listDriveFiles(token, folderId);
        setFiles(resp.files);
        setSelectedFileIds(new Set());
      } catch (err: any) {
        console.error('Erro ao listar arquivos:', err);
        if (err?.status === 401) {
          setToken(null);
          setUser(null);
          setCachedAccessToken(null);
          downloadManager.setAccessToken(null);
          syncEngine.setAccessToken(null);
          setNeedsAuth(true);
          showToast('Sessão do Google Drive expirada. Conecte novamente.', 'error');
        } else {
          showToast(err?.message || 'Erro ao carregar arquivos do Drive.', 'error');
        }
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [token, showToast]
  );

  useEffect(() => {
    if (token) {
      loadFiles(currentFolderId);
    }
  }, [token, currentFolderId, loadFiles]);

  // Auth actions
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        downloadManager.setAccessToken(res.accessToken);
        syncEngine.setAccessToken(res.accessToken);
        setNeedsAuth(false);
        showToast('Google Drive conectado com sucesso!', 'success');
      }
    } catch (err: any) {
      console.error('Falha no login:', err);
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      let msg = 'Falha ao conectar conta Google. Verifique os popups e tente novamente.';
      if (err?.code === 'auth/popup-blocked') {
        msg = 'Popup bloqueado pelo navegador. Permita popups ou abra o app em nova aba.';
      } else if (err?.code === 'auth/unauthorized-domain') {
        msg = `Domínio "${currentHost}" não autorizado no Firebase Authentication. Adicione este domínio em Firebase Console > Authentication > Settings > Authorized domains.`;
      } else if (err?.message) {
        msg = err.message;
      }
      showToast(msg, 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setFiles([]);
    setNeedsAuth(true);
    showToast('Você desconectou da conta Google.', 'info');
  };

  // Local folder selection
  const handleSelectNativeFolder = async (): Promise<boolean> => {
    setIsSelectingFolder(true);
    try {
      const handle = await pickLocalDirectory();
      if (handle) {
        setLocalDirHandle(handle);
        setLocalFolderName(handle.name);
        setIsNativeDisk(true);
        downloadManager.setTargetDirectory(handle);
        showToast(`Pasta física "${handle.name}" vinculada para gravação direta!`, 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Erro ao selecionar pasta física:', err);
      return false;
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const handleSelectDownloadsFolder = (subfolder: string) => {
    hasExplicitDownloadsChoiceRef.current = true;
    saveFallbackFolderName(subfolder);
    clearStoredDirectoryHandle();
    setLocalDirHandle(null);
    setLocalFolderName(`Downloads / ${subfolder}`);
    setIsNativeDisk(false);
    downloadManager.setTargetDirectory(null);
    showToast(`Pasta configurada: Downloads/${subfolder} (Download direto)`, 'success');
  };

  const handleQuickSetDownloads = () => {
    handleSelectDownloadsFolder('DriveSync');
  };

  const handleClearLocalFolder = async () => {
    hasExplicitDownloadsChoiceRef.current = false;
    await clearStoredDirectoryHandle();
    clearFallbackFolder();
    setLocalDirHandle(null);
    setLocalFolderName(null);
    setIsNativeDisk(false);
    downloadManager.setTargetDirectory(null);
    showToast('Pasta local desvinculada.', 'info');
  };

  // Ensure local directory handle has active readwrite permission while user gesture is active
  const prepareDestinationDirectory = async (
    needsFolders: boolean
  ): Promise<{ handle: FileSystemDirectoryHandle | null; aborted: boolean }> => {
    if (localDirHandle) {
      const granted = await verifyPermission(localDirHandle, true);
      if (granted) {
        downloadManager.setTargetDirectory(localDirHandle);
        return { handle: localDirHandle, aborted: false };
      }
      downloadManager.setTargetDirectory(null);
      showToast('Permissão de gravação na pasta foi negada. Selecione a pasta novamente.', 'error');
      setIsFolderModalOpen(true);
      return { handle: null, aborted: true };
    }

    if ((window as any).electronAPI?.saveFileNative) {
      return { handle: null, aborted: false };
    }

    // Outside iframe, prompt native folder picker when downloading folders so real directories are created on disk
    if (needsFolders && !isInsideIframe() && isFileSystemAccessSupported() && !hasExplicitDownloadsChoiceRef.current) {
      try {
        const handle = await pickLocalDirectory();
        if (handle) {
          setLocalDirHandle(handle);
          setLocalFolderName(handle.name);
          setIsNativeDisk(true);
          downloadManager.setTargetDirectory(handle);
          showToast(`Pasta "${handle.name}" vinculada — criando pastas originais diretamente no disco!`, 'success');
          return { handle, aborted: false };
        }
        showToast('Selecione uma pasta no seu computador para criar as pastas originais no disco.', 'info');
        return { handle: null, aborted: true };
      } catch {
        // Fallback below if restricted
      }
    }

    // Inside iframe without native handle and without explicit fallback confirmation, guide user instead of silently dropping folders
    if (needsFolders && isInsideIframe() && !hasExplicitDownloadsChoiceRef.current) {
      setIsFolderModalOpen(true);
      showToast('Abra o app em nova aba para criar pastas reais no disco, ou confirme o modo Downloads.', 'info');
      return { handle: null, aborted: true };
    }

    if (!localDirHandle && !localFolderName) {
      handleQuickSetDownloads();
    }
    return { handle: null, aborted: false };
  };

  // Navigation
  const handleNavigateFolder = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
  };

  const handleNavigateBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentFolderId(target.id);
  };

  // Selection
  const handleToggleSelect = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (ids?: string[]) => {
    const targetIds = ids && ids.length > 0 ? ids : files.map((f) => f.id);
    setSelectedFileIds(new Set(targetIds));
  };

  const handleClearSelection = () => {
    setSelectedFileIds(new Set());
  };

  // Compute relative folder path from breadcrumbs to recreate the identical structure locally
  const getCurrentFolderPath = (): string[] => {
    return breadcrumbs.slice(1).map((b) => b.name);
  };

  // Download & Sync actions
  const handleStartDownload = async () => {
    if (!token) {
      showToast('Por favor, conecte sua conta Google Drive primeiro.', 'error');
      return;
    }

    // 1. If currently paused with pending tasks, resume them
    if (downloadManager.getIsPaused() && downloadManager.getPendingCount() > 0) {
      if (localDirHandle) {
        await verifyPermission(localDirHandle, true);
      }
      if (!downloadStartTimeRef.current) {
        downloadStartTimeRef.current = Date.now();
      }
      downloadManager.resume();
      showToast('Downloads retomados!', 'success');
      return;
    }

    // 2. If user has selected files, start downloading them
    if (selectedFileIds.size > 0) {
      await handleDownloadSelected();
      return;
    }

    // 3. If no files selected, download all files and folders currently displayed
    if (files.length > 0) {
      const currentFolderSegments = getCurrentFolderPath();
      const hasFoldersToCreate = currentFolderSegments.length > 0 || files.some((f) => f.isFolder);
      const { handle: activeDirHandle, aborted } = await prepareDestinationDirectory(hasFoldersToCreate);
      if (aborted) return;

      try {
        const visitedFolders: string[][] = [];
        const filesToEnqueue: { file: DriveFile; pathSegments: string[] }[] = [];

        if (currentFolderSegments.length > 0) {
          visitedFolders.push(currentFolderSegments);
        }

        for (const item of files) {
          if (item.isFolder) {
            const recursive = await listAllFilesRecursively(
              token,
              item.id,
              [...currentFolderSegments, item.name],
              new Set(),
              (segs) => visitedFolders.push(segs)
            );
            filesToEnqueue.push(...recursive);
          } else {
            filesToEnqueue.push({ file: item, pathSegments: currentFolderSegments });
          }
        }

        // Immediately recreate all original folders on disk (including empty folders)
        if (activeDirHandle && visitedFolders.length > 0) {
          for (const segs of visitedFolders) {
            try {
              await getOrCreateSubdirectory(activeDirHandle, segs);
            } catch {
              // ignore individual folder errors
            }
          }
        }

        if (filesToEnqueue.length > 0) {
          downloadStartTimeRef.current = Date.now();
          downloadManager.enqueueFiles(filesToEnqueue);
          showToast(
            activeDirHandle || (window as any).electronAPI?.saveFileNative
              ? `Iniciando download de ${filesToEnqueue.length} arquivo(s) recriando as mesmas pastas no disco!`
              : `Iniciando download de ${filesToEnqueue.length} arquivo(s)!`,
            'success'
          );
        } else if (activeDirHandle && visitedFolders.length > 0) {
          showToast('Pastas vazias recriadas com o nome original na pasta destino!', 'success');
        } else {
          showToast('Nenhum arquivo disponível para download.', 'info');
        }
      } catch (err: any) {
        console.error('Erro ao mapear arquivos para download:', err);
        showToast(err?.message || 'Erro ao preparar arquivos do Drive.', 'error');
      }
      return;
    }

    showToast('Nenhum arquivo disponível para download nesta pasta.', 'info');
  };

  const handleStopDownload = () => {
    downloadManager.pause();
    showToast('Download interrompido/pausado.', 'info');
  };

  const handleDownloadSelected = async () => {
    if (!token) return;
    const selectedItems = files.filter((f) => selectedFileIds.has(f.id));
    if (selectedItems.length === 0) return;

    const currentFolderSegments = getCurrentFolderPath();
    const hasFoldersToCreate = currentFolderSegments.length > 0 || selectedItems.some((f) => f.isFolder);
    const { handle: activeDirHandle, aborted } = await prepareDestinationDirectory(hasFoldersToCreate);
    if (aborted) return;

    try {
      const visitedFolders: string[][] = [];
      const filesToEnqueue: { file: DriveFile; pathSegments: string[] }[] = [];

      if (currentFolderSegments.length > 0) {
        visitedFolders.push(currentFolderSegments);
      }

      for (const item of selectedItems) {
        if (item.isFolder) {
          showToast(`Mapeando subpastas de "${item.name}"...`, 'info');
          const recursiveFiles = await listAllFilesRecursively(
            token,
            item.id,
            [...currentFolderSegments, item.name],
            new Set(),
            (segs) => visitedFolders.push(segs)
          );
          filesToEnqueue.push(...recursiveFiles);
        } else {
          filesToEnqueue.push({ file: item, pathSegments: currentFolderSegments });
        }
      }

      if (activeDirHandle && visitedFolders.length > 0) {
        for (const segs of visitedFolders) {
          try {
            await getOrCreateSubdirectory(activeDirHandle, segs);
          } catch {
            // ignore
          }
        }
      }

      if (filesToEnqueue.length > 0) {
        downloadStartTimeRef.current = Date.now();
        downloadManager.enqueueFiles(filesToEnqueue);
        showToast(
          activeDirHandle || (window as any).electronAPI?.saveFileNative
            ? `${filesToEnqueue.length} arquivo(s) enfileirados recriando a mesma estrutura de pastas no disco!`
            : `${filesToEnqueue.length} arquivo(s) enfileirados para download!`,
          'success'
        );
      } else if (activeDirHandle && visitedFolders.length > 0) {
        showToast('Pasta(s) vazia(s) criada(s) com o mesmo nome original na pasta destino!', 'success');
      } else {
        showToast('Nenhum arquivo encontrado nas pastas selecionadas.', 'info');
      }
    } catch (err: any) {
      console.error('Erro ao baixar selecionados:', err);
      showToast(err?.message || 'Erro ao preparar arquivos selecionados.', 'error');
    }
  };

  const handleDownloadSingle = async (file: DriveFile) => {
    if (!token) return;
    const currentFolderSegments = getCurrentFolderPath();
    const hasFoldersToCreate = currentFolderSegments.length > 0 || file.isFolder;
    const { handle: activeDirHandle, aborted } = await prepareDestinationDirectory(hasFoldersToCreate);
    if (aborted) return;

    try {
      if (file.isFolder) {
        showToast(`Mapeando pasta "${file.name}"...`, 'info');
        const visitedFolders: string[][] = [];
        const recursiveFiles = await listAllFilesRecursively(
          token,
          file.id,
          [...currentFolderSegments, file.name],
          new Set(),
          (segs) => visitedFolders.push(segs)
        );

        if (activeDirHandle && visitedFolders.length > 0) {
          for (const segs of visitedFolders) {
            try {
              await getOrCreateSubdirectory(activeDirHandle, segs);
            } catch {
              // ignore
            }
          }
        }

        if (recursiveFiles.length === 0) {
          showToast(
            activeDirHandle
              ? `Pasta vazia "${file.name}" criada na pasta destino!`
              : `A pasta "${file.name}" está vazia.`,
            'info'
          );
          return;
        }
        downloadStartTimeRef.current = Date.now();
        downloadManager.enqueueFiles(recursiveFiles);
        showToast(
          `Pasta "${file.name}" (${recursiveFiles.length} arquivos) enfileirada com estrutura idêntica!`,
          'success'
        );
      } else {
        if (activeDirHandle && currentFolderSegments.length > 0) {
          try {
            await getOrCreateSubdirectory(activeDirHandle, currentFolderSegments);
          } catch {
            // ignore
          }
        }
        downloadStartTimeRef.current = Date.now();
        downloadManager.enqueueFiles([{ file, pathSegments: currentFolderSegments }]);
        showToast(`Download de "${file.name}" iniciado!`, 'success');
      }
    } catch (err: any) {
      console.error('Erro ao baixar item:', err);
      showToast(err?.message || `Erro ao baixar "${file.name}".`, 'error');
    }
  };

  const handleWatchSelected = () => {
    const selectedItems = files.filter((f) => selectedFileIds.has(f.id));
    if (selectedItems.length === 0) return;

    selectedItems.forEach((item) => {
      syncEngine.watchItem(item);
    });

    showToast(
      `${selectedItems.length} item(ns) adicionados à sincronização automática em tempo real!`,
      'success'
    );
    setSelectedFileIds(new Set());
  };

  const handleToggleWatchSingle = (file: DriveFile) => {
    if (syncEngine.isItemWatched(file.id)) {
      syncEngine.unwatchItem(file.id);
      showToast(`"${file.name}" removido do monitoramento em tempo real.`, 'info');
    } else {
      syncEngine.watchItem(file);
      showToast(`"${file.name}" agora sincroniza automaticamente em tempo real!`, 'success');
    }
  };

  const handleDownloadZip = async () => {
    if (!token) return;
    const selectedItems = files.filter((f) => selectedFileIds.has(f.id));
    if (selectedItems.length === 0) return;

    const controller = new AbortController();
    zipAbortRef.current = controller;
    setIsCancellingZip(false);
    setZipSelectedCount(selectedItems.length);
    setZipProgress({
      phase: 'scanning',
      percent: 0,
      currentItem: 'Preparando itens selecionados...',
      processedFiles: 0,
      totalFiles: 0,
      folderCount: 0,
      downloadedBytes: 0,
      totalBytesExpected: 0,
    });
    setIsZipModalOpen(true);

    const startTime = Date.now();
    try {
      const zipStats = await exportSelectedFilesToZip(
        token,
        selectedItems,
        localDirHandle,
        (progress) => setZipProgress(progress),
        controller.signal,
        getCurrentFolderPath()
      );
      const elapsed = Math.max(0, Math.round((Date.now() - startTime) / 1000));
      const avgSpeed = zipStats.totalBytes > 0 ? Math.round(zipStats.totalBytes / Math.max(1, elapsed)) : 0;

      setIsZipModalOpen(false);
      setDownloadStats({
        count: zipStats.fileCount,
        errorCount: 0,
        folderCount: zipStats.folderCount,
        bytes: zipStats.totalBytes,
        elapsedSeconds: elapsed,
        averageSpeedBytes: avgSpeed,
        peakSpeedBytes: avgSpeed,
        isZip: true,
      });
      setIsSuccessModalOpen(true);
      showToast('Arquivo ZIP gerado com sucesso!', 'success');
    } catch (err: any) {
      setIsZipModalOpen(false);
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        showToast('Compactação ZIP cancelada pelo usuário.', 'info');
      } else {
        console.error('Erro ao gerar ZIP:', err);
        showToast(err?.message || 'Falha na criação do ZIP.', 'error');
      }
    } finally {
      setIsCancellingZip(false);
      zipAbortRef.current = null;
    }
  };

  const handleCancelZip = () => {
    if (zipAbortRef.current) {
      setIsCancellingZip(true);
      zipAbortRef.current.abort();
    } else {
      setIsZipModalOpen(false);
    }
  };

  const handleRequestDownloadAllZip = async () => {
    if (!token) {
      showToast('Por favor, conecte sua conta Google Drive primeiro.', 'error');
      return;
    }
    setIsCancellingDownloadAll(false);
    setDownloadAllProgress({
      phase: 'scanning',
      percent: 0,
      currentItem: '',
      processedFiles: 0,
      totalFiles: 0,
      folderCount: 0,
      downloadedBytes: 0,
      totalBytesExpected: 0,
    });
    const checkpoint = await getZipAllCheckpointSummary();
    setSavedZipCheckpoint(checkpoint);
    setIsDownloadAllModalOpen(true);
  };

  const runDownloadAllZip = async (resumeFromCheckpoint: boolean) => {
    if (!token) return;
    const controller = new AbortController();
    downloadAllAbortRef.current = controller;
    setIsCancellingDownloadAll(false);
    setSavedZipCheckpoint(null);
    setIsDownloadingAllZip(true);
    const startTime = Date.now();

    try {
      const zipStats = await exportAllDriveToZip(
        token,
        localDirHandle,
        (progress) => setDownloadAllProgress(progress),
        controller.signal,
        resumeFromCheckpoint
      );
      const elapsed = Math.max(0, Math.round((Date.now() - startTime) / 1000));
      const avgSpeed = zipStats.totalBytes > 0 ? Math.round(zipStats.totalBytes / Math.max(1, elapsed)) : 0;

      setIsDownloadAllModalOpen(false);
      setDownloadStats({
        count: zipStats.fileCount,
        errorCount: 0,
        folderCount: zipStats.folderCount,
        bytes: zipStats.totalBytes,
        elapsedSeconds: elapsed,
        averageSpeedBytes: avgSpeed,
        peakSpeedBytes: avgSpeed,
        isZip: true,
      });
      setIsSuccessModalOpen(true);
      showToast('Download completo do Google Drive em ZIP concluído!', 'success');
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        const checkpoint = await getZipAllCheckpointSummary();
        setSavedZipCheckpoint(checkpoint);
        showToast(
          checkpoint
            ? 'Operação cancelada. Progresso salvo na memória para continuar depois.'
            : 'Operação "Baixar Tudo" cancelada.',
          'info'
        );
      } else {
        console.error('Erro ao baixar todo o Drive em ZIP:', err);
        showToast(err?.message || 'Falha ao gerar o ZIP completo do Drive.', 'error');
      }
      setIsDownloadAllModalOpen(false);
    } finally {
      setIsDownloadingAllZip(false);
      setIsCancellingDownloadAll(false);
      downloadAllAbortRef.current = null;
    }
  };

  const handleConfirmFreshDownloadAllZip = () => {
    void runDownloadAllZip(false);
  };

  const handleResumeDownloadAllZip = () => {
    void runDownloadAllZip(true);
  };

  const handleDenyResumeAndStartFresh = async () => {
    await clearZipAllCheckpoint();
    setSavedZipCheckpoint(null);
    void runDownloadAllZip(false);
  };

  const handleCancelDownloadAllZip = () => {
    if (isDownloadingAllZip && downloadAllAbortRef.current) {
      setIsCancellingDownloadAll(true);
      downloadAllAbortRef.current.abort();
    } else {
      setIsDownloadAllModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500/30 selection:text-orange-200">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-in slide-in-from-top-4 duration-300">
          <div
            className={`flex items-start sm:items-center space-x-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold border break-words ${
              feedbackToast.type === 'success'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
                : feedbackToast.type === 'error'
                ? 'bg-rose-950 text-rose-200 border-rose-800'
                : 'bg-slate-900 text-slate-200 border-slate-700'
            }`}
          >
            {feedbackToast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />}
            {feedbackToast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />}
            {feedbackToast.type === 'info' && <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />}
            <span className="min-w-0">{feedbackToast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        user={user}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        localFolderName={localFolderName}
        currentSpeed={telemetry.currentSpeedBytes}
        peakSpeed={telemetry.peakSpeedBytes}
        concurrency={concurrency}
        isAutoSyncActive={syncState.isActive}
        onDownloadPDF={() => {
          generateUserGuidePDF();
          showToast('Guia de Funcionalidades em PDF gerado com sucesso!', 'success');
        }}
        onOpenExecutionModal={() => setIsExecutionModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Not Logged In Hero Banner */}
        {!user ? (
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-10 lg:p-12 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6 relative z-10">
              <div className="inline-flex items-center space-x-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold tracking-wide uppercase">
                <Flame className="w-4 h-4 shrink-0" />
                <span>Velocidade Máxima & Sincronização Direta</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Baixe e sincronize arquivos do Google Drive na sua pasta local com{' '}
                <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-rose-400 bg-clip-text text-transparent">
                  velocidade extrema
                </span>
                .
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Conecte seu Google Drive, escolha uma pasta no seu computador e mantenha seus
                documentos atualizados em tempo real com conexões multi-thread paralelas e gravação
                direta no disco.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full sm:w-auto flex items-center justify-center space-x-3 bg-white hover:bg-slate-100 text-slate-900 font-bold px-6 py-3.5 rounded-2xl text-sm transition-all shadow-xl shadow-white/10 active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>Conectar com Google Drive</span>
                </button>

                <button
                  onClick={() => setIsFolderModalOpen(true)}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-3.5 rounded-2xl text-sm border border-slate-700 transition-all"
                >
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                  <span>Configurar Pasta no Computador</span>
                </button>
              </div>

              {/* Feature pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-left border-t border-slate-800/80">
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center mb-2 font-bold">
                    <Flame className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">Aceleração Turbo até 16x</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Downloads simultâneos paralelos e divisão em múltiplos canais de rede para saturar
                    sua largura de banda.
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 font-bold">
                    <FolderSync className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">Sincronização em Tempo Real</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Monitore arquivos e pastas continuamente a cada 5s-10s. Qualquer alteração remota é
                    baixada instantaneamente.
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">Gravação Nativa no Disco</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Usa a moderna API File System Access para salvar direto na pasta do seu PC sem
                    inchar a memória do navegador.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Step 1: Local Folder Selector */}
            <FolderSelectorCard
              localFolderName={localFolderName}
              onOpenFolderModal={() => setIsFolderModalOpen(true)}
              onQuickSetDownloads={handleQuickSetDownloads}
              onClearFolder={handleClearLocalFolder}
              isNativeDisk={isNativeDisk}
            />

            {/* Step 2: Download Speed Engine & Concurrency Controls */}
            <SpeedEngineBar
              currentSpeed={telemetry.currentSpeedBytes}
              peakSpeed={telemetry.peakSpeedBytes}
              totalDownloaded={telemetry.totalDownloadedBytes}
              activeWorkers={telemetry.activeCount}
              concurrency={concurrency}
              onConcurrencyChange={(threads) => {
                setConcurrency(threads);
                downloadManager.setConcurrency(threads);
                showToast(`Modo ajustado para ${threads} conexões simultâneas.`, 'info');
              }}
              turboMultiChunk={turboMultiChunk}
              onToggleTurboMultiChunk={(enabled) => {
                setTurboMultiChunk(enabled);
                downloadManager.setTurboMultiChunk(enabled);
                showToast(
                  `Multi-Chunk para arquivos grandes ${enabled ? 'ativado' : 'desativado'}.`,
                  'info'
                );
              }}
              onStartDownload={handleStartDownload}
              onStopDownload={handleStopDownload}
              isDownloading={telemetry.hasActiveDownloads && !telemetry.isPaused}
              isPaused={telemetry.isPaused}
              hasPendingTasks={telemetry.activeCount > 0 || telemetry.queuedCount > 0}
            />

            {/* Step 3: Real-Time Automatic Synchronization Controls */}
            <AutoSyncPanel
              isActive={syncState.isActive}
              onToggleActive={() => syncEngine.setIsActive(!syncState.isActive)}
              intervalSeconds={syncState.intervalSeconds}
              onChangeInterval={(sec) => syncEngine.setInterval(sec)}
              isChecking={syncState.isChecking}
              lastCheckTimestamp={syncState.lastCheckTimestamp}
              onTriggerSync={() => {
                syncEngine.triggerImmediateSync();
                showToast('Verificando alterações no Google Drive agora...', 'info');
              }}
              watchedItems={syncState.watchedItems}
              onRemoveWatched={(id) => syncEngine.unwatchItem(id)}
              onClearAllWatched={() => syncEngine.clearAllWatched()}
              recentLogs={syncState.recentLogs}
            />

            {/* Step 4: Google Drive Files Explorer */}
            <DriveExplorer
              files={files}
              isLoading={isLoadingFiles}
              breadcrumbs={breadcrumbs}
              onNavigateFolder={handleNavigateFolder}
              onNavigateBreadcrumb={handleNavigateBreadcrumb}
              onRefresh={() => loadFiles(currentFolderId)}
              selectedFileIds={selectedFileIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              onDownloadSelected={handleDownloadSelected}
              onDownloadZip={handleDownloadZip}
              onWatchSelected={handleWatchSelected}
              onDownloadSingle={handleDownloadSingle}
              onToggleWatchSingle={handleToggleWatchSingle}
              isItemWatched={(id) => syncEngine.isItemWatched(id)}
              localFolderConfigured={!!localFolderName}
              concurrency={concurrency}
              onStartDownload={handleStartDownload}
              onStopDownload={handleStopDownload}
              onDownloadAllDriveZip={handleRequestDownloadAllZip}
              isDownloading={telemetry.hasActiveDownloads && !telemetry.isPaused}
              isPaused={telemetry.isPaused}
              hasPendingTasks={telemetry.activeCount > 0 || telemetry.queuedCount > 0}
            />
          </>
        )}
      </main>

      {/* Floating Active Transfers Drawer */}
      <TransfersDrawer
        tasks={tasks}
        telemetry={telemetry}
        onClearCompleted={() => downloadManager.clearCompleted()}
        onStartDownload={handleStartDownload}
        onStopDownload={handleStopDownload}
      />

      {/* Local Folder Configuration Modal */}
      <FolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        currentFolderName={localFolderName}
        onSelectNativeFolder={handleSelectNativeFolder}
        onSelectDownloadsFolder={handleSelectDownloadsFolder}
        isSelecting={isSelectingFolder}
      />

      {/* Prominent Center Progress Bar Overlay when downloading */}
      <CenterProgressOverlay
        tasks={tasks}
        telemetry={telemetry}
        onStopDownload={handleStopDownload}
        localFolderName={localFolderName}
        concurrency={concurrency}
      />

      {/* Download Success Confirmation Modal */}
      <DownloadSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        completedCount={downloadStats.count}
        errorCount={downloadStats.errorCount}
        folderCount={downloadStats.folderCount}
        totalBytes={downloadStats.bytes}
        elapsedSeconds={downloadStats.elapsedSeconds}
        averageSpeedBytes={downloadStats.averageSpeedBytes}
        peakSpeedBytes={downloadStats.peakSpeedBytes}
        folderName={localFolderName}
        dirHandle={localDirHandle}
        isZip={downloadStats.isZip}
        onOpenFolderPicker={() => setIsFolderModalOpen(true)}
      />

      {/* Execution & Activity Information Modal */}
      <ExecutionActivityModal
        isOpen={isExecutionModalOpen}
        onClose={() => setIsExecutionModalOpen(false)}
        tasks={tasks}
        telemetry={telemetry}
        syncState={syncState}
        localFolderName={localFolderName}
        concurrency={concurrency}
      />

      {/* Full Drive ZIP Permission, Resume & Progress Tracking Modal */}
      <DownloadAllZipModal
        isOpen={isDownloadAllModalOpen}
        isProcessing={isDownloadingAllZip}
        isCancelling={isCancellingDownloadAll}
        progress={downloadAllProgress}
        savedCheckpoint={savedZipCheckpoint}
        localFolderName={localFolderName}
        onConfirmFresh={handleConfirmFreshDownloadAllZip}
        onResumeCheckpoint={handleResumeDownloadAllZip}
        onDenyResumeAndStartFresh={handleDenyResumeAndStartFresh}
        onCancel={handleCancelDownloadAllZip}
      />
      {/* Selected Items ZIP Progress Tracking Modal */}
      <ZipProgressModal
        isOpen={isZipModalOpen}
        isCancelling={isCancellingZip}
        progress={zipProgress}
        localFolderName={localFolderName}
        selectedCount={zipSelectedCount}
        onCancel={handleCancelZip}
      />
    </div>
  );
}
