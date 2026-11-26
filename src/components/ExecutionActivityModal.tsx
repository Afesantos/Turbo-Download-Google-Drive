import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Flame,
  HardDrive,
  Cpu,
  Clock,
  X,
  Radio,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { DownloadTask, SpeedTelemetry } from '../services/downloadManager';
import { SyncEngineState } from '../services/syncEngine';
import { formatBytes, formatSpeed, formatDateTime } from '../utils/formatters';

interface ExecutionActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: DownloadTask[];
  telemetry: SpeedTelemetry;
  syncState: SyncEngineState;
  localFolderName: string | null;
  concurrency: number;
}

export const ExecutionActivityModal: React.FC<ExecutionActivityModalProps> = ({
  isOpen,
  onClose,
  tasks,
  telemetry,
  syncState,
  localFolderName,
  concurrency,
}) => {
  if (!isOpen) return null;

  const activeTasks = tasks.filter((t) => t.status === 'downloading');
  const queuedTasks = tasks.filter((t) => t.status === 'queued' || t.status === 'paused');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-blue-500/40 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden text-slate-100 ring-4 ring-blue-500/10 max-h-[90vh] flex flex-col">
        {/* Glow accent */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 animate-pulse">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-lg text-white tracking-tight">
                  Painel de Execução & Atividade
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full">
                  App em Execução
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Monitoramento em tempo real de threads, streams e sincronização contínua.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* Status Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center space-x-1">
                <Flame className="w-3 h-3 text-orange-400" />
                <span>Taxa Atual</span>
              </div>
              <div className="text-base sm:text-lg font-mono font-extrabold text-emerald-400 mt-1">
                {formatSpeed(telemetry.currentSpeedBytes)}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-blue-400" />
                <span>Threads Ativos</span>
              </div>
              <div className="text-base sm:text-lg font-mono font-extrabold text-white mt-1">
                {activeTasks.length} / {concurrency}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center space-x-1">
                <HardDrive className="w-3 h-3 text-amber-400" />
                <span>Total Baixado</span>
              </div>
              <div className="text-base sm:text-lg font-mono font-extrabold text-white mt-1">
                {formatBytes(telemetry.totalDownloadedBytes)}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center space-x-1">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>Auto-Sync</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-emerald-400 mt-1.5">
                {syncState.isActive ? `Ativo (${syncState.intervalSeconds}s)` : 'Pausado'}
              </div>
            </div>
          </div>

          {/* Active Transfers Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${activeTasks.length > 0 ? 'animate-spin' : ''}`} />
              <span>Transferências Ativas ({activeTasks.length}) & Fila ({queuedTasks.length})</span>
            </h4>

            {activeTasks.length === 0 && queuedTasks.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                Nenhum download ativo no momento. O motor está pronto e aguardando.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {[...activeTasks, ...queuedTasks].map((task) => (
                  <div
                    key={task.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs"
                  >
                    <div className="truncate mr-3">
                      <span className="font-semibold text-slate-200 truncate block">
                        {task.file.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {task.status === 'downloading'
                          ? 'Baixando...'
                          : task.status === 'paused'
                          ? 'Pausado'
                          : 'Na fila'}{' '}
                        • {formatBytes(task.downloadedBytes)} / {formatBytes(task.totalBytes)}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        {task.progressPercent}%
                      </span>
                      {task.status === 'downloading' && (
                        <div className="text-[9px] text-orange-400 font-mono">
                          {formatSpeed(task.speedBytesPerSec)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Execution Logs Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Logs Recentes de Execução</span>
            </h4>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 font-mono text-[11px] max-h-40 overflow-y-auto space-y-1.5 text-slate-300">
              {syncState.recentLogs.length === 0 ? (
                <div className="text-slate-500">Nenhum evento registrado ainda.</div>
              ) : (
                syncState.recentLogs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-2 border-b border-slate-800/50 pb-1">
                    <span className="text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })}
                    </span>
                    <span
                      className={`font-semibold shrink-0 ${
                        log.type === 'error'
                          ? 'text-rose-400'
                          : log.type === 'change_detected'
                          ? 'text-amber-400'
                          : 'text-blue-400'
                      }`}
                    >
                      [{log.type.toUpperCase()}]
                    </span>
                    <span className="text-slate-200 break-all">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Destino: <strong className="text-slate-200">{localFolderName || 'Downloads / DriveSync'}</strong></span>
          </div>

          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-blue-600/25 transition-all"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
