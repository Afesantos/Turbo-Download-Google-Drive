import { DriveFile } from './drive';

const DB_NAME = 'DriveSyncZipCheckpointDB';
const DB_VERSION = 1;
const META_STORE = 'meta';
const BLOB_STORE = 'blobs';
const SESSION_KEY = 'active_session';

export interface CheckpointFileEntry {
  file: DriveFile;
  pathSegments: string[];
}

export interface CompletedCheckpointItem {
  fileId: string;
  zipPath: string;
  byteSize: number;
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
}

export interface StoredZipBlobRecord {
  zipPath: string;
  blob: Blob;
}

const openCheckpointDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
    db.close();
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
    db.close();
  } catch (err) {
    console.warn('Não foi possível persistir arquivo no checkpoint ZIP:', err);
  }
};

export const getZipAllCheckpointMeta = async (): Promise<ZipAllCheckpointMeta | null> => {
  try {
    const db = await openCheckpointDB();
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get(SESSION_KEY);
    const result = await new Promise<ZipAllCheckpointMeta | null>((resolve) => {
      req.onsuccess = () => resolve((req.result as ZipAllCheckpointMeta) || null);
      req.onerror = () => resolve(null);
    });
    db.close();
    if (!result || !Array.isArray(result.files) || result.files.length === 0) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
};

export const getZipAllCheckpointSummary = async (): Promise<ZipAllCheckpointSummary | null> => {
  const meta = await getZipAllCheckpointMeta();
  if (!meta) return null;

  const completedFiles = meta.completedItems?.length || 0;
  const totalFiles = meta.totalFiles || meta.files.length;

  let percent = 10;
  if (meta.totalBytesExpected > 0) {
    percent = Math.min(89, 10 + Math.round((meta.downloadedBytes / meta.totalBytesExpected) * 79));
  } else if (totalFiles > 0) {
    percent = Math.min(89, 10 + Math.round((completedFiles / totalFiles) * 79));
  }

  return {
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    completedFiles,
    totalFiles,
    folderCount: meta.folderCount,
    downloadedBytes: meta.downloadedBytes,
    totalBytesExpected: meta.totalBytesExpected,
    percent,
  };
};

export const loadZipAllCheckpointData = async (): Promise<{
  meta: ZipAllCheckpointMeta;
  blobs: StoredZipBlobRecord[];
} | null> => {
  try {
    const db = await openCheckpointDB();
    const tx = db.transaction([META_STORE, BLOB_STORE], 'readonly');
    const metaReq = tx.objectStore(META_STORE).get(SESSION_KEY);
    const blobsReq = tx.objectStore(BLOB_STORE).getAll();

    const [meta, blobs] = await Promise.all([
      new Promise<ZipAllCheckpointMeta | null>((resolve) => {
        metaReq.onsuccess = () => resolve((metaReq.result as ZipAllCheckpointMeta) || null);
        metaReq.onerror = () => resolve(null);
      }),
      new Promise<StoredZipBlobRecord[]>((resolve) => {
        blobsReq.onsuccess = () => resolve((blobsReq.result as StoredZipBlobRecord[]) || []);
        blobsReq.onerror = () => resolve([]);
      }),
    ]);

    db.close();
    if (!meta || !Array.isArray(meta.files) || meta.files.length === 0) {
      return null;
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
    db.close();
  } catch (err) {
    console.warn('Erro ao limpar checkpoint ZIP:', err);
  }
};
