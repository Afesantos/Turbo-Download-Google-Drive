import React, { useState } from 'react';
import {
  Zap,
  Gauge,
  Sliders,
  Flame,
  Layers,
  TrendingUp,
  Cpu,
  Play,
  Square,
  Pause,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { formatSpeed, formatBytes } from '../utils/formatters';

interface SpeedEngineBarProps {
  currentSpeed: number;
  peakSpeed: number;
  totalDownloaded: number;
  activeWorkers: number;
  concurrency: number;
  onConcurrencyChange: (threads: number) => void;
  turboMultiChunk: boolean;
  onToggleTurboMultiChunk: (enabled: boolean) => void;
  onStartDownload: () => void;
  onStopDownload: () => void;
  isDownloading: boolean;
  isPaused: boolean;
  hasPendingTasks: boolean;
}

export const SpeedEngineBar: React.FC<SpeedEngineBarProps> = ({
  currentSpeed,
  peakSpeed,
  totalDownloaded,
  activeWorkers,
  concurrency,
  onConcurrencyChange,
  turboMultiChunk,
  onToggleTurboMultiChunk,
  onStartDownload,
  onStopDownload,
  isDownloading,
  isPaused,
  hasPendingTasks,
}) => {
  const CONCURRENCY_PRESETS = [
    { threads: 2, label: '2x Leve' },
    { threads: 4, label: '4x Rápido' },
    { threads: 8, label: '8x Turbo' },
    { threads: 16, label: '16x Extremo' },
  ];

  const [showDetailedTelemetry, setShowDetailedTelemetry] = useState(false);

  const maxScale = Math.max(20 * 1024 * 1024, peakSpeed * 1.1);
  const gaugePercent = Math.min(100, Math.round((currentSpeed / maxScale) * 100));

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      {/* Decorative speed lines */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 min-w-0">
        {/* Speedometer display */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowDetailedTelemetry((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowDetailedTelemetry((prev) => !prev);
            }
          }}
          className="flex items-center space-x-4 sm:space-x-5 min-w-0 cursor-pointer select-none group/speedometer focus:outline-none"
          title="Clique para alternar as informações detalhadas de processamento"
        >
          <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-950 border border-slate-800 group-hover/speedometer:border-orange-500/50 p-2 shadow-inner shrink-0 transition-colors">
            <Gauge className={`w-8 h-8 sm:w-10 sm:h-10 ${isDownloading ? 'text-orange-500 animate-pulse' : 'text-slate-600'}`} />
            <div
              className="absolute inset-0 rounded-2xl border-2 border-orange-500/30 group-hover/speedometer:border-orange-500/60 transition-colors"
              style={{
                boxShadow: currentSpeed > 0 ? '0 0 15px rgba(249, 115, 22, 0.4)' : 'none',
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-orange-400 flex items-center space-x-1">
                <Flame className="w-3.5 h-3.5 fill-orange-400 shrink-0" />
                <span>Motor de Aceleração Turbo</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                isDownloading
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80 animate-pulse'
                  : isPaused
                  ? 'bg-amber-950/80 text-amber-400 border-amber-800/80'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {isDownloading ? 'Em Execução' : isPaused ? 'Pausado' : 'Pronto'}
              </span>
              <span
                className="hidden sm:inline-flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-900/80 text-emerald-400 border border-slate-800"
                title="Execução em 2º plano protegida: os downloads continuam funcionando mesmo se outras abas do navegador estiverem ativas."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>2º Plano Protegido</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetailedTelemetry((prev) => !prev);
                }}
                className="hidden sm:inline-flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-orange-300 border border-orange-500/30 transition-colors"
                title="Clique para alternar as informações detalhadas do processamento"
              >
                <Activity className="w-2.5 h-2.5 text-orange-400" />
                <span>{showDetailedTelemetry ? 'Ocultar Detalhes' : 'Ver Detalhes'}</span>
                {showDetailedTelemetry ? (
                  <ChevronUp className="w-2.5 h-2.5" />
                ) : (
                  <ChevronDown className="w-2.5 h-2.5" />
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
              <span className="text-2xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                {formatSpeed(currentSpeed)}
              </span>
              <span className="text-xs text-slate-400 font-medium">taxa em tempo real</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-400">
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Pico:</span>
                <span className="font-mono font-bold text-amber-300">
                  {formatSpeed(peakSpeed)}
                </span>
              </div>
              <span className="hidden sm:inline">•</span>
              <div>
                <span>Total transferido:</span>{' '}
                <span className="font-mono font-bold text-slate-200">
                  {formatBytes(totalDownloaded)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Speed Bar Progress Indicator */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowDetailedTelemetry((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowDetailedTelemetry((prev) => !prev);
            }
          }}
          className="flex-1 max-w-sm hidden xl:block min-w-0 cursor-pointer select-none group/bar focus:outline-none"
          title="Clique para alternar o painel de telemetria e detalhes dos canais de processamento"
        >
          <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5 font-medium">
            <span className="flex items-center space-x-1 group-hover/bar:text-orange-300 transition-colors">
              <Cpu className="w-3.5 h-3.5 text-slate-400 group-hover/bar:text-orange-400" />
              <span>Carga dos Streams Paralelos</span>
            </span>
            <span className="font-mono text-slate-300">
              {activeWorkers} de {concurrency} conexões ativas
            </span>
          </div>

          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800 group-hover/bar:border-orange-500/40 transition-colors">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-amber-500 to-rose-500 transition-all duration-300 shadow-sm shadow-orange-500/50"
              style={{ width: `${currentSpeed > 0 ? Math.max(5, gaugePercent) : 0}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 font-mono">
            <span>0 MB/s</span>
            <span>{formatSpeed(maxScale / 2)}</span>
            <span>{formatSpeed(maxScale)}</span>
          </div>
        </div>

        {/* Action Controls: START DOWNLOAD & STOP DOWNLOAD & Tuning */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {/* Dynamic Action Button: Changes between Iniciar o Download and Parar o Download */}
          <div className="flex items-center w-full sm:w-auto">
            {isDownloading ? (
              <button
                onClick={onStopDownload}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xl active:scale-95 bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-2 ring-rose-500/40"
                title="Parar imediatamente todas as transferências ativas"
              >
                <Square className="w-4 h-4 fill-current animate-pulse" />
                <span>Parar o Download</span>
              </button>
            ) : (
              <button
                onClick={onStartDownload}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xl active:scale-95 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/40"
                title="Iniciar o download para a pasta local"
              >
                <Play className="w-4 h-4 fill-white text-white" />
                <span>{isPaused && hasPendingTasks ? 'Continuar o Download' : 'Iniciar o Download'}</span>
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-slate-800 hidden xl:block" />

          {/* Concurrency Selector */}
          <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1 w-full sm:w-auto">
            {CONCURRENCY_PRESETS.map((p) => {
              const isSelected = concurrency === p.threads;
              return (
                <button
                  key={p.threads}
                  onClick={() => onConcurrencyChange(p.threads)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                  title={`${p.threads} downloads simultâneos em paralelo`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Multi-Chunk Range switch */}
          <button
            onClick={() => onToggleTurboMultiChunk(!turboMultiChunk)}
            className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
              turboMultiChunk
                ? 'bg-orange-950/50 text-orange-300 border-orange-800/80 shadow-md shadow-orange-500/10'
                : 'bg-slate-950/50 text-slate-400 border-slate-800'
            }`}
            title="Divide arquivos grandes (>25MB) em partes para baixar com múltiplos canais simultâneos"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Chunk {turboMultiChunk ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Expandable Processing Telemetry Panel */}
      {showDetailedTelemetry && (
        <div className="mt-5 pt-4 border-t border-slate-800/80 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-orange-400" />
              <span>Raio-X de Processamento &amp; Vazão em Tempo Real</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              {activeWorkers} canais operando de {concurrency} configurados
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Metric 1: Thread Allocation */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="flex items-center space-x-1 font-medium">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  <span>Canais Paralelos</span>
                </span>
                <span className="font-mono font-bold text-slate-200">
                  {concurrency}x Threads
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {Array.from({ length: concurrency }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`w-3 h-3 rounded-full border transition-all ${
                      idx < activeWorkers
                        ? 'bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-400/50 animate-pulse'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                    title={`Canal ${idx + 1}: ${idx < activeWorkers ? 'Ativo (Baixando stream)' : 'Em espera / ocioso'}`}
                  />
                ))}
              </div>
              <div className="text-[10px] text-slate-500 mt-2 font-mono">
                {activeWorkers > 0 ? `${activeWorkers} stream(s) ativo(s) em I/O direto` : 'Pronto para novas transferências'}
              </div>
            </div>

            {/* Metric 2: Multi-Chunk Partitioner */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="flex items-center space-x-1 font-medium">
                  <Layers className="w-3.5 h-3.5 text-orange-400" />
                  <span>Multi-Chunk (Range)</span>
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${turboMultiChunk ? 'bg-orange-950 text-orange-300 border border-orange-800/60' : 'bg-slate-800 text-slate-400'}`}>
                  {turboMultiChunk ? 'Ativo (4x)' : 'Desativado'}
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Arquivos grandes (&gt;25MB) são divididos em 4 blocos de rede simultâneos.
              </div>
            </div>

            {/* Metric 3: Background Protection */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="flex items-center space-x-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2º Plano &amp; Abas</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                  Protegido
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Web Worker e Web Locks ativos para manter downloads com outras abas abertas.
              </div>
            </div>

            {/* Metric 4: Throughput & Volume */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="flex items-center space-x-1 font-medium">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  <span>Vazão Histórica</span>
                </span>
                <span className="font-mono font-bold text-amber-300 text-xs">
                  {formatSpeed(peakSpeed)}
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Total Acumulado: <strong className="text-white font-mono">{formatBytes(totalDownloaded)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
