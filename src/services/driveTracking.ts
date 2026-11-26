import {
  DRIVE_TRACKING_FILE_NAME,
  DriveFile,
  FileWithPath,
  NON_EXPORTABLE_WORKSPACE_TYPES,
} from './drive';
import {
  deleteLocalFileIfExists,
  deleteOpfsTempFile,
  readLocalFileIfExists,
  readOpfsTempFile,
  verifyPermission,
  writeFixedLocalFile,
  writeOpfsTempFile,
} from './localFileSystem';

export interface DriveTrackingFile {
  app: 'DriveSync Turbo';
  version: 1;
  createdAt: number;
  updatedAt: number;
  startedAt: number;
  endedAt: number;
  source: 'full_drive_zip' | 'direct_download' | 'selected_zip';
  totalFilesCount: number;
  folderCount: number;
  totalBytesExpected: number;
  skippedNonExportableCount: number;
  uniqueFolders: string[];
  files: FileWithPath[];
}

export interface DriveTrackingDriveEntry {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

export interface DriveTrackingCheckResult {
  foundLocation: 'local_folder' | 'local_storage' | 'drive_root';
  driveFileId?: string;
  driveFileModifiedTime?: string;
  trackingData: DriveTrackingFile;
  reportedFileCount: number;
  currentDriveFileCount: number;
  isSameCount: boolean;
}

const createTrackingError = async (res: Response, fallback: string): Promise<Error & { status?: number }> => {
  const errJson = await res.json().catch(() => ({}));
  const msg = errJson?.error?.message || `${fallback} (${res.status})`;
  const err: Error & { status?: number } = new Error(msg);
  err.status = res.status;
  return err;
};

const parseTrackingJson = (raw: string): DriveTrackingFile | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<DriveTrackingFile>;
    if (!parsed || typeof parsed.totalFilesCount !== 'number' || !Array.isArray(parsed.files)) {
      return null;
    }
    return {
      app: 'DriveSync Turbo',
      version: 1,
      createdAt: parsed.createdAt || parsed.updatedAt || Date.now(),
      updatedAt: parsed.updatedAt || parsed.createdAt || Date.now(),
      startedAt: parsed.startedAt || parsed.createdAt || Date.now(),
      endedAt: parsed.endedAt || parsed.updatedAt || Date.now(),
      source: parsed.source || 'full_drive_zip',
      totalFilesCount: parsed.totalFilesCount,
      folderCount: parsed.folderCount || 0,
      totalBytesExpected: parsed.totalBytesExpected || 0,
      skippedNonExportableCount: parsed.skippedNonExportableCount || 0,
      uniqueFolders: Array.isArray(parsed.uniqueFolders) ? parsed.uniqueFolders : [],
      files: parsed.files as FileWithPath[],
    };
  } catch {
    return null;
  }
};

/**
 * Priority 1: Check the user's local machine (selected disk folder first; OPFS fallback when no disk handle).
 */
export const readTrackingFileFromLocalMachine = async (
  targetDirHandle: FileSystemDirectoryHandle | null
): Promise<{ trackingData: DriveTrackingFile; foundLocation: 'local_folder' | 'local_storage' } | null> => {
  if (targetDirHandle) {
    try {
      const localFile = await readLocalFileIfExists(targetDirHandle, DRIVE_TRACKING_FILE_NAME);
      if (localFile) {
        const parsed = parseTrackingJson(await localFile.text());
        if (parsed) {
          return { trackingData: parsed, foundLocation: 'local_folder' };
        }
      }
    } catch {
      // Fall through cleanly so Drive root can still be checked if local read fails
    }
    return null;
  }

  try {
    const opfsFile = await readOpfsTempFile(DRIVE_TRACKING_FILE_NAME);
    if (opfsFile) {
      const parsed = parseTrackingJson(await opfsFile.text());
      if (parsed) {
        return { trackingData: parsed, foundLocation: 'local_storage' };
      }
    }
  } catch {
    // ignore OPFS read errors
  }

  return null;
};

