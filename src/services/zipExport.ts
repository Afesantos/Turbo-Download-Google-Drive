import JSZip from 'jszip';
import {
  DriveFile,
  DriveScanState,
  downloadFileStream,
  FileWithPath,
  listAllFilesRecursively,
  NON_EXPORTABLE_WORKSPACE_TYPES,
  scanDriveRecursivelyResumable,
} from './drive';
import { triggerBrowserDownload, verifyPermission, writeBufferToLocalFile } from './localFileSystem';
import {
  cleanupTempRecoveryFiles,
  loadTempPartialZipBlobs,
  loadZipAllCheckpointData,
  saveTempPartialZipOnError,
  saveTempRecoveryManifest,
  saveZipAllCheckpointFile,
  saveZipAllCheckpointMeta,
  ZipAllCheckpointMeta,
} from './zipCheckpoint';

export interface ZipExportStats {
  fileCount: number;
  folderCount: number;
  totalBytes: number;
  elapsedSeconds?: number;
}

const sanitizeSegment = (name: string): string => {
  const cleaned = name.trim().replace(/[<>:"/\\|?*]/g, '_');
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'arquivo';
  return cleaned;
};

const getUniqueZipPath = (
  folderPrefix: string,
  fileName: string,
  usedPathsLower: Set<string>
): string => {
  const sanitizedFile = sanitizeSegment(fileName);
  const lastDotIndex = sanitizedFile.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? sanitizedFile.substring(0, lastDotIndex) : sanitizedFile;
  const ext = lastDotIndex > 0 ? sanitizedFile.substring(lastDotIndex) : '';

  let candidateName = sanitizedFile;
  let counter = 1;
  while (usedPathsLower.has(`${folderPrefix}${candidateName}`.toLowerCase())) {
    candidateName = `${baseName} (${counter})${ext}`;
    counter++;
  }

  const finalPath = `${folderPrefix}${candidateName}`;
  usedPathsLower.add(finalPath.toLowerCase());
  return finalPath;
};

export interface ZipAllProgress {
  phase: 'scanning' | 'downloading' | 'compressing' | 'saving';
  percent: number;
  currentItem: string;
  processedFiles: number;
  totalFiles: number;
  folderCount: number;
  discoveredFolders?: number;
  downloadedBytes: number;
  totalBytesExpected: number;
  startedAt?: number;
  originalStartedAt?: number;
  priorElapsedMs?: number;
  scanStartedAt?: number;
  priorScanElapsedMs?: number;
  scanCompletedAt?: number;
  downloadStartedAt?: number;
  initialResumedBytes?: number;
  initialResumedFiles?: number;
}

const readStreamWithAbort = async (
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
  onChunk?: (chunkByteLength: number) => void
): Promise<Blob> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  const handleAbort = () => {
    reader.cancel().catch(() => {});
  };
  if (signal) {
    if (signal.aborted) {
      await reader.cancel().catch(() => {});
      throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
    }
    signal.addEventListener('abort', handleAbort, { once: true });
  }

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        chunks.push(value);
        onChunk?.(value.byteLength);
      }
    }
    return new Blob(chunks as BlobPart[]);
  } finally {
    if (signal) {
      signal.removeEventListener('abort', handleAbort);
    }
    reader.releaseLock();
  }
};

