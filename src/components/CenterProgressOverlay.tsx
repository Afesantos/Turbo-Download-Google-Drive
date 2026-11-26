import React from 'react';
import {
  Download,
  Flame,
  CheckCircle,
  Square,
  RefreshCw,
  HardDrive,
  FileText,
  Sparkles,
  Cpu,
  TrendingUp,
  X,
  Minimize2,
  Cog,
} from 'lucide-react';
import { DownloadTask, SpeedTelemetry } from '../services/downloadManager';
import { formatBytes, formatSpeed } from '../utils/formatters';

interface CenterProgressOverlayProps {
  tasks: DownloadTask[];
  telemetry: SpeedTelemetry;
  onStopDownload: () => void;
  localFolderName: string | null;
  concurrency: number;
}

export const CenterProgressOverlay: React.FC<CenterProgressOverlayProps> = ({
  tasks,
  telemetry,
  onStopDownload,
  localFolderName,
  concurrency,
}) => {
  const activeTasks = tasks.filter((t) => t.status === 'downloading');
  const queuedTasks = tasks.filter((t) => t.status === 'queued');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const isDownloading = telemetry.hasActiveDownloads || activeTasks.length > 0;

  // Calculate overall bytes and percentage across all current active and queued tasks
  const relevantTasks = tasks.filter(
    (t) => t.status === 'downloading' || t.status === 'queued' || t.status === 'completed'
  );

  const totalBytesExpected = relevantTasks.reduce((sum, t) => sum + (t.totalBytes || 0), 0);
  const totalBytesDownloaded = relevantTasks.reduce(
    (sum, t) => sum + (t.downloadedBytes || 0),
    0
  );

  let overallPercent = 0;
  if (totalBytesExpected > 0) {
    overallPercent = Math.min(100, Math.round((totalBytesDownloaded / totalBytesExpected) * 100));
  } else if (relevantTasks.length > 0) {
    overallPercent = Math.min(
      100,
      Math.round((completedTasks.length / relevantTasks.length) * 100)
    );
  }

  // Only show when downloads are active
  if (!isDownloading) {
    return null;
  }

  const currentFile = activeTasks[0]?.file;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-orange-500/50 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden text-slate-100 ring-4 ring-orange-500/15">
        {/* Glow ambient background lights */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header with Spinning Working Image/Icon */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 text-white flex items-center justify-center shadow-xl shadow-orange-500/30">
                <Flame className="w-7 h-7 fill-white" />
              </div>
              {/* Spinning working indicator badge */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-orange-500 flex items-center justify-center">
                <RefreshCw className="w-3.5 h-3.5 text-orange-400 animate-spin" />
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  Aplicativo Trabalhando...
                </h3>
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full">
                  {concurrency}x Turbo
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center space-x-1.5 mt-1 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate max-w-[260px]">
                  Gravando na pasta: <strong className="text-white font-mono">{localFolderName || 'Downloads'}</strong>
                </span>
              </p>
            </div>
          </div>

          {/* Real-time speed badge */}
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Taxa de Rede
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400 drop-shadow-sm">
              {formatSpeed(telemetry.currentSpeedBytes)}
            </div>
          </div>
        </div>

        {/* Prominent Centered Spinning Circle */}
        <div className="flex flex-col items-center justify-center my-4">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer ambient glow */}
            <div className="absolute inset-0 rounded-full bg-orange-500/15 blur-md" />
            {/* Base track circle */}
            <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
            {/* Primary spinning circle */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 border-r-amber-400 animate-spin" />
            {/* Inner counter-glow ring */}
            <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-emerald-400/80 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
            {/* Center percentage */}
            <div className="relative flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold font-mono text-white leading-none">
                {overallPercent}%
              </span>
              <span className="text-[9px] uppercase tracking-wider font-bold text-orange-400 mt-1">
                Baixando
              </span>
            </div>
          </div>
        </div>

        {/* Big Central Progress Bar */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Progresso de Sincronização & Download</span>
            </span>
            <span className="text-sm font-bold font-mono text-emerald-400">
              {overallPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-950 h-5 rounded-full overflow-hidden p-1 border border-slate-800 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 transition-all duration-300 shadow-lg shadow-orange-500/50 relative overflow-hidden"
              style={{ width: `${Math.max(5, overallPercent)}%` }}
            >
              {/* Animated striped shimmer line */}
              <div className="absolute inset-0 bg-white/20 opacity-40 animate-[shimmer_2s_infinite] [background-image:linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] [background-size:20px_20px]" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1">
            <span>
              {totalBytesExpected > 0
                ? `${formatBytes(totalBytesDownloaded)} de ${formatBytes(totalBytesExpected)}`
                : `${formatBytes(totalBytesDownloaded)} baixados`}
            </span>
            <span>
              {completedTasks.length} de {relevantTasks.length} arquivos processados
            </span>
          </div>
        </div>

        {/* Current Active File Info */}
        {currentFile && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 mb-6 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2.5 truncate mr-3">
              <RefreshCw className="w-4 h-4 animate-spin text-orange-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Baixando Agora:
                </span>
                <span className="text-slate-200 font-semibold truncate block" title={currentFile.name}>
                  {currentFile.name}
                </span>
              </div>
            </div>

            {activeTasks[0] && (
              <span className="font-mono text-emerald-400 font-bold shrink-0">
                {activeTasks[0].progressPercent}%
              </span>
            )}
          </div>
        )}

        {/* Action Controls: Prominent STOP Button */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Cpu className="w-4 h-4 text-slate-500" />
            <span>
              <strong className="text-white font-mono">{activeTasks.length}</strong> streams ativos
            </span>
          </div>

          <button
            onClick={onStopDownload}
            className="flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl text-xs font-bold transition-all shadow-xl active:scale-95 bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-2 ring-rose-500/40"
            title="Parar imediatamente todas as transferências ativas"
          >
            <Square className="w-4 h-4 fill-current animate-pulse" />
            <span>Parar o Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};