export const saveTrackingFileLocally = async (
  targetDirHandle: FileSystemDirectoryHandle | null,
  payload: DriveTrackingFile
): Promise<boolean> => {
  const jsonText = JSON.stringify(payload);
  let saved = false;

  if (targetDirHandle) {
    try {
      const hasPerm = await verifyPermission(targetDirHandle, true);
      if (hasPerm) {
        saved = await writeFixedLocalFile(targetDirHandle, DRIVE_TRACKING_FILE_NAME, jsonText);
      }
    } catch {
      saved = false;
    }
  }

  const savedOpfs = await writeOpfsTempFile(DRIVE_TRACKING_FILE_NAME, jsonText);
  return saved || savedOpfs;
};

export const deleteTrackingFileLocally = async (
  targetDirHandle: FileSystemDirectoryHandle | null
): Promise<void> => {
  await deleteOpfsTempFile(DRIVE_TRACKING_FILE_NAME);
  if (targetDirHandle) {
    try {
      const hasPerm = await verifyPermission(targetDirHandle, true);
      if (hasPerm) {
        await deleteLocalFileIfExists(targetDirHandle, DRIVE_TRACKING_FILE_NAME);
      }
    } catch {
      // ignore local delete errors
    }
  }
};

export const findTrackingFilesInDriveRoot = async (
  accessToken: string,
  signal?: AbortSignal
): Promise<DriveTrackingDriveEntry[]> => {
  const q = `'root' in parents and name = '${DRIVE_TRACKING_FILE_NAME}' and trashed = false`;
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', 'files(id, name, modifiedTime, size)');
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('pageSize', '10');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (!res.ok) {
    throw await createTrackingError(res, 'Erro ao procurar arquivo de acompanhamento no Google Drive');
  }

  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
};

export const downloadTrackingFileFromDrive = async (
  accessToken: string,
  fileId: string,
  signal?: AbortSignal
): Promise<DriveTrackingFile | null> => {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (!res.ok) {
    throw await createTrackingError(res, 'Erro ao ler arquivo de acompanhamento do Google Drive');
  }

  const raw = await res.text();
  return parseTrackingJson(raw);
};

interface FlatDriveRecord {
  id: string;
  name?: string;
  mimeType: string;
  parents?: string[];
}

const fetchAllMatchingFlat = async (
  accessToken: string,
  q: string,
  fields: string,
  signal?: AbortSignal
): Promise<FlatDriveRecord[]> => {
  const records: FlatDriveRecord[] = [];
  let pageToken: string | undefined;

  do {
    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
    }
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('fields', `nextPageToken, files(${fields})`);
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });

    if (!res.ok) {
      throw await createTrackingError(res, 'Erro ao contar arquivos do Google Drive');
    }

    const data = await res.json();
    if (Array.isArray(data.files)) {
      records.push(...data.files);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return records;
};

/**
 * Counts all compatible (exportable/downloadable) files reachable from the user's Google Drive root
 * using flat batched queries + in-memory BFS folder tree filtering, matching scanDriveRecursivelyResumable.
 */