export const exportSelectedFilesToZip = async (
  accessToken: string,
  files: DriveFile[],
  targetDirHandle: FileSystemDirectoryHandle | null,
  onProgress?: (progress: ZipAllProgress) => void,
  signal?: AbortSignal,
  basePathSegments: string[] = []
): Promise<ZipExportStats> => {
  const zip = new JSZip();
  const startedAt = Date.now();
  const scanStartedAt = startedAt;
  let scanCompletedAt: number | undefined;
  let downloadStartedAt: number | undefined;
  let scannedFolders = 0;
  let discoveredFolders = files.filter((f) => f.isFolder).length || 1;

  const sanitizedBaseSegments = basePathSegments.map(sanitizeSegment).filter(Boolean);
  const baseFolderPath = sanitizedBaseSegments.join('/');
  const baseFolderPrefix = baseFolderPath ? `${baseFolderPath}/` : '';

  onProgress?.({
    phase: 'scanning',
    percent: 2,
    currentItem: baseFolderPath || 'Preparando itens selecionados...',
    processedFiles: 0,
    totalFiles: 0,
    folderCount: 0,
    discoveredFolders,
    downloadedBytes: 0,
    totalBytesExpected: 0,
    startedAt,
    scanStartedAt,
  });

  // Flatten folders if any while preserving exact Google Drive hierarchy
  const allDownloadItems: { file: DriveFile; path: string }[] = [];
  const uniqueFolders = new Set<string>();
  if (baseFolderPath) {
    uniqueFolders.add(baseFolderPath);
  }

  for (const item of files) {
    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
    }

    if (item.isFolder) {
      const scanTracker = { scannedFolders: 0, discoveredFolders: 1 };
      const recursive = await listAllFilesRecursively(
        accessToken,
        item.id,
        [...sanitizedBaseSegments, item.name],
        new Set<string>(),
        (pathSegments) => {
          const visitedFolderPath = pathSegments.map(sanitizeSegment).filter(Boolean).join('/');
          if (visitedFolderPath) {
            uniqueFolders.add(visitedFolderPath);
            zip.folder(visitedFolderPath);
          }
        },
        signal,
        (scanInfo) => {
          scannedFolders += 1;
          discoveredFolders = Math.max(discoveredFolders, scannedFolders + (scanInfo.discoveredFolders - scanInfo.scannedFolders));
          onProgress?.({
            phase: 'scanning',
            percent: Math.min(10, 2 + Math.floor(scannedFolders / 2)),
            currentItem: scanInfo.currentFolder,
            processedFiles: 0,
            totalFiles: 0,
            folderCount: scannedFolders,
            discoveredFolders,
            downloadedBytes: 0,
            totalBytesExpected: 0,
            startedAt,
            scanStartedAt,
          });
        },
        scanTracker
      );

      for (const rec of recursive) {
        const sanitizedSegments = rec.pathSegments.map(sanitizeSegment).filter(Boolean);
        const folderPath = sanitizedSegments.join('/');
        if (folderPath) uniqueFolders.add(folderPath);
        allDownloadItems.push({
          file: rec.file,
          path: folderPath ? `${folderPath}/` : '',
        });
      }
    } else if (!NON_EXPORTABLE_WORKSPACE_TYPES.has(item.mimeType)) {
      allDownloadItems.push({
        file: item,
        path: baseFolderPrefix,
      });
    }
  }

  if (signal?.aborted) {
    throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
  }

  scanCompletedAt = Date.now();
  downloadStartedAt = scanCompletedAt;

  const totalItems = allDownloadItems.length;
  if (totalItems === 0 && uniqueFolders.size === 0) {
    throw new Error('Nenhum arquivo compatível encontrado para compactar no ZIP.');
  }

  const totalBytesExpected = allDownloadItems.reduce(
    (sum, item) => sum + parseInt(item.file.size || '0', 10),
    0
  );

  const usedZipPathsLower = new Set<string>();
  let processedItems = 0;
  let downloadedCount = 0;
  let committedBytes = 0;

  const calcDownloadPercent = (currentBytes: number) => {
    if (totalBytesExpected > 0) {
      return Math.min(89, 10 + Math.round((currentBytes / totalBytesExpected) * 79));
    }
    return Math.min(89, 10 + Math.round((processedItems / Math.max(1, totalItems)) * 79));
  };

  for (const item of allDownloadItems) {
    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
    }

    const displayLabel = item.path ? `${item.path}${item.file.name}` : item.file.name;

    onProgress?.({
      phase: 'downloading',
      percent: calcDownloadPercent(committedBytes),
      currentItem: displayLabel,
      processedFiles: processedItems,
      totalFiles: totalItems,
      folderCount: Math.max(scannedFolders, uniqueFolders.size),
      discoveredFolders: Math.max(discoveredFolders, uniqueFolders.size),
      downloadedBytes: committedBytes,
      totalBytesExpected,
      startedAt,
      scanStartedAt,
      scanCompletedAt,
      downloadStartedAt,
    });

    try {
      const { stream, finalFileName } = await downloadFileStream(
        accessToken,
        item.file,
        undefined,
        signal
      );

      let inFlightBytes = 0;
      let lastUiUpdate = Date.now();
      const blob = await readStreamWithAbort(stream, signal, (chunkBytes) => {
        inFlightBytes += chunkBytes;
        const now = Date.now();
        if (now - lastUiUpdate >= 120) {
          lastUiUpdate = now;
          onProgress?.({
            phase: 'downloading',
            percent: calcDownloadPercent(committedBytes + inFlightBytes),
            currentItem: displayLabel,
            processedFiles: processedItems,
            totalFiles: totalItems,
            folderCount: Math.max(scannedFolders, uniqueFolders.size),
            discoveredFolders: Math.max(discoveredFolders, uniqueFolders.size),
            downloadedBytes: committedBytes + inFlightBytes,
            totalBytesExpected,
            startedAt,
            scanStartedAt,
            scanCompletedAt,
            downloadStartedAt,
          });
        }
      });

      if (signal?.aborted) {
        throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
      }

      const zipPath = getUniqueZipPath(item.path, finalFileName, usedZipPathsLower);
      zip.file(zipPath, blob);
      committedBytes += blob.size;
      downloadedCount++;
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted || err?.status === 401) {
        throw err;
      }
      console.warn(`Erro ao adicionar ${item.file.name} ao ZIP:`, err);
    }
    processedItems++;
  }

  if (signal?.aborted) {
    throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
  }

  const finalFolderCount = Math.max(1, uniqueFolders.size);

  onProgress?.({
    phase: 'compressing',
    percent: 90,
    currentItem: 'Comprimindo arquivo final ZIP...',
    processedFiles: totalItems,
    totalFiles: totalItems,
    folderCount: finalFolderCount,
    discoveredFolders: finalFolderCount,
    downloadedBytes: committedBytes,
    totalBytesExpected,
    startedAt,
    scanStartedAt,
    scanCompletedAt,
    downloadStartedAt,
  });

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (signal?.aborted) {
        throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
      }
      onProgress?.({
        phase: 'compressing',
        percent: Math.min(98, 90 + Math.round((metadata.percent / 100) * 8)),
        currentItem: metadata.currentFile || 'Compactando pacote final...',
        processedFiles: totalItems,
        totalFiles: totalItems,
        folderCount: finalFolderCount,
        discoveredFolders: finalFolderCount,
        downloadedBytes: committedBytes,
        totalBytesExpected,
        startedAt,
        scanStartedAt,
        scanCompletedAt,
        downloadStartedAt,
      });
    }
  );

  if (signal?.aborted) {
    throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
  }

  const zipName = `DriveSync_${new Date().toISOString().slice(0, 10)}.zip`;

  onProgress?.({
    phase: 'saving',
    percent: 99,
    currentItem: zipName,
    processedFiles: totalItems,
    totalFiles: totalItems,
    folderCount: finalFolderCount,
    discoveredFolders: finalFolderCount,
    downloadedBytes: committedBytes,
    totalBytesExpected,
    startedAt,
    scanStartedAt,
    scanCompletedAt,
    downloadStartedAt,
  });

  let wroteToDisk = false;
  if (targetDirHandle) {
    try {
      const hasPerm = await verifyPermission(targetDirHandle, true);
      if (hasPerm) {
        if (signal?.aborted) {
          throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
        }
        await writeBufferToLocalFile(targetDirHandle, [], zipName, zipBlob);
        wroteToDisk = true;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        throw err;
      }
      wroteToDisk = false;
    }
  }

  if (signal?.aborted) {
    throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
  }

  if (!wroteToDisk) {
    triggerBrowserDownload(zipBlob, zipName);
  }

  onProgress?.({
    phase: 'saving',
    percent: 100,
    currentItem: 'Concluído!',
    processedFiles: totalItems,
    totalFiles: totalItems,
    folderCount: finalFolderCount,
    discoveredFolders: finalFolderCount,
    downloadedBytes: committedBytes,
    totalBytesExpected,
    startedAt,
    scanStartedAt,
    scanCompletedAt,
    downloadStartedAt,
  });

  return {
    fileCount: downloadedCount,
    folderCount: finalFolderCount,
    totalBytes: zipBlob.size,
  };
};

