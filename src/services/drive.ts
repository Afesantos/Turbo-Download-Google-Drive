/**
 * Google Drive API v3 High-Speed Service
 * Handles listing, folder traversal, streaming download, multi-threaded acceleration,
 * and export conversions for Google Workspace native files.
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string; // bytes as string from API
  modifiedTime?: string;
  md5Checksum?: string;
  iconLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  isFolder: boolean;
  exportFormat?: {
    mimeType: string;
    extension: string;
  };
}

export interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

// Map Google Docs / Sheets / Slides to export configurations
export const GOOGLE_WORKSPACE_EXPORTS: Record<string, { mimeType: string; extension: string }> = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: '.docx',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: '.pptx',
  },
  'application/vnd.google-apps.drawing': {
    mimeType: 'image/png',
    extension: '.png',
  },
  'application/vnd.google-apps.script': {
    mimeType: 'application/vnd.google-apps.script+json',
    extension: '.json',
  },
};

export const NON_EXPORTABLE_WORKSPACE_TYPES = new Set<string>([
  'application/vnd.google-apps.folder',
  'application/vnd.google-apps.form',
  'application/vnd.google-apps.site',
  'application/vnd.google-apps.map',
  'application/vnd.google-apps.shortcut',
  'application/vnd.google-apps.fusiontable',
  'application/vnd.google-apps.drive-sdk',
]);

export const isGoogleWorkspaceDoc = (mimeType: string): boolean => {
  return mimeType.startsWith('application/vnd.google-apps.') && mimeType !== 'application/vnd.google-apps.folder';
};

const createDriveApiError = async (
  response: Response,
  fallbackMessage: string
): Promise<Error & { status?: number }> => {
  const errorData = await response.json().catch(() => ({}));
  const rawMessage: string = errorData?.error?.message || '';

  if (response.status === 401 || rawMessage.toLowerCase().includes('invalid authentication credentials')) {
    const err: any = new Error(
      'Sessão ou token do Google Drive expirado (limite de 1 hora). Clique para renovar o acesso e continuar de onde parou.'
    );
    err.status = 401;
    err.rawMessage = rawMessage;
    return err;
  }

  const err: any = new Error(rawMessage || `${fallbackMessage} (${response.status})`);
  err.status = response.status;
  return err;
};

/**
 * List files and folders in a specific parent folder or root
 */
export const listDriveFiles = async (
  accessToken: string,
  folderId: string = 'root',
  queryFilter: string = '',
  pageToken?: string,
  pageSize: number = 200,
  signal?: AbortSignal
): Promise<DriveListResponse> => {
  let allFiles: DriveFile[] = [];
  let currentToken: string | undefined = pageToken;

  do {
    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
    }

    let q = `'${folderId}' in parents and trashed = false`;
    if (queryFilter.trim()) {
      q += ` and name contains '${queryFilter.replace(/'/g, "\\'")}'`;
    }

    const fields = 'nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum, iconLink, thumbnailLink, parents)';
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('pageSize', pageSize.toString());
    url.searchParams.set('fields', fields);
    url.searchParams.set('orderBy', 'folder,name');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (currentToken) {
      url.searchParams.set('pageToken', currentToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });

    if (!response.ok) {
      throw await createDriveApiError(response, 'Erro ao carregar arquivos do Drive');
    }

    const data = await response.json();
    const files: DriveFile[] = (data.files || []).map((f: any) => {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
      const exportConfig = GOOGLE_WORKSPACE_EXPORTS[f.mimeType];
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        modifiedTime: f.modifiedTime,
        md5Checksum: f.md5Checksum,
        iconLink: f.iconLink,
        thumbnailLink: f.thumbnailLink,
        parents: f.parents,
        isFolder,
        exportFormat: exportConfig,
      };
    });

    allFiles.push(...files);
    currentToken = data.nextPageToken;
  } while (currentToken);

  return {
    files: allFiles,
    nextPageToken: undefined,
  };
};

