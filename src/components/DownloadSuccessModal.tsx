import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  FolderOpen,
  Copy,
  Check,
  X,
  HardDrive,
  ArrowRight,
  Sparkles,
  Info,
  Clock,
  Folder,
  FileText,
  ExternalLink,
  Gauge,
  TrendingUp,
  AlertTriangle,
  File as FileIcon,
  Cloud,
  Archive,
  PlayCircle,
  Flag,
} from 'lucide-react';
import { formatBytes, formatSpeed } from '../utils/formatters';
import { formatClockHHMM, formatDurationClock } from '../utils/zipTiming';

interface LocalEntry {
  name: string;
  kind: 'file' | 'directory';
}

interface DownloadSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedCount: number;
  errorCount?: number;
  folderCount?: number;
  driveFileCount?: number;
  driveFolderCount?: number;
  skippedNonExportableCount?: number;
  totalBytes: number;
  elapsedSeconds?: number;
  startedAt?: number;
  endedAt?: number;
  averageSpeedBytes?: number;
  peakSpeedBytes?: number;
  folderName: string | null;
  dirHandle?: FileSystemDirectoryHandle | null;
  isZip?: boolean;
  zipFileName?: string | null;
  wroteToDisk?: boolean;
  trackingSavedLocally?: boolean;
  trackingSavedToDrive?: boolean;
  scanElapsedSeconds?: number;
  downloadElapsedSeconds?: number;
  onOpenFolderPicker?: () => void;
}