const buildFullDriveBackupZipName = (userNameOrEmail?: string | null): string => {
  const rawSource = (userNameOrEmail || '').trim();
  let firstName = 'Usuario';

  if (rawSource) {
    if (rawSource.includes('@') && !rawSource.includes(' ')) {
      firstName = rawSource.split('@')[0] || 'Usuario';
    } else {
      firstName = rawSource.split(/\s+/)[0] || 'Usuario';
    }
  }

  const safeFirstName = sanitizeSegment(firstName).replace(/\s+/g, '') || 'Usuario';
  const now = new Date();
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const datePart = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const timePart = `${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}`;

  return `Backup-Drive-${safeFirstName}-${datePart}_${timePart}.zip`;
};

export const exportAllDriveToZip = async (
  accessToken: string,
  targetDirHandle: FileSystemDirectoryHandle | null,
  onProgress?: (progress: ZipAllProgress) => void,
  signal?: AbortSignal,
  resumeFromCheckpoint: boolean = false,
  userNameOrEmail?: string | null
): Promise<ZipExportStats> => {
  const zip = new JSZip();
  const startedAt = Date.now();
  const scanStartedAt = startedAt;
  let priorElapsedMs = 0;
  let priorScanElapsedMs = 0;
  let scanCompletedAt: number | undefined;
  let downloadStartedAt: number | undefined;
  let initialResumedBytes = 0;
  let initialResumedFiles = 0;

  let allDriveFiles: FileWithPath[] = [];
  let scannedFolders = 0;
  let discoveredFolders = 1;
  let scanCompleted = false;
  const usedZipPathsLower = new Set<string>();
  const uniqueFolders = new Set<string>();
  const completedFileIds = new Set<string>();
  let completedItems: ZipAllCheckpointMeta['completedItems'] = [];
  let checkpointCreatedAt = startedAt;
  let committedBytes = 0;
  let downloadedCount = 0;
  let checkpointMeta: ZipAllCheckpointMeta | null = null;

  let scanState: DriveScanState = {
    pendingFolders: [{ id: 'root', pathSegments: [] }],
    visitedFolderIds: [],
    uniqueFolders: [],
    files: [],
    scannedFolders: 0,
    discoveredFolders: 1,
  };

  const emitProgress = (
    patch: Omit<
      ZipAllProgress,
      'startedAt' | 'originalStartedAt' | 'priorElapsedMs' | 'scanStartedAt' | 'priorScanElapsedMs'
    >
  ) => {
    onProgress?.({
      ...patch,
      startedAt,
      originalStartedAt: checkpointCreatedAt,
      priorElapsedMs,
      scanStartedAt,
      priorScanElapsedMs,
    });
  };

  const buildCurrentMeta = (lastError?: string): ZipAllCheckpointMeta => {
    const now = Date.now();
    const filesSnapshot = scanCompleted ? allDriveFiles : scanState.files;
    const totalExpected = filesSnapshot.reduce(
      (sum, item) => sum + parseInt(item.file.size || '0', 10),
      0
    );
    const currentSessionElapsed = Math.max(0, now - startedAt);
    const currentScanElapsed = scanCompleted
      ? priorScanElapsedMs + Math.max(0, (scanCompletedAt || now) - scanStartedAt)
      : priorScanElapsedMs + Math.max(0, now - scanStartedAt);

    return {
      id: 'active_session',
      createdAt: checkpointCreatedAt,
      updatedAt: now,
      files: filesSnapshot,
      completedItems,
      usedZipPathsLower: Array.from(usedZipPathsLower),
      uniqueFolders: Array.from(uniqueFolders),
      totalFiles: filesSnapshot.length,
      folderCount: Math.max(scannedFolders, uniqueFolders.size, scanState.scannedFolders),
      downloadedBytes: committedBytes,
      totalBytesExpected: totalExpected,
      scanCompleted,
      pendingScanFolders: scanCompleted ? [] : scanState.pendingFolders,
      visitedFolderIds: scanState.visitedFolderIds,
      scannedFolders: Math.max(scannedFolders, scanState.scannedFolders),
      discoveredFolders: Math.max(discoveredFolders, scanState.discoveredFolders),
      accumulatedElapsedMs: priorElapsedMs + currentSessionElapsed,
      accumulatedScanElapsedMs: currentScanElapsed,
      lastError,
    };
  };

  const persistErrorRecoveryFiles = async (err: any) => {
    const isCancelled = err?.name === 'AbortError' || signal?.aborted;
    const latestMeta = buildCurrentMeta(
      isCancelled ? 'Processo cancelado pelo usuário' : err?.message || 'Erro durante a transferência'
    );

    const hasProgress =
      latestMeta.files.length > 0 ||
      (latestMeta.visitedFolderIds?.length || 0) > 0 ||
      downloadedCount > 0;

    if (isCancelled && !hasProgress) {
      return;
    }

    try {
      const recoveryRes = await saveTempRecoveryManifest(
        latestMeta,
        targetDirHandle,
        isCancelled ? 'in_progress' : 'error',
        isCancelled ? undefined : err?.message || 'Erro desconhecido durante o download.',
        !isCancelled
      );
      if (downloadedCount > 0) {
        await saveTempPartialZipOnError(zip, targetDirHandle);
      }
      if (!isCancelled && err && typeof err === 'object') {
        err.recoveryFileName = recoveryRes.fileName;
        err.recoverySavedToDisk = recoveryRes.savedToDisk;
        err.recoveryDownloaded = recoveryRes.downloadedToUser;
      }
    } catch (saveErr) {
      console.warn('Falha ao gravar arquivo temporário de retomada:', saveErr);
    }
  };

  try {
    let loadedSaved = false;
    if (resumeFromCheckpoint) {
      onProgress?.({
        phase: 'scanning',
        percent: 5,
        currentItem: 'Restaurando progresso salvo na memória...',
        processedFiles: 0,
        totalFiles: 0,
        folderCount: 0,
        discoveredFolders: 1,
        downloadedBytes: 0,
        totalBytesExpected: 0,
        startedAt,
        scanStartedAt,
      });

      const saved = await loadZipAllCheckpointData(targetDirHandle);
      if (saved) {
        loadedSaved = true;
        checkpointCreatedAt = saved.meta.createdAt || startedAt;
        priorElapsedMs =
          typeof saved.meta.accumulatedElapsedMs === 'number'
            ? Math.max(0, saved.meta.accumulatedElapsedMs)
            : Math.max(0, (saved.meta.updatedAt || checkpointCreatedAt) - checkpointCreatedAt);
        saved.meta.uniqueFolders.forEach((f) => uniqueFolders.add(f));
        scanCompleted = saved.meta.scanCompleted !== false;
        priorScanElapsedMs =
          typeof saved.meta.accumulatedScanElapsedMs === 'number'
            ? Math.max(0, saved.meta.accumulatedScanElapsedMs)
            : scanCompleted
            ? 0
            : priorElapsedMs;

        if (!scanCompleted && saved.meta.pendingScanFolders) {
          scanState = {
            pendingFolders: [...saved.meta.pendingScanFolders],
            visitedFolderIds: [...(saved.meta.visitedFolderIds || [])],
            uniqueFolders: Array.from(uniqueFolders),
            files: [...(saved.meta.files || [])],
            scannedFolders: saved.meta.scannedFolders || saved.meta.folderCount || 0,
            discoveredFolders: Math.max(
              1,
              saved.meta.discoveredFolders ||
                (saved.meta.scannedFolders || 0) + saved.meta.pendingScanFolders.length
            ),
          };
          scannedFolders = scanState.scannedFolders;
          discoveredFolders = scanState.discoveredFolders;
          allDriveFiles = scanState.files;
        } else {
          allDriveFiles = saved.meta.files;
          scannedFolders = saved.meta.scannedFolders || saved.meta.folderCount;
          discoveredFolders = Math.max(1, saved.meta.discoveredFolders || scannedFolders);
        }

        const blobByPath = new Map<string, Blob>();
        for (const rec of saved.blobs) {
          blobByPath.set(rec.zipPath, rec.blob);
        }

        // Also check DriveSync_Parcial_Temp.zip on disk or OPFS if any blobs are missing
        const missingFromIdb = (saved.meta.completedItems || []).some((c) => !blobByPath.has(c.zipPath));
        if (missingFromIdb) {
          const partialZipBlobs = await loadTempPartialZipBlobs(targetDirHandle);
          partialZipBlobs.forEach((blob, path) => {
            if (!blobByPath.has(path)) {
              blobByPath.set(path, blob);
            }
          });
        }

        for (const comp of saved.meta.completedItems || []) {
          const blob = blobByPath.get(comp.zipPath);
          if (blob) {
            zip.file(comp.zipPath, blob);
            usedZipPathsLower.add(comp.zipPath.toLowerCase());
            completedFileIds.add(comp.fileId);
            completedItems.push(comp);
            committedBytes += blob.size;
            downloadedCount++;
          }
        }

        initialResumedBytes = committedBytes;
        initialResumedFiles = completedItems.length;
        if (scanCompleted) {
          scanCompletedAt = Date.now();
          downloadStartedAt = scanCompletedAt;
        }
      }
    }

    if (!loadedSaved && !resumeFromCheckpoint) {
      await cleanupTempRecoveryFiles(targetDirHandle);
    }

    if (!loadedSaved || !scanCompleted) {
      emitProgress({
        phase: 'scanning',
        percent: Math.min(9, 2 + Math.floor(scannedFolders / 3)),
        currentItem:
          loadedSaved && scanState.pendingFolders[0]?.pathSegments.length
            ? scanState.pendingFolders[0].pathSegments.join(' / ')
            : 'Meu Drive',
        processedFiles: 0,
        totalFiles: scanState.files.length,
        folderCount: scannedFolders,
        discoveredFolders,
        downloadedBytes: committedBytes,
        totalBytesExpected: 0,
      });

      allDriveFiles = await scanDriveRecursivelyResumable(
        accessToken,
        scanState,
        (pathSegments) => {
          const visitedFolderPath = pathSegments.map(sanitizeSegment).filter(Boolean).join('/');
          if (visitedFolderPath) {
            uniqueFolders.add(visitedFolderPath);
          }
        },
        signal,
        (scanInfo) => {
          scannedFolders = scanInfo.scannedFolders;
          discoveredFolders = scanInfo.discoveredFolders;
          emitProgress({
            phase: 'scanning',
            percent: Math.min(10, 2 + Math.floor(scannedFolders / 3)),
            currentItem: scanInfo.currentFolder,
            processedFiles: 0,
            totalFiles: scanState.files.length,
            folderCount: scannedFolders,
            discoveredFolders,
            downloadedBytes: committedBytes,
            totalBytesExpected: 0,
          });
        },
        async () => {
          const midScanMeta = buildCurrentMeta();
          await saveZipAllCheckpointMeta(midScanMeta);
          await saveTempRecoveryManifest(midScanMeta, targetDirHandle, 'in_progress');
        }
      );

      if (signal?.aborted) {
        throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
      }

      if (allDriveFiles.length === 0) {
        throw new Error('Nenhum arquivo compatível encontrado no seu Google Drive.');
      }

      for (const item of allDriveFiles) {
        const folderPath = item.pathSegments.map(sanitizeSegment).filter(Boolean).join('/');
        if (folderPath) uniqueFolders.add(folderPath);
      }

      scanCompleted = true;
      scanCompletedAt = Date.now();
      downloadStartedAt = scanCompletedAt;
    }

    const totalItems = allDriveFiles.length;
    const totalBytesExpected = allDriveFiles.reduce(
      (sum, item) => sum + parseInt(item.file.size || '0', 10),
      0
    );

    checkpointMeta = buildCurrentMeta();

    await saveTempRecoveryManifest(checkpointMeta, targetDirHandle, 'in_progress');

    let processedItems = completedFileIds.size;
    let downloadedBytes = committedBytes;

    for (const item of allDriveFiles) {
      if (signal?.aborted) {
        throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
      }

      if (completedFileIds.has(item.file.id)) {
        continue;
      }

      const sanitizedSegments = item.pathSegments.map(sanitizeSegment).filter(Boolean);
      const folderPath = sanitizedSegments.join('/');
      if (folderPath) uniqueFolders.add(folderPath);
      const folderPrefix = folderPath ? `${folderPath}/` : '';
      const displayLabel = folderPath ? `${folderPath}/${item.file.name}` : item.file.name;

      const calcDownloadPercent = (currentBytes: number) => {
        if (totalBytesExpected > 0) {
          return Math.min(89, 10 + Math.round((currentBytes / totalBytesExpected) * 79));
        }
        return Math.min(89, 10 + Math.round((processedItems / Math.max(1, totalItems)) * 79));
      };

      emitProgress({
        phase: 'downloading',
        percent: calcDownloadPercent(committedBytes),
        currentItem: displayLabel,
        processedFiles: processedItems,
        totalFiles: totalItems,
        folderCount: Math.max(scannedFolders, uniqueFolders.size),
        discoveredFolders: Math.max(discoveredFolders, uniqueFolders.size),
        downloadedBytes: committedBytes,
        totalBytesExpected,
        scanCompletedAt,
        downloadStartedAt,
        initialResumedBytes,
        initialResumedFiles,
      });

      try {
        const { stream, finalFileName } = await downloadFileStream(
          accessToken,
          item.file,
          undefined,
          signal
        );

        let inFlightBytes = 0;
        let lastUiUpdate = Date.now();
        const blob = await readStreamWithAbort(stream, signal, (chunkBytes) => {
          inFlightBytes += chunkBytes;
          const now = Date.now();
          if (now - lastUiUpdate >= 120) {
            lastUiUpdate = now;
            emitProgress({
              phase: 'downloading',
              percent: calcDownloadPercent(committedBytes + inFlightBytes),
              currentItem: displayLabel,
              processedFiles: processedItems,
              totalFiles: totalItems,
              folderCount: Math.max(scannedFolders, uniqueFolders.size),
              discoveredFolders: Math.max(discoveredFolders, uniqueFolders.size),
              downloadedBytes: committedBytes + inFlightBytes,
              totalBytesExpected,
              scanCompletedAt,
              downloadStartedAt,
              initialResumedBytes,
              initialResumedFiles,
            });
          }
        });

        if (signal?.aborted) {
          throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
        }

        const zipPath = getUniqueZipPath(folderPrefix, finalFileName, usedZipPathsLower);
        zip.file(zipPath, blob);

        committedBytes += blob.size;
        downloadedBytes = committedBytes;
        downloadedCount++;
        processedItems++;

        completedFileIds.add(item.file.id);
        completedItems.push({
          fileId: item.file.id,
          zipPath,
          byteSize: blob.size,
        });
        const now = Date.now();
        checkpointMeta.updatedAt = now;
        checkpointMeta.completedItems = completedItems;
        checkpointMeta.usedZipPathsLower = Array.from(usedZipPathsLower);
        checkpointMeta.uniqueFolders = Array.from(uniqueFolders);
        checkpointMeta.folderCount = Math.max(scannedFolders, uniqueFolders.size);
        checkpointMeta.downloadedBytes = committedBytes;
        checkpointMeta.accumulatedElapsedMs = priorElapsedMs + Math.max(0, now - startedAt);

        await saveZipAllCheckpointFile(zipPath, blob, checkpointMeta);
        if (downloadedCount % 10 === 0) {
          await saveTempRecoveryManifest(checkpointMeta, targetDirHandle, 'in_progress');
        }
      } catch (err: any) {
        const isNetworkError =
          err instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
        const isRecoverableApiError =
          err?.status === 401 ||
          err?.status === 429 ||
          (typeof err?.status === 'number' && err.status >= 500);
        if (
          err?.name === 'AbortError' ||
          signal?.aborted ||
          isRecoverableApiError ||
          isNetworkError
        ) {
          throw err;
        }
        console.warn(`Erro ao adicionar ${item.file.name} ao ZIP:`, err);
        processedItems++;
      }
    }

    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
    }

    uniqueFolders.forEach((folderPath) => {
      if (folderPath) {
        zip.folder(folderPath);
      }
    });

    const finalFolderCount = Math.max(1, uniqueFolders.size);

    emitProgress({
      phase: 'compressing',
      percent: 90,
      currentItem: 'Gerando arquivo ZIP completo...',
      processedFiles: totalItems,
      totalFiles: totalItems,
      folderCount: finalFolderCount,
      discoveredFolders: finalFolderCount,
      downloadedBytes,
      totalBytesExpected,
      scanCompletedAt,
      downloadStartedAt,
      initialResumedBytes,
      initialResumedFiles,
    });

    const zipBlob = await zip.generateAsync(
      {
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      },
      (metadata) => {
        if (signal?.aborted) {
          throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
        }
        emitProgress({
          phase: 'compressing',
          percent: Math.min(98, 90 + Math.round((metadata.percent / 100) * 8)),
          currentItem: metadata.currentFile || 'Compactando pacote final...',
          processedFiles: totalItems,
          totalFiles: totalItems,
          folderCount: finalFolderCount,
          discoveredFolders: finalFolderCount,
          downloadedBytes,
          totalBytesExpected,
          scanCompletedAt,
          downloadStartedAt,
          initialResumedBytes,
          initialResumedFiles,
        });
      }
    );

    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
    }

    const zipName = buildFullDriveBackupZipName(userNameOrEmail);

    emitProgress({
      phase: 'saving',
      percent: 99,
      currentItem: zipName,
      processedFiles: totalItems,
      totalFiles: totalItems,
      folderCount: finalFolderCount,
      discoveredFolders: finalFolderCount,
      downloadedBytes,
      totalBytesExpected,
      scanCompletedAt,
      downloadStartedAt,
      initialResumedBytes,
      initialResumedFiles,
    });

    let wroteToDisk = false;
    if (targetDirHandle) {
      try {
        const hasPerm = await verifyPermission(targetDirHandle, true);
        if (hasPerm) {
          if (signal?.aborted) {
            throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
          }
          await writeBufferToLocalFile(targetDirHandle, [], zipName, zipBlob);
          wroteToDisk = true;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) {
          throw err;
        }
        wroteToDisk = false;
      }
    }

    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
    }

    if (!wroteToDisk) {
      triggerBrowserDownload(zipBlob, zipName);
    }

    // Delete temporary recovery files once full download completes cleanly
    await cleanupTempRecoveryFiles(targetDirHandle);

    emitProgress({
      phase: 'saving',
      percent: 100,
      currentItem: 'Concluído!',
      processedFiles: totalItems,
      totalFiles: totalItems,
      folderCount: finalFolderCount,
      discoveredFolders: finalFolderCount,
      downloadedBytes,
      totalBytesExpected,
      scanCompletedAt,
      downloadStartedAt,
      initialResumedBytes,
      initialResumedFiles,
    });

    return {
      fileCount: downloadedCount,
      folderCount: finalFolderCount,
      totalBytes: zipBlob.size,
      elapsedSeconds: Math.max(0, Math.round((priorElapsedMs + (Date.now() - startedAt)) / 1000)),
    };
  } catch (err: any) {
    await persistErrorRecoveryFiles(err);
    throw err;
  }
};
