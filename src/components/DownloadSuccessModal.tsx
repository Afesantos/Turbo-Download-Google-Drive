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
} from 'lucide-react';
import { formatBytes, formatSpeed } from '../utils/formatters';

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
  totalBytes: number;
  elapsedSeconds?: number;
  averageSpeedBytes?: number;
  peakSpeedBytes?: number;
  folderName: string | null;
  dirHandle?: FileSystemDirectoryHandle | null;
  isZip?: boolean;
  onOpenFolderPicker?: () => void;
}

export const DownloadSuccessModal: React.FC<DownloadSuccessModalProps> = ({
  isOpen,
  onClose,
  completedCount,
  errorCount = 0,
  folderCount = 1,
  totalBytes,
  elapsedSeconds = 0,
  averageSpeedBytes = 0,
  peakSpeedBytes = 0,
  folderName,
  dirHandle,
  isZip = false,
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

  const getSuggestedOsPath = (): string => {
    if (!isDownloadsFallback && folderName) {
      return folderName;
    }
    const platform = typeof navigator !== 'undefined' ? navigator.platform.toLowerCase() : '';
    if (platform.includes('win')) {
      return `%USERPROFILE%\\Downloads\\${subFolder}`;
    }
    return `~/Downloads/${subFolder}`;
  };

  const folderDisplay = folderName || 'Downloads / DriveSync';
  const copyablePath = getSuggestedOsPath();

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

    // 1. Desktop Electron mode: open directly in OS File Explorer / Finder
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

    // 2. Native File System Access handle: inspect saved files/folders directly
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

    // 3. Standard browser mode: copy OS path and show clear instruction
    await handleCopyPath();
    setFolderActionNotice(
      `Caminho "${copyablePath}" copiado! Cole na barra de endereços do Explorador de Arquivos / Finder (ou pressione Ctrl+J no navegador para ver os downloads).`
    );
  };

  const formatElapsed = (sec: number): string => {
    const safe = Math.max(0, Math.floor(sec || 0));
    const hours = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const computedAvgSpeed =
    averageSpeedBytes > 0
      ? averageSpeedBytes
      : totalBytes > 0
      ? Math.round(totalBytes / Math.max(1, elapsedSeconds))
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden text-slate-100 ring-4 ring-emerald-500/10 max-h-[92vh] overflow-y-auto">
        {/* Glow accent */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40 flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Procedimento Concluído</span>
          </div>

          <h3 className="font-extrabold text-xl text-white tracking-tight">
            {isZip ? 'Arquivo ZIP Gerado!' : 'Estatísticas do Download'}
          </h3>

          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Resumo completo da transferência realizada mantendo a estrutura de pastas original.
          </p>
        </div>

        {/* Summary Card with Full Download Statistics */}
        <div className="mt-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
          {/* Primary Counters */}
          <div className="grid grid-cols-3 gap-2.5 pb-3 border-b border-slate-900">
            <div className="bg-slate-900/70 rounded-xl p-2.5 flex items-center space-x-2 border border-slate-800/70">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] text-slate-400 uppercase font-bold">Arquivos</div>
                <div className="text-sm font-mono font-bold text-white">{completedCount}</div>
              </div>
            </div>

            <div className="bg-slate-900/70 rounded-xl p-2.5 flex items-center space-x-2 border border-slate-800/70">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Folder className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] text-slate-400 uppercase font-bold">Pastas</div>
                <div className="text-sm font-mono font-bold text-white">{folderCount}</div>
              </div>
            </div>

            <div className="bg-slate-900/70 rounded-xl p-2.5 flex items-center space-x-2 border border-slate-800/70">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] text-slate-400 uppercase font-bold">Volume</div>
                <div className="text-xs font-mono font-bold text-emerald-400 truncate">
                  {formatBytes(totalBytes)}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Speed & Time Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex sm:flex-col justify-between bg-slate-900/50 rounded-xl px-3 py-2 border border-slate-800/60">
              <span className="text-slate-400 flex items-center space-x-1 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span>Tempo Gasto</span>
              </span>
              <span className="font-mono font-bold text-orange-300 sm:mt-0.5">
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>

            <div className="flex sm:flex-col justify-between bg-slate-900/50 rounded-xl px-3 py-2 border border-slate-800/60">
              <span className="text-slate-400 flex items-center space-x-1 text-[11px]">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                <span>Vel. Média</span>
              </span>
              <span className="font-mono font-bold text-blue-300 sm:mt-0.5">
                {formatSpeed(computedAvgSpeed)}
              </span>
            </div>

            <div className="flex sm:flex-col justify-between bg-slate-900/50 rounded-xl px-3 py-2 border border-slate-800/60">
              <span className="text-slate-400 flex items-center space-x-1 text-[11px]">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Pico Máximo</span>
              </span>
              <span className="font-mono font-bold text-amber-300 sm:mt-0.5">
                {formatSpeed(peakSpeedBytes || computedAvgSpeed)}
              </span>
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

          {/* Destination Folder Link Section */}
          <div className="pt-2 border-t border-slate-900">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">
                Link para a Pasta Destino:
              </span>
              <button
                onClick={handleCopyPath}
                className="flex items-center space-x-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
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

            <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center justify-between space-x-2">
              <a
                href={`#pasta-destino-${encodeURIComponent(copyablePath)}`}
                onClick={handleOpenDestinationFolder}
                className="flex items-center space-x-2 truncate text-blue-300 hover:text-blue-200 underline underline-offset-2 group"
                title={`Abrir ou visualizar pasta destino: ${copyablePath}`}
              >
                <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-mono font-bold truncate">
                  {folderDisplay}
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

          {/* Browser security notice */}
          <div className="flex items-start space-x-2 text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Clique no link da pasta destino acima para {dirHandle ? 'visualizar os arquivos gravados no disco' : 'copiar o caminho exato no seu computador'}.
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
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
