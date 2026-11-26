import React, { useEffect, useState } from 'react';
import {
  Archive,
  HardDrive,
  RefreshCw,
  Folder,
  FileText,
  Clock,
  Square,
} from 'lucide-react';
import { ZipAllProgress } from '../services/zipExport';
import { formatBytes } from '../utils/formatters';

interface ZipProgressModalProps {
  isOpen: boolean;
  isCancelling: boolean;
  progress: ZipAllProgress;
  localFolderName: string | null;
  selectedCount: number;
  onCancel: () => void;
}

const PHASE_LABELS: Record<ZipAllProgress['phase'], string> = {
  scanning: 'Mapeando Pastas',
  downloading: 'Baixando Arquivos',
  compressing: 'Compactando em .ZIP',
  saving: 'Salvando Arquivo .ZIP',
};

const formatDuration = (totalSeconds: number): string => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const ZipProgressModal: React.FC<ZipProgressModalProps> = ({
  isOpen,
  isCancelling,
  progress,
  localFolderName,
  selectedCount,
  onCancel,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/45 ring-4 ring-amber-500/15 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden text-slate-100 my-auto">
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Archive className="w-6 h-6" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border-2 border-amber-400 flex items-center justify-center">
                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                    Baixar ZIP ({selectedCount} {selectedCount === 1 ? 'selecionado' : 'selecionados'})
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                    {PHASE_LABELS[progress.phase]}
                  </span>
                </div>
                <p className="text-xs text-slate-300 flex items-center space-x-1.5 mt-1 min-w-0">
                  <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate max-w-full">
                    Destino:{' '}
                    <strong className="text-white font-mono">
                      {localFolderName || 'Downloads / DriveSync'}
                    </strong>
                  </span>
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-end space-x-1">
                <Clock className="w-3 h-3" />
                <span>Tempo</span>
              </div>
              <div className="text-lg font-extrabold font-mono text-amber-400">
                {formatDuration(elapsedSeconds)}
              </div>
            </div>
          </div>

          {/* Centered Spinning Circular Indicator */}
          <div className="flex flex-col items-center justify-center my-4">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-500/15 blur-md" />
              <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-400 border-r-orange-400 animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-emerald-400/80 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
              <div className="relative flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold font-mono text-white leading-none">
                  {progress.percent}%
                </span>
                <span className="text-[9px] uppercase tracking-wider font-bold text-amber-400 mt-1">
                  {isCancelling ? 'Cancelando' : 'Em Curso'}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 mb-5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>{PHASE_LABELS[progress.phase]}</span>
              </span>
              <span className="text-sm font-bold font-mono text-amber-400">
                {progress.percent}%
              </span>
            </div>

            <div className="w-full bg-slate-950 h-4 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-emerald-400 transition-all duration-300 relative overflow-hidden"
                style={{ width: `${Math.max(4, progress.percent)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 opacity-40 animate-[shimmer_2s_infinite] [background-image:linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] [background-size:20px_20px]" />
              </div>
            </div>
          </div>

          {/* Live Counters Grid */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            <div className="bg-slate-950/75 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center space-x-1.5 text-[10px] uppercase font-bold text-slate-400">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Arquivos</span>
              </div>
              <div className="text-sm font-extrabold font-mono text-white mt-1">
                {progress.totalFiles > 0
                  ? `${progress.processedFiles} / ${progress.totalFiles}`
                  : 'Mapeando...'}
              </div>
            </div>

            <div className="bg-slate-950/75 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center space-x-1.5 text-[10px] uppercase font-bold text-slate-400">
                <Folder className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pastas</span>
              </div>
              <div className="text-sm font-extrabold font-mono text-white mt-1">
                {progress.folderCount}
              </div>
            </div>

            <div className="bg-slate-950/75 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center space-x-1.5 text-[10px] uppercase font-bold text-slate-400">
                <Archive className="w-3.5 h-3.5 text-blue-400" />
                <span>Volume</span>
              </div>
              <div className="text-sm font-extrabold font-mono text-white mt-1 truncate">
                {formatBytes(progress.downloadedBytes)}
              </div>
            </div>
          </div>

          {/* Current Item */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 mb-6 flex items-center space-x-2.5 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                {progress.phase === 'scanning' ? 'Pasta Atual:' : 'Item Atual:'}
              </span>
              <span
                className="text-slate-200 font-semibold truncate block"
                title={progress.currentItem}
              >
                {progress.currentItem || 'Preparando operação...'}
              </span>
            </div>
          </div>

          {/* Footer with Prominent Cancel Button */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              {progress.totalBytesExpected > 0
                ? `Total estimado: ${formatBytes(progress.totalBytesExpected)}`
                : 'Compactando seleção em .ZIP'}
            </span>

            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl text-xs font-bold transition-all shadow-xl active:scale-95 bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-2 ring-rose-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isCancelling ? 'Cancelando...' : 'Cancelar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