/**
 * Get details of a single file or folder
 */
export const getDriveFileMeta = async (
  accessToken: string,
  fileId: string
): Promise<DriveFile> => {
  const fields = 'id, name, mimeType, size, modifiedTime, md5Checksum, iconLink, thumbnailLink, parents';
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw await createDriveApiError(response, 'Erro ao obter metadados do arquivo');
  }

  const f = await response.json();
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    modifiedTime: f.modifiedTime,
    md5Checksum: f.md5Checksum,
    iconLink: f.iconLink,
    thumbnailLink: f.thumbnailLink,
    parents: f.parents,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    exportFormat: GOOGLE_WORKSPACE_EXPORTS[f.mimeType],
  };
};

/**
 * Recursively list all files in a folder hierarchy.
 * Returns file list with relative path segments.
 */
export interface FileWithPath {
  file: DriveFile;
  pathSegments: string[];
}

export interface RecursiveScanProgress {
  scannedFolders: number;
  discoveredFolders: number;
  currentFolder: string;
}

export const listAllFilesRecursively = async (
  accessToken: string,
  folderId: string,
  currentPath: string[] = [],
  visitedFolderIds: Set<string> = new Set(),
  onFolderVisited?: (pathSegments: string[]) => void,
  signal?: AbortSignal,
  onScanProgress?: (info: RecursiveScanProgress) => void,
  scanTracker: { scannedFolders: number; discoveredFolders: number } = {
    scannedFolders: 0,
    discoveredFolders: 1,
  }
): Promise<FileWithPath[]> => {
  if (signal?.aborted) {
    throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
  }
  if (visitedFolderIds.has(folderId)) return [];
  visitedFolderIds.add(folderId);

  if (currentPath.length > 0 && onFolderVisited) {
    onFolderVisited(currentPath);
  }

  const result: FileWithPath[] = [];
  const resp = await listDriveFiles(accessToken, folderId, '', undefined, 1000, signal);

  const childFolders = resp.files.filter((item) => item.isFolder && !visitedFolderIds.has(item.id));
  scanTracker.discoveredFolders += childFolders.length;
  scanTracker.scannedFolders += 1;

  onScanProgress?.({
    scannedFolders: scanTracker.scannedFolders,
    discoveredFolders: scanTracker.discoveredFolders,
    currentFolder: currentPath.join(' / ') || 'Meu Drive',
  });

  for (const item of resp.files) {
    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário.', 'AbortError');
    }
    if (item.isFolder) {
      const subFiles = await listAllFilesRecursively(
        accessToken,
        item.id,
        [...currentPath, item.name],
        visitedFolderIds,
        onFolderVisited,
        signal,
        onScanProgress,
        scanTracker
      );
      result.push(...subFiles);
    } else if (!NON_EXPORTABLE_WORKSPACE_TYPES.has(item.mimeType)) {
      result.push({
        file: item,
        pathSegments: currentPath,
      });
    }
  }
  return result;
};

/**
 * Ultra-fast direct streaming download from Google Drive
 * Uses HTTP streaming response with progress tracking.
 */