export const countCompatibleFilesInDriveRootTree = async (
  accessToken: string,
  signal?: AbortSignal
): Promise<number> => {
  const rootMetaPromise = fetch(
    'https://www.googleapis.com/drive/v3/files/root?fields=id&supportsAllDrives=true',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    }
  ).then(async (res) => {
    if (!res.ok) {
      throw await createTrackingError(res, 'Erro ao consultar pasta raiz do Google Drive');
    }
    return (await res.json()) as { id?: string };
  });

  const foldersPromise = fetchAllMatchingFlat(
    accessToken,
    "trashed = false and mimeType = 'application/vnd.google-apps.folder'",
    'id, parents',
    signal
  );

  const filesPromise = fetchAllMatchingFlat(
    accessToken,
    "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
    'id, name, mimeType, parents',
    signal
  );

  const [rootMeta, folders, files] = await Promise.all([
    rootMetaPromise,
    foldersPromise,
    filesPromise,
  ]);

  const canonicalRootId = rootMeta?.id || 'root';
  const childrenByParent = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parents) continue;
    for (const parentId of folder.parents) {
      const list = childrenByParent.get(parentId);
      if (list) {
        list.push(folder.id);
      } else {
        childrenByParent.set(parentId, [folder.id]);
      }
    }
  }

  // BFS from root to match exact folders reachable by recursive traversal
  const reachableFolders = new Set<string>([canonicalRootId, 'root']);
  const queue: string[] = [canonicalRootId, 'root'];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenByParent.get(currentId);
    if (!children) continue;
    for (const childId of children) {
      if (!reachableFolders.has(childId)) {
        reachableFolders.add(childId);
        queue.push(childId);
      }
    }
  }

  const seenFileIds = new Set<string>();
  for (const file of files) {
    if (seenFileIds.has(file.id)) continue;
    if (NON_EXPORTABLE_WORKSPACE_TYPES.has(file.mimeType)) continue;
    if (!file.parents || !file.parents.some((p) => reachableFolders.has(p))) continue;
    // Exclude the root tracking file itself from comparison
    if (
      file.name === DRIVE_TRACKING_FILE_NAME &&
      file.parents.some((p) => p === canonicalRootId || p === 'root')
    ) {
      continue;
    }
    seenFileIds.add(file.id);
  }

  return seenFileIds.size;
};

/**
 * Checks for the tracking file on startup:
 * 1) Priority 1: Local folder / storage on the user's machine.
 * 2) Priority 2: Google Drive root folder ONLY if not found locally.
 * Compares the reported file count with the current Google Drive file count.
 */
export const checkDriveTrackingWithLocalPriority = async (
  accessToken: string,
  targetDirHandle: FileSystemDirectoryHandle | null,
  signal?: AbortSignal
): Promise<DriveTrackingCheckResult | null> => {
  const localMatch = await readTrackingFileFromLocalMachine(targetDirHandle);

  if (localMatch) {
    const currentDriveFileCount = await countCompatibleFilesInDriveRootTree(accessToken, signal);
    const reportedFileCount =
      Array.isArray(localMatch.trackingData.files) && localMatch.trackingData.files.length > 0
        ? localMatch.trackingData.files.length
        : localMatch.trackingData.totalFilesCount;

    return {
      foundLocation: localMatch.foundLocation,
      trackingData: localMatch.trackingData,
      reportedFileCount,
      currentDriveFileCount,
      isSameCount: reportedFileCount === currentDriveFileCount,
    };
  }

  // Only search Google Drive root if no local tracking file was found
  const driveMatches = await findTrackingFilesInDriveRoot(accessToken, signal);
  if (driveMatches.length === 0) {
    return null;
  }

  const latest = driveMatches[0];
  const [trackingData, currentDriveFileCount] = await Promise.all([
    downloadTrackingFileFromDrive(accessToken, latest.id, signal),
    countCompatibleFilesInDriveRootTree(accessToken, signal),
  ]);

  if (!trackingData) {
    return null;
  }

  const reportedFileCount =
    Array.isArray(trackingData.files) && trackingData.files.length > 0
      ? trackingData.files.length
      : trackingData.totalFilesCount;

  return {
    foundLocation: 'drive_root',
    driveFileId: latest.id,
    driveFileModifiedTime: latest.modifiedTime,
    trackingData,
    reportedFileCount,
    currentDriveFileCount,
    isSameCount: reportedFileCount === currentDriveFileCount,
  };
};

