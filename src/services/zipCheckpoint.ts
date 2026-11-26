import JSZip from 'jszip';
import { DriveFile } from './drive';
import {
  deleteLocalFileIfExists,
  deleteOpfsTempFile,
  readLocalFileIfExists,
  readOpfsTempFile,
  triggerBrowserDownload,
  verifyPermission,
  writeFixedLocalFile,
  writeOpfsTempFile,
} from './localFileSystem';

const DB_NAME = 'DriveSyncZipCheckpointDB';
const DB_VERSION = 1;
const META_STORE = 'meta';
const BLOB_STORE = 'blobs';
const SESSION_KEY = 'active_session';

export const TEMP_RECOVERY_MANIFEST_NAME = 'DriveSync_Retomada_Temp.json';
export const TEMP_PARTIAL_ZIP_NAME = 'DriveSync_Parcial_Temp.zip';

export interface CheckpointFileEntry {
  file: DriveFile;
  pathSegments: string[];
}

export interface CompletedCheckpointItem {
  fileId: string;
  zipPath: string;
  byteSize: number;
}

export interface PendingScanFolder {
  id: string;
  pathSegments: string[];
}

export interface ZipAllCheckpointMeta {
  id: string;
  createdAt: number;
  updatedAt: number;
  files: CheckpointFileEntry[];
  completedItems: CompletedCheckpointItem[];
  usedZipPathsLower: string[];
  uniqueFolders: string[];
  totalFiles: number;
  folderCount: number;
  downloadedBytes: number;
  totalBytesExpected: number;
  scanCompleted?: boolean;
  pendingScanFolders?: PendingScanFolder[];
  visitedFolderIds?: string[];
  scannedFolders?: number;
  discoveredFolders?: number;
  accumulatedElapsedMs?: number;
  accumulatedScanElapsedMs?: number;
  skippedNonExportableCount?: number;
  lastError?: string;
}

export interface ZipAllCheckpointSummary {
  createdAt: number;
  updatedAt: number;
  completedFiles: number;
  totalFiles: number;
  folderCount: number;
  downloadedBytes: number;
  totalBytesExpected: number;
  percent: number;
  scanCompleted: boolean;
  scannedFolders: number;
  elapsedMs: number;
  lastError?: string;
}

export interface StoredZipBlobRecord {
  zipPath: string;
  blob: Blob;
}

export interface RecoveryManifestFile {
  app: 'DriveSync Turbo';
  version: 1;
  status: 'in_progress' | 'error';
  startedAt: number;
  updatedAt: number;
  errorOccurredAt?: number;
  errorMessage?: string;
  folderCount: number;
  totalFiles: number;
  completedFilesCount: number;
  pendingFilesCount: number;
  downloadedBytes: number;
  totalBytesExpected: number;
  capturedItems: Array<{
    fileId: string;
    name: string;
    zipPath: string;
    byteSize: number;
  }>;
  pendingItems: Array<{
    fileId: string;
    name: string;
    pathSegments: string[];
    size?: string;
  }>;
  checkpointMeta: ZipAllCheckpointMeta;
}

const isCheckpointUsable = (meta: ZipAllCheckpointMeta | null | undefined): meta is ZipAllCheckpointMeta => {
  if (!meta) return false;
  if (Array.isArray(meta.files) && meta.files.length > 0) return true;
  if (
    meta.scanCompleted === false &&
    ((Array.isArray(meta.pendingScanFolders) && meta.pendingScanFolders.length > 0) ||
      (Array.isArray(meta.visitedFolderIds) && meta.visitedFolderIds.length > 0))
  ) {
    return true;
  }
  return false;
};

let cachedCheckpointDbPromise: Promise<IDBDatabase> | null = null;

const openCheckpointDB = (): Promise<IDBDatabase> => {
  if (cachedCheckpointDbPromise) {
    return cachedCheckpointDbPromise;
  }
  cachedCheckpointDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      cachedCheckpointDbPromise = null;
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'zipPath' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        cachedCheckpointDbPromise = null;
      };
      db.onclose = () => {
        cachedCheckpointDbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      cachedCheckpointDbPromise = null;
      reject(request.error);
    };
  });
  return cachedCheckpointDbPromise;
};