export const downloadFileStream = async (
  accessToken: string,
  file: DriveFile,
  onProgress?: (bytesDownloaded: number, totalBytes: number | undefined) => void,
  signal?: AbortSignal
): Promise<{
  stream: ReadableStream<Uint8Array>;
  totalBytes?: number;
  finalFileName: string;
}> => {
  let downloadUrl: string;
  let finalFileName = file.name;

  if (isGoogleWorkspaceDoc(file.mimeType)) {
    if (NON_EXPORTABLE_WORKSPACE_TYPES.has(file.mimeType)) {
      throw new Error(`O tipo "${file.mimeType.replace('application/vnd.google-apps.', '')}" não suporta download/exportação direta pelo Drive.`);
    }
    const exportConfig = file.exportFormat || GOOGLE_WORKSPACE_EXPORTS[file.mimeType] || {
      mimeType: 'application/pdf',
      extension: '.pdf',
    };
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportConfig.mimeType)}`;
    if (!finalFileName.endsWith(exportConfig.extension)) {
      finalFileName += exportConfig.extension;
    }
  } else {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;
  }

  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (!response.ok) {
    throw await createDriveApiError(response, `Falha no download (${response.statusText})`);
  }

  if (!response.body) {
    throw new Error('Corpo de resposta vazio recebido do Google Drive.');
  }

  const contentLengthHeader = response.headers.get('Content-Length');
  const totalBytes = contentLengthHeader
    ? parseInt(contentLengthHeader, 10)
    : file.size
    ? parseInt(file.size, 10)
    : undefined;

  let downloaded = 0;
  const originalReader = response.body.getReader();

  const monitoredStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await originalReader.read();
        if (done) {
          controller.close();
          return;
        }
        if (value) {
          downloaded += value.byteLength;
          if (onProgress) {
            onProgress(downloaded, totalBytes);
          }
          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      originalReader.cancel(reason);
    },
  });

  return {
    stream: monitoredStream,
    totalBytes,
    finalFileName,
  };
};

/**
 * Multi-Range Chunk Accelerated Downloader for large binary files (>16MB)
 * Downloads multiple byte segments concurrently and stitches them,
 * maxing out throughput.
 */
export const downloadLargeFileMultiChunk = async (
  accessToken: string,
  file: DriveFile,
  numChunks: number = 4,
  onProgress?: (bytesDownloaded: number, totalBytes: number) => void,
  signal?: AbortSignal
): Promise<{
  blob: Blob;
  finalFileName: string;
}> => {
  const totalBytes = parseInt(file.size || '0', 10);
  if (!totalBytes || totalBytes < 16 * 1024 * 1024 || isGoogleWorkspaceDoc(file.mimeType)) {
    // Fall back to direct stream
    const { stream, finalFileName } = await downloadFileStream(
      accessToken,
      file,
      (b, t) => {
        if (onProgress && t) onProgress(b, t);
      },
      signal
    );
    const response = new Response(stream);
    const blob = await response.blob();
    return { blob, finalFileName };
  }

  const chunkSize = Math.ceil(totalBytes / numChunks);
  const chunkRanges: { start: number; end: number }[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min((i + 1) * chunkSize - 1, totalBytes - 1);
    chunkRanges.push({ start, end });
  }

  let totalDownloaded = 0;
  const chunkProgress = new Array(numChunks).fill(0);

  const downloadPromises = chunkRanges.map(async (range, index) => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Range: `bytes=${range.start}-${range.end}`,
      },
      signal,
    });

    if (res.status === 401) {
      throw await createDriveApiError(res, 'Sessão expirada durante download em partes');
    }

    if (res.status !== 206) {
      throw new Error(`RANGE_NOT_SUPPORTED:${res.status}`);
    }

    if (!res.body) {
      throw new Error('Sem corpo no chunk');
    }

    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        parts.push(value);
        chunkProgress[index] += value.byteLength;
        totalDownloaded = chunkProgress.reduce((a, b) => a + b, 0);
        if (onProgress) {
          onProgress(totalDownloaded, totalBytes);
        }
      }
    }

    return new Blob(parts as BlobPart[]);
  });

  try {
    const downloadedBlobs = await Promise.all(downloadPromises);
    const finalBlob = new Blob(downloadedBlobs, { type: file.mimeType });

    return {
      blob: finalBlob,
      finalFileName: file.name,
    };
  } catch (err: any) {
    if (err?.message?.startsWith('RANGE_NOT_SUPPORTED:')) {
      const { stream, finalFileName } = await downloadFileStream(
        accessToken,
        file,
        (b, t) => {
          if (onProgress) onProgress(b, t || totalBytes);
        },
        signal
      );
      const response = new Response(stream);
      const blob = await response.blob();
      return { blob, finalFileName };
    }
    throw err;
  }
};
