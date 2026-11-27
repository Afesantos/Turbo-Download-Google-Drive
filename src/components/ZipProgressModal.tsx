import React, { useState, useEffect, useRef } from 'react';
import {
  Archive,
  X,
  Clock,
  HardDrive,
  FileText,
  Folder,
  Cloud,
  ArrowRight,
  RefreshCw,
  Search,
  Download,
  Layers,
} from 'lucide-react';
import { ZipAllProgress } from '../services/zipExport';
import { formatBytes } from '../utils/formatters';
import { computeZipTimingMetrics, formatDurationClock } from '../utils/zipTiming';
import { LiveSpeedChart } from './LiveSpeedChart';

interface ZipProgressModalProps {
  isOpen: boolean;
  selectedCount: number;
  progress: ZipAllProgress;
  localFolderName: string | null;
  concurrency?: number;
  turboMultiChunk?: boolean;
  onCancel: () => void;
  isCancelling: boolean;
}

const PHASE_LABELS: Record<ZipAllProgress['phase'], string> = {
  scanning: 'Varrendo e mapeando pastas do Google Drive...',
  downloading: 'Baixando arquivos em alta velocidade...',
  compressing: 'Gerando arquivo ZIP final...',
  saving: 'Gravando arquivo ZIP no destino...',
};