export const saveZipAllCheckpointMeta = async (meta: ZipAllCheckpointMeta): Promise<void> => {
  try {
    const db = await openCheckpointDB();
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(meta, SESSION_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Não foi possível salvar metadados do checkpoint ZIP:', err);
  }
};

export const saveZipAllCheckpointFile = async (
  zipPath: string,
  blob: Blob,
  meta: ZipAllCheckpointMeta
): Promise<void> => {
  try {
    const db = await openCheckpointDB();
    const tx = db.transaction([BLOB_STORE, META_STORE], 'readwrite');
    tx.objectStore(BLOB_STORE).put({ zipPath, blob } as StoredZipBlobRecord);
    tx.objectStore(META_STORE).put(meta, SESSION_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Não foi possível persistir arquivo no checkpoint ZIP:', err);
  }
};

const readIdbCheckpointMeta = async (): Promise<ZipAllCheckpointMeta | null> => {
  try {
    const db = await openCheckpointDB();
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get(SESSION_KEY);
    const result = await new Promise<ZipAllCheckpointMeta | null>((resolve) => {
      req.onsuccess = () => resolve((req.result as ZipAllCheckpointMeta) || null);
      req.onerror = () => resolve(null);
    });
    return isCheckpointUsable(result) ? result : null;
  } catch {
    return null;
  }
};

const readManifestMetaFromFile = async (file: File | null): Promise<ZipAllCheckpointMeta | null> => {
  if (!file) return null;
  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw) as Partial<RecoveryManifestFile>;
    const meta = parsed?.checkpointMeta;
    return isCheckpointUsable(meta) ? meta : null;
  } catch {
    return null;
  }
};

