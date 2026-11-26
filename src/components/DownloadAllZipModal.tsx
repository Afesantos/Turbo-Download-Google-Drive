import React, { useEffect, useState } from 'react';
import {
  Archive,
  ShieldAlert,
  X,
  CheckCircle,
  HardDrive,
  RefreshCw,
  Folder,
  FileText,
  Clock,
  Square,
  RotateCcw,
  Play,
} from 'lucide-react';
import { ZipAllProgress } from '../services/zipExport';
import { ZipAllCheckpointSummary } from '../services/zipCheckpoint';
import { formatBytes, formatDateTime } from '../utils/formatters';

interface DownloadAllZipModalProps {
  isOpen: boolean;
  isProcessing: boolean;
  isCancelling: boolean;
  progress: ZipAllProgress;
  savedCheckpoint: ZipAllCheckpointSummary | null;
  localFolderName: string | null;
  onConfirmFresh: () => void;
  onResumeCheckpoint: () => void;
  onDenyResumeAndStartFresh: () => void;
  onCancel: () => void;
}

const PHASE_LABELS: Record<ZipAllProgress['phase'], string> = {
  scanning: 'Mapeando Pastas do Drive',
  downloading: 'Baixando Arquivos',
  compressing: 'Compactando em .ZIP',
  saving: 'Salvando Arquivo .ZIP',
};

const formatDuration = (totalSeconds: number): string => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const DownloadAllZipModal: React.FC<DownloadAllZipModalProps> = ({
  isOpen,
  isProcessing,
  isCancelling,
  progress,
  savedCheckpoint,
  localFolderName,
  onConfirmFresh,
  onResumeCheckpoint,
  onDenyResumeAndStartFresh,
  onCancel,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen || !isProcessing) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, isProcessing]);

  if (!isOpen) return null;

  const isResumePrompt = !isProcessing && savedCheckpoint !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 rounded-3xl w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden text-slate-100 transition-all ${
          isProcessing
            ? 'max-w-xl border-emerald-500/45 ring-4 ring-emerald-500/15'
            : isResumePrompt
            ? 'max-w-lg border-blue-500/45 ring-4 ring-blue-500/15'
            : 'max-w-md border-amber-500/40 ring-4 ring-amber-500/10'
        }`}
      >
        <div
          className={`absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl pointer-events-none ${
            isProcessing
              ? 'bg-emerald-500/15'
              : isResumePrompt
              ? 'bg-blue-500/15'
              : 'bg-amber-500/15'
          }`}
        />
        {isProcessing && (
          <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
        )}

        {!isProcessing && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {isProcessing ? (
          /* Dedicated Tracking Screen (Tela de Acompanhamento) */
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center space-x-3">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                    <Archive className="w-6 h-6" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border-2 border-emerald-400 flex items-center justify-center">
                    <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                      Acompanhamento — Baixar Tudo
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                      {PHASE_LABELS[progress.phase]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 flex items-center space-x-1.5 mt-1">
                    <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate max-w-[260px]">
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
                <div className="text-lg font-extrabold font-mono text-emerald-400">
                  {formatDuration(elapsedSeconds)}
                </div>
              </div>
            </div>

            {/* Centered Spinning Circular Indicator */}
            <div className="flex flex-col items-center justify-center my-4">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/15 blur-md" />
                <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 border-r-teal-400 animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-amber-400/80 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
                <div className="relative flex flex-col items-center justify-center">
                  <span className="text-xl font-extrabold font-mono text-white leading-none">
                    {progress.percent}%
                  </span>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-400 mt-1">
                    {isCancelling ? 'Cancelando' : 'Em Curso'}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{PHASE_LABELS[progress.phase]}</span>
                </span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {progress.percent}%
                </span>
              </div>

              <div className="w-full bg-slate-950 h-4 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-300 relative overflow-hidden"
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
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
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
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
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
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
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
                  : 'Preparando arquivos do Google Drive'}
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
        ) : isResumePrompt && savedCheckpoint ? (
          /* Step 1B: Authorization to Resume from Saved Checkpoint */
          <div className="relative z-10">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
                <RotateCcw className="w-7 h-7" />
              </div>

              <h3 className="font-extrabold text-lg text-white tracking-tight">
                Continuar Baixar Tudo de Onde Parou?
              </h3>

              <div className="mt-3 space-y-3 text-left w-full">
                <div className="bg-blue-950/40 border border-blue-800/70 rounded-2xl p-3.5 text-xs text-blue-100 flex items-start space-x-2.5">
                  <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Encontramos um progresso anterior salvo na memória. Deseja{' '}
                    <strong>autorizar a continuação</strong> exatamente de onde parou? Caso negue,
                    o processo será descartado e começará tudo do zero.
                  </p>
                </div>

                {/* Saved Checkpoint Memory Summary */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Progresso Salvo
                    </span>
                    <span className="text-sm font-extrabold font-mono text-white mt-0.5 block">
                      {savedCheckpoint.completedFiles} / {savedCheckpoint.totalFiles} arquivos
                    </span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Volume em Memória
                    </span>
                    <span className="text-sm font-extrabold font-mono text-emerald-400 mt-0.5 block">
                      {formatBytes(savedCheckpoint.downloadedBytes)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center justify-between text-[11px] text-slate-300">
                  <span className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Pausado em {formatDateTime(savedCheckpoint.updatedAt)}</span>
                  </span>
                  <span className="font-mono font-bold text-blue-400">
                    {savedCheckpoint.percent}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={onDenyResumeAndStartFresh}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-rose-950/70 hover:border-rose-700/70 hover:text-rose-200 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs border border-slate-700 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Negar e Começar do Zero</span>
              </button>

              <button
                onClick={onResumeCheckpoint}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Autorizar e Continuar</span>
              </button>
            </div>
          </div>
        ) : (
          /* Step 1A: Fresh Permission Prompt */
          <div className="relative z-10">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-4">
                <Archive className="w-7 h-7" />
              </div>

              <h3 className="font-extrabold text-lg text-white tracking-tight">
                Permissão para Baixar Tudo em ZIP
              </h3>

              <div className="mt-3 space-y-3 text-left w-full">
                <div className="bg-amber-950/40 border border-amber-800/70 rounded-2xl p-3.5 text-xs text-amber-200 flex items-start space-x-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Você autoriza baixar e compactar em um único arquivo <strong>.ZIP</strong> todo
                    o conteúdo do seu Google Drive (<strong>Meu Drive</strong>), incluindo todas as
                    pastas e subpastas?
                  </p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center space-x-2 text-xs text-slate-300">
                  <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate">
                    Destino:{' '}
                    <strong className="text-white font-mono">
                      {localFolderName || 'Downloads / DriveSync'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={onCancel}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs border border-slate-700 transition-all"
              >
                Cancelar
              </button>

              <button
                onClick={onConfirmFresh}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-amber-600/25 active:scale-95 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Autorizar e Baixar Tudo</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