export const buildDriveTrackingPayload = (params: {
  files: FileWithPath[];
  uniqueFolders: string[];
  totalBytesExpected?: number;
  skippedNonExportableCount?: number;
  startedAt: number;
  endedAt: number;
  source: DriveTrackingFile['source'];
}): DriveTrackingFile => {
  const sanitizedFiles: FileWithPath[] = params.files.map((entry) => ({
    file: {
      id: entry.file.id,
      name: entry.file.name,
      mimeType: entry.file.mimeType,
      size: entry.file.size,
      modifiedTime: entry.file.modifiedTime,
      md5Checksum: entry.file.md5Checksum,
      parents: entry.file.parents,
      isFolder: entry.file.isFolder,
      exportFormat: entry.file.exportFormat,
    } as DriveFile,
    pathSegments: entry.pathSegments,
  }));

  const computedBytes =
    typeof params.totalBytesExpected === 'number'
      ? params.totalBytesExpected
      : sanitizedFiles.reduce((sum, item) => sum + parseInt(item.file.size || '0', 10), 0);

  return {
    app: 'DriveSync Turbo',
    version: 1,
    createdAt: params.startedAt,
    updatedAt: params.endedAt,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    source: params.source,
    totalFilesCount: sanitizedFiles.length,
    folderCount: params.uniqueFolders.length,
    totalBytesExpected: computedBytes,
    skippedNonExportableCount: params.skippedNonExportableCount || 0,
    uniqueFolders: params.uniqueFolders,
    files: sanitizedFiles,
  };
};

export const saveTrackingFileToDriveRoot = async (
  accessToken: string,
  payload: DriveTrackingFile
): Promise<{ fileId: string; updated: boolean }> => {
  const existing = await findTrackingFilesInDriveRoot(accessToken);
  const existingId = existing[0]?.id;

  const metadata = existingId
    ? {
        name: DRIVE_TRACKING_FILE_NAME,
        mimeType: 'application/json',
      }
    : {
        name: DRIVE_TRACKING_FILE_NAME,
        mimeType: 'application/json',
        parents: ['root'],
      };

  const boundary = `drivesync_boundary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`;

  const uploadUrl = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=multipart&supportsAllDrives=true`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true';

  const res = await fetch(uploadUrl, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    throw await createTrackingError(res, 'Erro ao salvar arquivo de acompanhamento no Google Drive');
  }

  const saved = await res.json();

  if (existing.length > 1) {
    for (let i = 1; i < existing.length; i++) {
      try {
        await deleteTrackingFileFromDriveRoot(accessToken, existing[i].id);
      } catch {
        // ignore duplicate cleanup errors
      }
    }
  }

  return {
    fileId: saved.id || existingId || '',
    updated: Boolean(existingId),
  };
};

export const deleteTrackingFileFromDriveRoot = async (
  accessToken: string,
  fileId?: string
): Promise<void> => {
  const idsToDelete: string[] = [];
  if (fileId) {
    idsToDelete.push(fileId);
  } else {
    const existing = await findTrackingFilesInDriveRoot(accessToken);
    existing.forEach((f) => idsToDelete.push(f.id));
  }

  for (const id of idsToDelete) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (!res.ok && res.status !== 404) {
      throw await createTrackingError(res, 'Erro ao excluir arquivo de acompanhamento do Google Drive');
    }
  }
};

export const saveTrackingFileEverywhere = async (
  accessToken: string,
  targetDirHandle: FileSystemDirectoryHandle | null,
  payload: DriveTrackingFile
): Promise<{ savedLocally: boolean; savedToDrive: boolean }> => {
  const [localResult, driveResult] = await Promise.allSettled([
    saveTrackingFileLocally(targetDirHandle, payload),
    saveTrackingFileToDriveRoot(accessToken, payload),
  ]);

  const savedLocally = localResult.status === 'fulfilled' && Boolean(localResult.value);
  const savedToDrive = driveResult.status === 'fulfilled';

  if (driveResult.status === 'rejected') {
    console.warn('Aviso: não foi possível salvar arquivo de acompanhamento na raiz do Google Drive:', driveResult.reason);
  }

  return { savedLocally, savedToDrive };
};

export const deleteTrackingFileEverywhere = async (
  accessToken: string,
  targetDirHandle: FileSystemDirectoryHandle | null,
  driveFileId?: string
): Promise<void> => {
  await Promise.allSettled([
    deleteTrackingFileLocally(targetDirHandle),
    deleteTrackingFileFromDriveRoot(accessToken, driveFileId),
  ]);
};