export const getZipAllCheckpointMeta = async (
  targetDirHandle: FileSystemDirectoryHandle | null = null
): Promise<ZipAllCheckpointMeta | null> => {
  const candidates: ZipAllCheckpointMeta[] = [];

  const idbMeta = await readIdbCheckpointMeta();
  if (idbMeta) candidates.push(idbMeta);

  const opfsFile = await readOpfsTempFile(TEMP_RECOVERY_MANIFEST_NAME);
  const opfsMeta = await readManifestMetaFromFile(opfsFile);
  if (opfsMeta) candidates.push(opfsMeta);

  if (targetDirHandle) {
    try {
      const diskFile = await readLocalFileIfExists(targetDirHandle, TEMP_RECOVERY_MANIFEST_NAME);
      const diskMeta = await readManifestMetaFromFile(diskFile);
      if (diskMeta) candidates.push(diskMeta);
    } catch {
      // ignore disk read errors when checking availability
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const best = candidates[0];

  if (!idbMeta || (best.updatedAt || 0) > (idbMeta.updatedAt || 0)) {
    await saveZipAllCheckpointMeta(best);
  }

  return best;
};

export const getZipAllCheckpointSummary = async (
  targetDirHandle: FileSystemDirectoryHandle | null = null
): Promise<ZipAllCheckpointSummary | null> => {
  const meta = await getZipAllCheckpointMeta(targetDirHandle);
  if (!meta) return null;

  const completedFiles = meta.completedItems?.length || 0;
  const totalFiles = meta.totalFiles || meta.files.length;
  const scanCompleted = meta.scanCompleted !== false;
  const scannedFolders = meta.scannedFolders || meta.folderCount || 0;

  let percent = 10;
  if (!scanCompleted) {
    percent = Math.min(9, 2 + Math.floor(scannedFolders / 3));
  } else if (meta.totalBytesExpected > 0) {
    percent = Math.min(89, 10 + Math.round((meta.downloadedBytes / meta.totalBytesExpected) * 79));
  } else if (totalFiles > 0) {
    percent = Math.min(89, 10 + Math.round((completedFiles / totalFiles) * 79));
  }

  const elapsedMs =
    typeof meta.accumulatedElapsedMs === 'number'
      ? Math.max(0, meta.accumulatedElapsedMs)
      : Math.max(0, (meta.updatedAt || meta.createdAt) - meta.createdAt);

  return {
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    completedFiles,
    totalFiles,
    folderCount: meta.folderCount,
    downloadedBytes: meta.downloadedBytes,
    totalBytesExpected: meta.totalBytesExpected,
    percent,
    scanCompleted,
    scannedFolders,
    elapsedMs,
    lastError: meta.lastError,
  };
};

export const loadZipAllCheckpointData = async (
  targetDirHandle: FileSystemDirectoryHandle | null = null
): Promise<{
  meta: ZipAllCheckpointMeta;
  blobs: StoredZipBlobRecord[];
} | null> => {
  try {
    const meta = await getZipAllCheckpointMeta(targetDirHandle);
    if (!meta) return null;

    let blobs: StoredZipBlobRecord[] = [];
    try {
      const db = await openCheckpointDB();
      const tx = db.transaction(BLOB_STORE, 'readonly');
      const blobsReq = tx.objectStore(BLOB_STORE).getAll();
      blobs = await new Promise<StoredZipBlobRecord[]>((resolve) => {
        blobsReq.onsuccess = () => resolve((blobsReq.result as StoredZipBlobRecord[]) || []);
        blobsReq.onerror = () => resolve([]);
      });
    } catch {
      blobs = [];
    }

    const existingPaths = new Set(blobs.map((b) => b.zipPath));
    const missingAnyBlob = (meta.completedItems || []).some((c) => !existingPaths.has(c.zipPath));
    if (missingAnyBlob) {
      const partialZipBlobs = await loadTempPartialZipBlobs(targetDirHandle);
      partialZipBlobs.forEach((blob, zipPath) => {
        if (!existingPaths.has(zipPath)) {
          blobs.push({ zipPath, blob });
          existingPaths.add(zipPath);
        }
      });
    }

    return { meta, blobs };
  } catch {
    return null;
  }
};

export const clearZipAllCheckpoint = async (): Promise<void> => {
  try {
    const db = await openCheckpointDB();
    const tx = db.transaction([META_STORE, BLOB_STORE], 'readwrite');
    tx.objectStore(META_STORE).clear();
    tx.objectStore(BLOB_STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Erro ao limpar checkpoint ZIP:', err);
  }
};

export const buildRecoveryManifest = (
  meta: ZipAllCheckpointMeta,
  status: 'in_progress' | 'error',
  errorMessage?: string
): RecoveryManifestFile => {
  const completedIds = new Set((meta.completedItems || []).map((c) => c.fileId));
  const fileById = new Map<string, CheckpointFileEntry>();
  for (const entry of meta.files) {
    fileById.set(entry.file.id, entry);
  }

  const capturedItems = (meta.completedItems || []).map((item) => ({
    fileId: item.fileId,
    name: fileById.get(item.fileId)?.file.name || item.zipPath.split('/').pop() || item.zipPath,
    zipPath: item.zipPath,
    byteSize: item.byteSize,
  }));

  const pendingItems = meta.files
    .filter((entry) => !completedIds.has(entry.file.id))
    .map((entry) => ({
      fileId: entry.file.id,
      name: entry.file.name,
      pathSegments: entry.pathSegments,
      size: entry.file.size,
    }));

  const now = Date.now();
  return {
    app: 'DriveSync Turbo',
    version: 1,
    status,
    startedAt: meta.createdAt,
    updatedAt: now,
    errorOccurredAt: status === 'error' ? now : undefined,
    errorMessage: errorMessage || meta.lastError,
    folderCount: meta.folderCount,
    totalFiles: meta.totalFiles,
    completedFilesCount: capturedItems.length,
    pendingFilesCount: pendingItems.length,
    downloadedBytes: meta.downloadedBytes,
    totalBytesExpected: meta.totalBytesExpected,
    capturedItems,
    pendingItems,
    checkpointMeta: {
      ...meta,
      updatedAt: now,
      lastError: errorMessage || meta.lastError,
    },
  };
};

export const saveTempRecoveryManifest = async (
  meta: ZipAllCheckpointMeta,
  targetDirHandle: FileSystemDirectoryHandle | null,
  status: 'in_progress' | 'error',
  errorMessage?: string,
  downloadFallbackOnError: boolean = false
): Promise<{ savedToDisk: boolean; downloadedToUser: boolean; fileName: string }> => {
  const manifest = buildRecoveryManifest(meta, status, errorMessage);
  const jsonText = JSON.stringify(manifest, null, 2);

  await saveZipAllCheckpointMeta(manifest.checkpointMeta);
  await writeOpfsTempFile(TEMP_RECOVERY_MANIFEST_NAME, jsonText);

  let savedToDisk = false;
  if (targetDirHandle) {
    try {
      const hasPerm = await verifyPermission(targetDirHandle, true);
      if (hasPerm) {
        savedToDisk = await writeFixedLocalFile(
          targetDirHandle,
          TEMP_RECOVERY_MANIFEST_NAME,
          jsonText
        );
      }
    } catch {
      savedToDisk = false;
    }
  }

  let downloadedToUser = false;
  if (status === 'error' && downloadFallbackOnError && !savedToDisk) {
    try {
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      triggerBrowserDownload(blob, TEMP_RECOVERY_MANIFEST_NAME);
      downloadedToUser = true;
    } catch {
      downloadedToUser = false;
    }
  }

  return {
    savedToDisk,
    downloadedToUser,
    fileName: TEMP_RECOVERY_MANIFEST_NAME,
  };
};

export const saveTempPartialZipOnError = async (
  zip: JSZip,
  targetDirHandle: FileSystemDirectoryHandle | null
): Promise<boolean> => {
  try {
    const partialBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'STORE',
    });

    let saved = false;
    if (targetDirHandle) {
      try {
        const hasPerm = await verifyPermission(targetDirHandle, true);
        if (hasPerm) {
          saved = await writeFixedLocalFile(targetDirHandle, TEMP_PARTIAL_ZIP_NAME, partialBlob);
        }
      } catch {
        saved = false;
      }
    }

    if (!saved) {
      saved = await writeOpfsTempFile(TEMP_PARTIAL_ZIP_NAME, partialBlob);
    }

    return saved;
  } catch (err) {
    console.warn('Não foi possível salvar ZIP parcial temporário:', err);
    return false;
  }
};

export const loadTempPartialZipBlobs = async (
  targetDirHandle: FileSystemDirectoryHandle | null
): Promise<Map<string, Blob>> => {
  const result = new Map<string, Blob>();
  try {
    let file: File | null = null;
    if (targetDirHandle) {
      file = await readLocalFileIfExists(targetDirHandle, TEMP_PARTIAL_ZIP_NAME);
    }
    if (!file) {
      file = await readOpfsTempFile(TEMP_PARTIAL_ZIP_NAME);
    }
    if (!file) return result;

    const loadedZip = await JSZip.loadAsync(file);
    const entries = Object.values(loadedZip.files);
    for (const entry of entries) {
      if (!entry.dir) {
        const blob = await entry.async('blob');
        result.set(entry.name, blob);
      }
    }
  } catch (err) {
    console.warn('Não foi possível ler ZIP parcial temporário:', err);
  }
  return result;
};

export const cleanupTempRecoveryFiles = async (
  targetDirHandle: FileSystemDirectoryHandle | null
): Promise<void> => {
  await clearZipAllCheckpoint();
  await deleteOpfsTempFile(TEMP_RECOVERY_MANIFEST_NAME);
  await deleteOpfsTempFile(TEMP_PARTIAL_ZIP_NAME);
  if (targetDirHandle) {
    try {
      const hasPerm = await verifyPermission(targetDirHandle, true);
      if (hasPerm) {
        await deleteLocalFileIfExists(targetDirHandle, TEMP_RECOVERY_MANIFEST_NAME);
        await deleteLocalFileIfExists(targetDirHandle, TEMP_PARTIAL_ZIP_NAME);
      }
    } catch {
      // ignore cleanup errors
    }
  }
};

export const importRecoveryManifestFromFile = async (
  file: File,
  targetDirHandle: FileSystemDirectoryHandle | null = null
): Promise<ZipAllCheckpointSummary | null> => {
  const raw = await file.text();
  const parsed = JSON.parse(raw) as Partial<RecoveryManifestFile>;
  const meta = parsed?.checkpointMeta;
  if (!isCheckpointUsable(meta)) {
    throw new Error('Arquivo de retomada inválido ou sem progresso capturado.');
  }

  const existingData = await loadZipAllCheckpointData(targetDirHandle);
  const existingPaths = new Set((existingData?.blobs || []).map((b) => b.zipPath));

  if ((meta.completedItems || []).some((c) => !existingPaths.has(c.zipPath))) {
    const partialBlobs = await loadTempPartialZipBlobs(targetDirHandle);
    partialBlobs.forEach((_blob, path) => existingPaths.add(path));
  }

  const validCompleted = (meta.completedItems || []).filter((c) => existingPaths.has(c.zipPath));

  const restoredMeta: ZipAllCheckpointMeta = {
    ...meta,
    id: 'active_session',
    updatedAt: Date.now(),
    completedItems: validCompleted,
    usedZipPathsLower: validCompleted.map((c) => c.zipPath.toLowerCase()),
    downloadedBytes: validCompleted.reduce((sum, c) => sum + (c.byteSize || 0), 0),
  };

  await saveZipAllCheckpointMeta(restoredMeta);
  await saveTempRecoveryManifest(restoredMeta, targetDirHandle, 'in_progress');
  return await getZipAllCheckpointSummary(targetDirHandle);
};