export const ZipProgressModal: React.FC<ZipProgressModalProps> = ({
  isOpen,
  selectedCount,
  progress,
  localFolderName,
  concurrency,
  turboMultiChunk,
  onCancel,
  isCancelling,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const now = Date.now();
    startTimeRef.current = now;
    setNowMs(now);
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const timing = computeZipTimingMetrics(progress, startTimeRef.current, nowMs);

  const isScanning = progress.phase === 'scanning';
  const isDownloadingPhase = progress.phase === 'downloading';
  const isCompressingPhase = progress.phase === 'compressing' || progress.phase === 'saving';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div
        className={`bg-gradient-to-br border-2 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden text-slate-100 my-auto transition-all duration-500 ${
          isScanning
            ? 'from-indigo-950/95 via-slate-900 to-slate-950 border-indigo-500/50 ring-4 ring-indigo-500/20 shadow-indigo-500/20'
            : isDownloadingPhase
            ? 'from-emerald-950/95 via-slate-900 to-slate-950 border-emerald-500/50 ring-4 ring-emerald-500/20 shadow-emerald-500/20'
            : 'from-purple-950/95 via-slate-900 to-slate-950 border-purple-500/50 ring-4 ring-purple-500/20 shadow-purple-500/20'
        }`}
      >
        {/* Dynamic Background Glow based on Phase */}
        <div
          className={`absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
            isScanning
              ? 'bg-indigo-500/20'
              : isDownloadingPhase
              ? 'bg-emerald-500/20'
              : 'bg-purple-500/20'
          }`}
        />
        <div
          className={`absolute -bottom-24 -left-24 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
            isScanning
              ? 'bg-blue-500/15'
              : isDownloadingPhase
              ? 'bg-teal-500/15'
              : 'bg-indigo-500/15'
          }`}
        />

        <div className="relative z-10">
          {/* Phase Banner Indicator (Leitura Drive vs Download em si) */}
          <div
            className={`mb-4 px-3.5 py-2 rounded-2xl border flex items-center justify-between gap-2 transition-all duration-300 ${
              isScanning
                ? 'bg-indigo-950/70 border-indigo-800/80 text-indigo-200'
                : isDownloadingPhase
                ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200'
                : 'bg-purple-950/70 border-purple-800/80 text-purple-200'
            }`}
          >
            <div className="flex items-center space-x-2 truncate">
              {isScanning ? (
                <Search className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
              ) : isDownloadingPhase ? (
                <Download className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
              ) : (
                <Layers className="w-4 h-4 text-purple-400 shrink-0 animate-spin" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider truncate">
                {isScanning
                  ? 'Fase 1: Leitura e Mapeamento no Google Drive'
                  : isDownloadingPhase
                  ? 'Fase 2: Download e Gravação dos Arquivos'
                  : 'Fase 3: Compactação ZIP Final'}
              </span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                isScanning
                  ? 'bg-indigo-900 text-indigo-300 border-indigo-700'
                  : isDownloadingPhase
                  ? 'bg-emerald-900 text-emerald-300 border-emerald-700'
                  : 'bg-purple-900 text-purple-300 border-purple-700'
              }`}
            >
              {isScanning ? 'Mapeando' : isDownloadingPhase ? 'Baixando' : 'Finalizando'}
            </span>
          </div>

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-tr text-white flex items-center justify-center shadow-lg transition-all duration-500 ${
                    isScanning
                      ? 'from-indigo-600 to-blue-600 shadow-indigo-600/30'
                      : isDownloadingPhase
                      ? 'from-emerald-600 to-teal-600 shadow-emerald-600/30'
                      : 'from-purple-600 to-indigo-600 shadow-purple-600/30'
                  }`}
                >
                  <Archive className="w-6 h-6" />
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border-2 flex items-center justify-center ${
                    isScanning ? 'border-indigo-400' : isDownloadingPhase ? 'border-emerald-400' : 'border-purple-400'
                  }`}
                >
                  <RefreshCw
                    className={`w-3 h-3 animate-spin ${
                      isScanning ? 'text-indigo-400' : isDownloadingPhase ? 'text-emerald-400' : 'text-purple-400'
                    }`}
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                    Baixar ZIP ({selectedCount} {selectedCount === 1 ? 'selecionado' : 'selecionados'})
                  </h3>
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
                <span>Decorrido</span>
              </div>
              <div
                className={`text-lg font-extrabold font-mono leading-tight ${
                  isScanning ? 'text-indigo-400' : isDownloadingPhase ? 'text-emerald-400' : 'text-purple-400'
                }`}
              >
                {timing.elapsedFormatted}
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Início: <strong className="text-slate-200">{timing.startClock}</strong>
              </div>
            </div>
          </div>

          {/* Em Curso Indicator + Live Read Speed Graph */}
          <div className="flex flex-col sm:flex-row items-center gap-4 my-3">
            <div className="relative w-22 h-22 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
              <div
                className={`absolute inset-0 rounded-full blur-md ${
                  isScanning ? 'bg-indigo-500/20' : isDownloadingPhase ? 'bg-emerald-500/20' : 'bg-purple-500/20'
                }`}
              />
              <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
              <div
                className={`absolute inset-0 rounded-full border-4 border-transparent animate-spin ${
                  isScanning ? 'border-t-indigo-400 border-r-blue-400' : isDownloadingPhase ? 'border-t-emerald-400 border-r-teal-400' : 'border-t-purple-400 border-r-indigo-400'
                }`}
              />
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-amber-400/80 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
              <div className="relative flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold font-mono text-white leading-none">
                  {progress.percent}%
                </span>
                <span
                  className={`text-[9px] uppercase tracking-wider font-bold mt-1 ${
                    isScanning ? 'text-indigo-400' : isDownloadingPhase ? 'text-emerald-400' : 'text-purple-400'
                  }`}
                >
                  {isCancelling ? 'Cancelando' : isScanning ? 'Mapeando' : 'Baixando'}
                </span>
              </div>
            </div>

            <LiveSpeedChart progress={progress} isActive={isOpen} accent={isScanning ? 'amber' : 'emerald'} />
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center space-x-2">
                <span
                  className={`w-2 h-2 rounded-full animate-ping ${
                    isScanning ? 'bg-indigo-400' : isDownloadingPhase ? 'bg-emerald-400' : 'bg-purple-400'
                  }`}
                />
                <span>
                  {isScanning
                    ? `Fase 1 (Mapeando Pastas e Arquivos): ${progress.percent}%`
                    : isDownloadingPhase
                    ? `Fase 2 (Baixando Arquivos): ${progress.percent}% (${progress.processedFiles}/${progress.totalFiles})`
                    : PHASE_LABELS[progress.phase]}
                </span>
              </span>
              <span
                className={`text-sm font-bold font-mono ${
                  isScanning ? 'text-indigo-400' : isDownloadingPhase ? 'text-emerald-400' : 'text-purple-400'
                }`}
              >
                {progress.percent}%
              </span>
            </div>

            <div className="w-full bg-slate-950 h-4 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-300 relative overflow-hidden ${
                  isScanning
                    ? 'bg-gradient-to-r from-indigo-500 via-blue-400 to-teal-400'
                    : isDownloadingPhase
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400'
                    : 'bg-gradient-to-r from-purple-500 via-indigo-400 to-pink-400'
                }`}
                style={{ width: `${Math.max(4, progress.percent)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 opacity-40 animate-[shimmer_2s_infinite] [background-image:linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] [background-size:20px_20px]" />
              </div>
            </div>
          </div>

          {/* Turbo Acceleration Engine Status Bar Badge */}
          {concurrency !== undefined && (
            <div className="mb-3 bg-slate-950/80 border border-slate-800/90 rounded-2xl px-3.5 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-bold text-amber-300">Motor de Aceleração Turbo:</span>
                <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                  {concurrency}x Threads
                </span>
              </div>
              <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                <span className="text-slate-400">Multi-Chunk:</span>
                <span className={turboMultiChunk ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {turboMultiChunk ? 'ATIVO (ON)' : 'OFF'}
                </span>
              </div>
            </div>
          )}

          {/* Live Counters Grid */}
          <div className="grid grid-cols-3 gap-2.5 mb-2.5">
            <div className="bg-slate-950/75 border border-slate-800 rounded-2xl p-2.5 sm:p-3">
              <div className="flex items-center space-x-1.5 text-[10px] uppercase font-bold text-slate-400">
                <FileText
                  className={`w-3.5 h-3.5 ${
                    isScanning ? 'text-indigo-400' : isDownloadingPhase ? 'text-emerald-400' : 'text-purple-400'
                  }`}
                />
                <span>Arquivos</span>
              </div>
              <div className="text-sm font-extrabold font-mono text-white mt-1">
                {progress.totalFiles > 0
                  ? `${progress.processedFiles} / ${progress.totalFiles}`
                  : 'Mapeando...'}
              </div>
            </div>

            <div className="bg-slate-950/75 border border-slate-800 rounded-2xl p-2.5 sm:p-3">
              <div className="flex items-center space-x-1.5 text-[10px] uppercase font-bold text-slate-400">
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>Pastas</span>
              </div>
              <div className="text-sm font-extrabold font-mono text-white mt-1">
                {progress.folderCount}
                {progress.discoveredFolders && progress.discoveredFolders > progress.folderCount
                  ? ` / ${progress.discoveredFolders}`
                  : ''}
              </div>
            </div>

            <div className="bg-slate-950/75 border border-slate-800 rounded-2xl p-2.5 sm:p-3">
              <div className="flex items-center space-x-1.5 text-[10px] uppercase font-bold text-slate-400">
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                <span>Transferido</span>
              </div>
              <div className="text-sm font-extrabold font-mono text-white mt-1">
                {formatBytes(progress.downloadedBytes)}
              </div>
            </div>
          </div>

          {/* Current File / Folder Name Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 mb-4 min-w-0">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 truncate">
              {isScanning ? '🔍 Pasta/Arquivo Lido no Drive:' : '📥 Arquivo Baixando:'}
            </div>
            <div className="text-xs font-mono font-medium text-slate-200 truncate" title={progress.currentItem}>
              {progress.currentItem || 'Iniciando operação...'}
            </div>
          </div>

          {/* Action Button: Cancel */}
          <div className="flex items-center justify-end">
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/30 active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>{isCancelling ? 'Cancelando...' : 'Cancelar Operação'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
