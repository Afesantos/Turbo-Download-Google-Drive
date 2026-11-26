import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Activity,
  TrendingUp,
  Gauge,
  Clock,
  Layers,
  BarChart3,
  Info,
  Flame,
  Cpu,
  FileCheck,
} from 'lucide-react';
import { ZipAllProgress } from '../services/zipExport';
import { formatSpeed, formatBytes } from '../utils/formatters';
import { computeZipTimingMetrics } from '../utils/zipTiming';

interface LiveSpeedChartProps {
  progress: ZipAllProgress;
  isActive: boolean;
  accent?: 'emerald' | 'amber';
}

interface TelemetrySnapshot {
  ts: number;
  bytes: number;
  folders: number;
  files: number;
}

const MAX_POINTS = 24;
const SAMPLE_INTERVAL_MS = 500;
const WINDOW_MS = 1800;

export const LiveSpeedChart: React.FC<LiveSpeedChartProps> = ({
  progress,
  isActive,
  accent = 'emerald',
}) => {
  const gradientId = useId().replace(/:/g, '');
  const progressRef = useRef<ZipAllProgress>(progress);
  progressRef.current = progress;

  const [isDetailedMode, setIsDetailedMode] = useState<boolean>(false);
  const snapshotsRef = useRef<TelemetrySnapshot[]>([]);
  const [samples, setSamples] = useState<number[]>(() => new Array(MAX_POINTS).fill(0));
  const [currentSpeedBps, setCurrentSpeedBps] = useState<number>(0);
  const [peakSpeedBps, setPeakSpeedBps] = useState<number>(0);
  const [folderRatePerSec, setFolderRatePerSec] = useState<number>(0);

  // Reset telemetry when modal session starts/stops
  useEffect(() => {
    if (!isActive) {
      snapshotsRef.current = [];
      setSamples(new Array(MAX_POINTS).fill(0));
      setCurrentSpeedBps(0);
      setPeakSpeedBps(0);
      setFolderRatePerSec(0);
      return;
    }

    const initial = progressRef.current;
    snapshotsRef.current = [
      {
        ts: Date.now(),
        bytes: initial.downloadedBytes || 0,
        folders: initial.folderCount || 0,
        files: initial.processedFiles || 0,
      },
    ];

    const timer = window.setInterval(() => {
      const now = Date.now();
      const latest = progressRef.current;
      const snaps = snapshotsRef.current;

      snaps.push({
        ts: now,
        bytes: latest.downloadedBytes || 0,
        folders: latest.folderCount || 0,
        files: latest.processedFiles || 0,
      });

      // Keep ~3 seconds of rolling snapshots for smooth instantaneous speed
      while (snaps.length > 2 && now - snaps[0].ts > WINDOW_MS) {
        snaps.shift();
      }

      const oldest = snaps[0];
      const dtSec = Math.max(0.25, (now - oldest.ts) / 1000);
      const deltaBytes = Math.max(0, (latest.downloadedBytes || 0) - oldest.bytes);
      const deltaFolders = Math.max(0, (latest.folderCount || 0) - oldest.folders);
      const deltaFiles = Math.max(0, (latest.processedFiles || 0) - oldest.files);

      const bps = Math.round(deltaBytes / dtSec);
      const fRate = Number((deltaFolders / dtSec).toFixed(1));
      const itemRate = deltaFolders + deltaFiles;

      // Normalized visual value: bytes/s during download, or folder/item read rate during scanning/compressing
      const visualValue =
        bps > 0
          ? bps
          : latest.phase === 'scanning'
          ? Math.max(deltaFolders > 0 ? deltaFolders * 64 * 1024 : 0, itemRate * 32 * 1024)
          : latest.phase === 'compressing'
          ? 128 * 1024
          : 0;

      setCurrentSpeedBps(bps);
      setPeakSpeedBps((prev) => Math.max(prev, bps));
      setFolderRatePerSec(fRate);
      setSamples((prev) => [...prev.slice(1), visualValue]);
    }, SAMPLE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isActive]);

  const nowMs = Date.now();
  const sessionStart = progress.startedAt || nowMs;
  const totalElapsedMs = (progress.priorElapsedMs || 0) + Math.max(0, nowMs - sessionStart);
  const elapsedSec = Math.max(1, Math.floor(totalElapsedMs / 1000));
  const avgSpeedBps =
    progress.downloadedBytes > 0 ? Math.round(progress.downloadedBytes / elapsedSec) : currentSpeedBps;

  const timing = computeZipTimingMetrics(progress, sessionStart, nowMs);

  const width = 220;
  const height = 64;
  const padX = 4;
  const padY = 6;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  const maxSample = Math.max(64 * 1024, ...samples);
  const points = samples.map((val, idx) => {
    const x = padX + (idx / (samples.length - 1)) * usableW;
    const ratio = Math.min(1, Math.max(0, val / maxSample));
    const y = padY + (1 - ratio) * usableH;
    return { x, y };
  });

  const linePointsAttr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `M ${points[0].x.toFixed(1)},${(height - padY).toFixed(1)} L ${points
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' L ')} L ${points[points.length - 1].x.toFixed(1)},${(height - padY).toFixed(1)} Z`;

  const lastPoint = points[points.length - 1];
  const strokeColor = accent === 'amber' ? '#fbbf24' : '#34d399';
  const fillStart = accent === 'amber' ? 'rgba(251, 191, 36, 0.38)' : 'rgba(52, 211, 153, 0.38)';
  const fillEnd = accent === 'amber' ? 'rgba(251, 191, 36, 0.02)' : 'rgba(52, 211, 153, 0.02)';
  const textAccent = accent === 'amber' ? 'text-amber-400' : 'text-emerald-400';
  const badgeBorder = accent === 'amber' ? 'border-amber-500/30' : 'border-emerald-500/30';
  const badgeBg = accent === 'amber' ? 'bg-amber-950/40 text-amber-300' : 'bg-emerald-950/40 text-emerald-300';

  const primaryRateLabel =
    currentSpeedBps > 0
      ? formatSpeed(currentSpeedBps)
      : progress.phase === 'scanning'
      ? `${folderRatePerSec.toFixed(1)} pastas/s`
      : progress.phase === 'compressing'
      ? 'Compactando'
      : '0 KB/s';

  const etaShortLabel =
    progress.phase === 'scanning'
      ? timing.scanEstimateLabel
      : progress.phase === 'compressing'
      ? 'Finalizando...'
      : timing.finishEstimateLabel.split(' (')[0] || 'Calculando...';

  const remainingBytes = Math.max(0, (progress.totalBytesExpected || 0) - (progress.downloadedBytes || 0));

  const toggleMode = () => {
    setIsDetailedMode((prev) => !prev);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={toggleMode}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleMode();
        }
      }}
      className="flex-1 w-full min-w-0 bg-slate-950/85 hover:bg-slate-950 border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-3 flex flex-col justify-between shadow-inner cursor-pointer transition-all duration-200 group select-none relative focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
      title="Clique para alternar entre o gráfico de velocidade e as informações detalhadas de processamento"
    >
      {/* Header with Title and Mode Switch Badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <div className="flex items-center space-x-1.5 min-w-0">
          {isDetailedMode ? (
            <Cpu className={`w-3.5 h-3.5 shrink-0 ${textAccent}`} />
          ) : (
            <Activity className={`w-3.5 h-3.5 shrink-0 ${textAccent}`} />
          )}
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 truncate">
            {isDetailedMode ? 'Telemetria do Processamento' : 'Velocidade de Leitura'}
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded-full border ${badgeBg} ${badgeBorder} font-bold hidden xs:inline shrink-0`}
          >
            {isDetailedMode ? 'Detalhes' : 'Gráfico'}
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className={`text-xs font-extrabold font-mono ${textAccent}`}>
            {primaryRateLabel}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMode();
            }}
            className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-200 px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center space-x-1 transition-colors"
            title="Clique para alternar o modo de visualização"
          >
            {isDetailedMode ? (
              <>
                <BarChart3 className="w-2.5 h-2.5 text-emerald-400" />
                <span className="hidden sm:inline">Gráfico</span>
              </>
            ) : (
              <>
                <Info className="w-2.5 h-2.5 text-blue-400" />
                <span className="hidden sm:inline">Info</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* BODY: Mode 1: Graphical Waveform OR Mode 2: Detailed Processing Information */}
      {!isDetailedMode ? (
        /* MODE 1: Animated Read Speed Graph */
        <div className="relative w-full h-16 animate-in fade-in duration-200">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
            role="img"
            aria-label="Gráfico de progresso da leitura em velocidade"
          >
            <defs>
              <linearGradient id={`speedGrad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillStart} />
                <stop offset="100%" stopColor={fillEnd} />
              </linearGradient>
            </defs>

            {/* Subtle horizontal gridlines */}
            <line
              x1={padX}
              y1={padY}
              x2={width - padX}
              y2={padY}
              stroke="rgba(148, 163, 184, 0.14)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <line
              x1={padX}
              y1={height / 2}
              x2={width - padX}
              y2={height / 2}
              stroke="rgba(148, 163, 184, 0.14)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <line
              x1={padX}
              y1={height - padY}
              x2={width - padX}
              y2={height - padY}
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth="1"
            />

            {/* Shaded area under curve */}
            <path d={areaPath} fill={`url(#speedGrad-${gradientId})`} />

            {/* Velocity line */}
            <polyline
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={linePointsAttr}
            />

            {/* Live pulse indicator on latest sample */}
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="3.2"
              fill={strokeColor}
              stroke="#020617"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      ) : (
        /* MODE 2: Comprehensive Processing Metrics HUD */
        <div className="w-full h-16 flex flex-col justify-between animate-in fade-in duration-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 h-full">
            {/* Stat 1: Vazão Média */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl px-2 py-1 flex flex-col justify-center min-w-0">
              <div className="flex items-center space-x-1 text-[9px] uppercase font-bold text-slate-400 truncate">
                <Gauge className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                <span className="truncate">Vazão Média</span>
              </div>
              <div className="text-xs font-mono font-extrabold text-slate-100 truncate">
                {formatSpeed(avgSpeedBps)}
              </div>
            </div>

            {/* Stat 2: Pico Máximo */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl px-2 py-1 flex flex-col justify-center min-w-0">
              <div className="flex items-center space-x-1 text-[9px] uppercase font-bold text-slate-400 truncate">
                <TrendingUp className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span className="truncate">Pico Máx</span>
              </div>
              <div className="text-xs font-mono font-extrabold text-amber-400 truncate">
                {formatSpeed(peakSpeedBps)}
              </div>
            </div>

            {/* Stat 3: Restante / ETA */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl px-2 py-1 flex flex-col justify-center min-w-0">
              <div className="flex items-center space-x-1 text-[9px] uppercase font-bold text-slate-400 truncate">
                <Clock className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                <span className="truncate">Previsão</span>
              </div>
              <div className="text-xs font-mono font-extrabold text-blue-300 truncate">
                {etaShortLabel}
              </div>
            </div>

            {/* Stat 4: Dados / Volume */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl px-2 py-1 flex flex-col justify-center min-w-0">
              <div className="flex items-center space-x-1 text-[9px] uppercase font-bold text-slate-400 truncate">
                <Layers className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                <span className="truncate">Transferido</span>
              </div>
              <div className="text-xs font-mono font-extrabold text-purple-300 truncate">
                {formatBytes(progress.downloadedBytes)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER: Contextual Metrics & Click-to-Toggle Prompt */}
      {!isDetailedMode ? (
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
          <span className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3 text-amber-400 shrink-0" />
            <span>
              Pico: <strong className="text-slate-200">{formatSpeed(peakSpeedBps)}</strong>
            </span>
          </span>
          <span className="hidden xs:inline text-slate-400">
            Média: <strong className="text-slate-200">{formatSpeed(avgSpeedBps)}</strong>
          </span>
          <span className="inline-flex items-center space-x-1 text-[9px] text-emerald-400/90 group-hover:text-emerald-300 font-sans font-semibold transition-colors">
            <span>Clique para detalhes</span>
            <span className="text-[11px] leading-none transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1 pt-1 border-t border-slate-800/60 min-w-0">
          <div className="flex items-center space-x-1.5 min-w-0 truncate pr-2">
            <span className="text-slate-500 shrink-0">Item:</span>
            <span className="text-slate-200 truncate font-semibold" title={progress.currentItem}>
              {progress.currentItem || 'Processando lote...'}
            </span>
          </div>
          <span className="inline-flex items-center space-x-1 text-[9px] text-blue-400/90 group-hover:text-blue-300 font-sans font-semibold shrink-0 transition-colors">
            <span>Voltar ao gráfico</span>
            <span className="text-[11px] leading-none">↺</span>
          </span>
        </div>
      )}
    </div>
  );
};