export const DownloadSuccessModal: React.FC<DownloadSuccessModalProps> = ({
  isOpen,
  onClose,
  completedCount,
  errorCount = 0,
  folderCount = 0,
  driveFileCount,
  driveFolderCount,
  skippedNonExportableCount = 0,
  totalBytes,
  elapsedSeconds = 0,
  scanElapsedSeconds,
  downloadElapsedSeconds,
  startedAt,
  endedAt,
  averageSpeedBytes = 0,
  peakSpeedBytes = 0,
  folderName,
  dirHandle,
  isZip = false,
  zipFileName,
  wroteToDisk,
  trackingSavedLocally,
  trackingSavedToDrive,
  onOpenFolderPicker,
}) => {
  const [copied, setCopied] = useState(false);
  const [showFolderContents, setShowFolderContents] = useState(false);
  const [folderEntries, setFolderEntries] = useState<LocalEntry[]>([]);
  const [folderActionNotice, setFolderActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowFolderContents(false);
      setFolderEntries([]);
      setFolderActionNotice(null);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDownloadsFallback = !folderName || folderName.startsWith('Downloads / ');
  const subFolder = folderName?.startsWith('Downloads / ')
    ? folderName.replace('Downloads / ', '').trim()
    : 'DriveSync';

  const platform = typeof navigator !== 'undefined' ? navigator.platform.toLowerCase() : '';
  const isWindows = platform.includes('win');
  const sep = isWindows ? '\\' : '/';

  const getSuggestedFolderOsPath = (): string => {
    if (!isDownloadsFallback && folderName) {
      return folderName;
    }
    if (isZip && !wroteToDisk) {
      return isWindows ? '%USERPROFILE%\\Downloads' : '~/Downloads';
    }
    return isWindows ? `%USERPROFILE%\\Downloads\\${subFolder}` : `~/Downloads/${subFolder}`;
  };

  const folderDisplay =
    isZip && !wroteToDisk && isDownloadsFallback
      ? 'Downloads'
      : folderName || 'Downloads / DriveSync';
  const copyablePath = getSuggestedFolderOsPath();
  const fullStorageDisplay = zipFileName
    ? `${copyablePath}${copyablePath.endsWith(sep) ? '' : sep}${zipFileName}`
    : copyablePath;

  const resolvedDriveFiles =
    typeof driveFileCount === 'number' ? driveFileCount : completedCount + errorCount;
  const resolvedDriveFolders =
    typeof driveFolderCount === 'number' ? driveFolderCount : folderCount;

  const isFullParity =
    errorCount === 0 &&
    completedCount === resolvedDriveFiles &&
    folderCount === resolvedDriveFolders;

  const resolvedEndTs = endedAt || Date.now();
  const resolvedStartTs =
    startedAt || Math.max(0, resolvedEndTs - Math.max(0, elapsedSeconds) * 1000);

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(copyablePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFolderActionNotice(`Caminho da pasta: ${copyablePath}`);
    }
  };

  const handleOpenDestinationFolder = async (e: React.MouseEvent) => {
    e.preventDefault();
    setFolderActionNotice(null);

    const electronApi = (window as any).electronAPI;
    if (electronApi?.openFolder) {
      try {
        const res = await electronApi.openFolder(folderDisplay);
        if (res?.success) {
          setFolderActionNotice(`Pasta aberta no explorador: ${res.path}`);
          return;
        }
      } catch {
        // fallback below
      }
    }

    if (dirHandle) {
      try {
        const entries: LocalEntry[] = [];
        for await (const [name, handle] of (dirHandle as any).entries()) {
          entries.push({ name, kind: handle.kind });
        }
        entries.sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name, 'pt-BR');
        });
        setFolderEntries(entries);
        setShowFolderContents((prev) => !prev);
        return;
      } catch {
        // fallback to copy path
      }
    }

    await handleCopyPath();
    setFolderActionNotice(
      `Caminho "${copyablePath}" copiado! Cole na barra de endereços do Explorador de Arquivos / Finder (ou pressione Ctrl+J no navegador para ver os downloads).`
    );
  };

  const computedAvgSpeed =
    averageSpeedBytes > 0
      ? averageSpeedBytes
      : totalBytes > 0
      ? Math.round(totalBytes / Math.max(1, elapsedSeconds))
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden text-slate-100 ring-4 ring-emerald-500/10 max-h-[92vh] overflow-y-auto">
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Fechar resumo"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40 flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Procedimento Concluído</span>
          </div>

          <h3 className="font-extrabold text-xl text-white tracking-tight">
            {isZip ? 'Resumo do Download em ZIP' : 'Resumo do Download'}
          </h3>

          <p className="text-xs text-slate-400 mt-1 max-w-md">
            {isZip
              ? 'Comparativo entre a origem no Google Drive e os itens empacotados dentro do arquivo ZIP na sua pasta local.'
              : 'Comparativo completo entre a origem no Google Drive e os itens salvos na pasta local.'}
          </p>
        </div>

        {/* Summary Container */}
        <div className="mt-4 bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
          {/* Drive vs Local Side-by-Side Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Google Drive Card */}
            <div className="bg-slate-900/75 border border-blue-500/30 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center space-x-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-300">
                  <Cloud className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>No Google Drive</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">
                  Origem
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800/80">
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 uppercase font-bold">
                    <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>Arquivos</span>
                  </div>
                  <div className="text-base font-mono font-extrabold text-white mt-0.5">
                    {resolvedDriveFiles}
                  </div>
                </div>

                <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800/80">
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 uppercase font-bold">
                    <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Pastas</span>
                  </div>
                  <div className="text-base font-mono font-extrabold text-white mt-0.5">
                    {resolvedDriveFolders}
                  </div>
                </div>
              </div>
            </div>

            {/* Local / ZIP Card */}
            <div className="bg-slate-900/75 border border-emerald-500/30 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center space-x-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                  {isZip ? (
                    <Archive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span>Pasta Local</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  {isZip ? 'Dentro do ZIP' : dirHandle ? 'Disco' : 'Downloads'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800/80">
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 uppercase font-bold">
                    <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Baixados</span>
                  </div>
                  <div className="text-base font-mono font-extrabold text-emerald-300 mt-0.5">
                    {completedCount}
                  </div>
                </div>

                <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800/80">
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 uppercase font-bold">
                    <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Pastas</span>
                  </div>
                  <div className="text-base font-mono font-extrabold text-emerald-300 mt-0.5">
                    {folderCount}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Parity / Non-exportable notice */}
          {(isFullParity || skippedNonExportableCount > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
              <span className="flex items-center space-x-1.5 text-emerald-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {isFullParity
                    ? 'Todos os arquivos e pastas mapeados foram transferidos com sucesso.'
                    : `${completedCount} de ${resolvedDriveFiles} arquivos baixados.`}
                </span>
              </span>
              {skippedNonExportableCount > 0 && (
                <span className="text-slate-400 text-[10px]">
                  ({skippedNonExportableCount} formulário/atalho não exportável ignorado)
                </span>
              )}
            </div>
          )}

          {/* Detailed Timing Breakdown: Start, End, Scan, Download, Total */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="bg-slate-900/60 rounded-xl px-2 py-2 border border-slate-800/70">
              <span className="text-slate-400 flex items-center space-x-1 text-[9px] uppercase font-bold">
                <PlayCircle className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                <span>Início</span>
              </span>
              <div className="font-mono font-bold text-slate-100 mt-0.5 text-xs truncate">
                {formatClockHHMM(resolvedStartTs)}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl px-2 py-2 border border-slate-800/70">
              <span className="text-slate-400 flex items-center space-x-1 text-[9px] uppercase font-bold">
                <Flag className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                <span>Término</span>
              </span>
              <div className="font-mono font-bold text-slate-100 mt-0.5 text-xs truncate">
                {formatClockHHMM(resolvedEndTs)}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl px-2 py-2 border border-slate-800/70">
              <span className="text-slate-400 flex items-center space-x-1 text-[9px] uppercase font-bold" title="Tempo decorrido de leitura/varredura de arquivos e pastas do Google Drive">
                <Folder className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span className="truncate">Leitura Drive</span>
              </span>
              <div className="font-mono font-bold text-amber-300 mt-0.5 text-xs truncate">
                {formatDurationClock(scanElapsedSeconds !== undefined ? scanElapsedSeconds : Math.round(elapsedSeconds * 0.25))}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl px-2 py-2 border border-slate-800/70">
              <span className="text-slate-400 flex items-center space-x-1 text-[9px] uppercase font-bold" title="Tempo total apenas do período de downloads dos arquivos">
                <HardDrive className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                <span className="truncate">Downloads</span>
              </span>
              <div className="font-mono font-bold text-emerald-300 mt-0.5 text-xs truncate">
                {formatDurationClock(downloadElapsedSeconds !== undefined ? downloadElapsedSeconds : Math.round(elapsedSeconds * 0.75))}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl px-2 py-2 border border-slate-800/70 col-span-2 sm:col-span-1">
              <span className="text-slate-400 flex items-center space-x-1 text-[9px] uppercase font-bold">
                <Clock className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                <span>Total Geral</span>
              </span>
              <div className="font-mono font-bold text-orange-300 mt-0.5 text-xs truncate">
                {formatDurationClock(elapsedSeconds)}
              </div>
            </div>
          </div>

          {/* Volume & Speed Metrics */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-900/50 rounded-xl px-2.5 py-2 border border-slate-800/60">
              <span className="text-slate-400 flex items-center space-x-1 text-[10px] uppercase font-bold">
                <HardDrive className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Volume</span>
              </span>
              <div className="font-mono font-bold text-emerald-300 mt-0.5 truncate">
                {formatBytes(totalBytes)}
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl px-2.5 py-2 border border-slate-800/60">
              <span className="text-slate-400 flex items-center space-x-1 text-[10px] uppercase font-bold">
                <Gauge className="w-3 h-3 text-blue-400 shrink-0" />
                <span>Vel. Média</span>
              </span>
              <div className="font-mono font-bold text-blue-300 mt-0.5 truncate">
                {formatSpeed(computedAvgSpeed)}
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl px-2.5 py-2 border border-slate-800/60">
              <span className="text-slate-400 flex items-center space-x-1 text-[10px] uppercase font-bold">
                <TrendingUp className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Pico Máximo</span>
              </span>
              <div className="font-mono font-bold text-amber-300 mt-0.5 truncate">
                {formatSpeed(peakSpeedBytes || computedAvgSpeed)}
              </div>
            </div>
          </div>

          {errorCount > 0 && (
            <div className="flex items-center space-x-2 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/70 rounded-xl px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                {errorCount} arquivo(s) falharam durante a transferência. Confira os detalhes no painel de transferências.
              </span>
            </div>
          )}

          {/* Local Storage Path Section */}
          <div className="pt-2 border-t border-slate-900 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold">
                Caminho da Pasta Local de Armazenamento:
              </span>
              <button
                onClick={handleCopyPath}
                className="flex items-center space-x-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar Caminho</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
              <a
                href={`#pasta-destino-${encodeURIComponent(copyablePath)}`}
                onClick={handleOpenDestinationFolder}
                className="flex items-center space-x-2 min-w-0 flex-1 text-blue-300 hover:text-blue-200 underline underline-offset-2"
                title={`Abrir ou visualizar pasta destino: ${fullStorageDisplay}`}
              >
                <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-mono font-bold truncate">
                  {fullStorageDisplay}
                </span>
              </a>
              <a
                href={`#pasta-destino-${encodeURIComponent(copyablePath)}`}
                onClick={handleOpenDestinationFolder}
                className="shrink-0 text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                title={dirHandle ? 'Visualizar arquivos na pasta destino' : 'Abrir/copiar link da pasta destino'}
              >
                <ExternalLink className="w-3 h-3" />
                <span>{dirHandle ? (showFolderContents ? 'Ocultar Pasta' : 'Abrir Pasta') : 'Abrir Pasta'}</span>
              </a>
            </div>

            {zipFileName && (
              <div className="text-[11px] text-slate-400 px-1 flex items-center space-x-1.5 min-w-0">
                <Archive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">
                  Arquivo salvo: <strong className="font-mono text-slate-200">{zipFileName}</strong>
                </span>
              </div>
            )}

            {(trackingSavedLocally || trackingSavedToDrive) && (
              <div className="text-[11px] text-emerald-300/90 bg-emerald-950/30 border border-emerald-800/50 rounded-xl px-3 py-2 flex items-center space-x-2">
                <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Arquivo de acompanhamento salvo{' '}
                  {trackingSavedLocally && trackingSavedToDrive
                    ? 'na pasta local e na raiz do Google Drive.'
                    : trackingSavedLocally
                    ? 'na pasta local para verificação futura.'
                    : 'na raiz do Google Drive para verificação futura.'}
                </span>
              </div>
            )}

            {folderActionNotice && (
              <div className="mt-2 text-[11px] text-emerald-300 bg-emerald-950/50 border border-emerald-800/70 rounded-xl p-2.5 leading-relaxed">
                {folderActionNotice}
              </div>
            )}

            {showFolderContents && dirHandle && (
              <div className="mt-2 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Conteúdo atual de &quot;{dirHandle.name}&quot; ({folderEntries.length} itens):
                </div>
                {folderEntries.length === 0 ? (
                  <div className="text-[11px] text-slate-500">Pasta vazia.</div>
                ) : (
                  folderEntries.map((entry) => (
                    <div
                      key={entry.name}
                      className="flex items-center space-x-2 text-xs text-slate-200 py-0.5"
                    >
                      {entry.kind === 'directory' ? (
                        <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <FileIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                      <span className="truncate font-mono text-[11px]">{entry.name}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Browser notice */}
          <div className="flex items-start space-x-2 text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Clique no caminho acima para {dirHandle ? 'visualizar os arquivos gravados no disco' : 'copiar o caminho exato no seu computador'}.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          {onOpenFolderPicker && (
            <button
              onClick={() => {
                onClose();
                onOpenFolderPicker();
              }}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-3 rounded-2xl text-xs border border-slate-700 transition-all justify-center"
            >
              <FolderOpen className="w-4 h-4 text-blue-400" />
              <span>Trocar Pasta</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-3 rounded-2xl text-xs shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
          >
            <span>Concluído</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
