import React, { useEffect, useId, useRef, useState } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { ZipAllProgress } from '../services/zipExport';
import { formatSpeed } from '../utils/formatters';

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

  const primaryRateLabel =
    currentSpeedBps > 0
      ? formatSpeed(currentSpeedBps)
      : progress.phase === 'scanning'
      ? `${folderRatePerSec.toFixed(1)} pastas/s`
      : progress.phase === 'compressing'
      ? 'Compactando'
      : '0 KB/s';

  return (
    <div className="flex-1 w-full min-w-0 bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 flex flex-col justify-between shadow-inner">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center space-x-1.5 min-w-0">
          <Activity className={`w-3.5 h-3.5 shrink-0 ${textAccent}`} />
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 truncate">
            Velocidade de Leitura
          </span>
        </div>
        <span className={`text-xs font-extrabold font-mono shrink-0 ${textAccent}`}>
          {primaryRateLabel}
        </span>
      </div>

      <div className="relative w-full h-16">
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

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
        <span className="flex items-center space-x-1">
          <TrendingUp className="w-3 h-3 text-amber-400 shrink-0" />
          <span>
            Pico: <strong className="text-slate-200">{formatSpeed(peakSpeedBps)}</strong>
          </span>
        </span>
        <span className="text-slate-500">Escala: {formatSpeed(maxSample)}</span>
      </div>
    </div>
  );
};
