import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Activity,
  TrendingUp,
  Clock,
  FolderTree,
  FolderOpen,
  Folder,
  Timer,
  Gauge,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  BarChart3,
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
const TOTAL_STEPS = 7;

export const LiveSpeedChart: React.FC<LiveSpeedChartProps> = ({
  progress,
  isActive,
  accent = 'emerald',
}) => {
  const gradientId = useId().replace(/:/g, '');
  const progressRef = useRef<ZipAllProgress>(progress);
  progressRef.current = progress;

  // Step 0: Gráfico de Velocidade
  // Step 1: Tempo Decorrido
  // Step 2: Quantidade de Arquivos e Pastas
  // Step 3: Pasta Atual Sendo Lida
  // Step 4: Previsão de Término (ETA)
  // Step 5: Vazão Média & Pico Máximo
  // Step 6: Volume de Dados Transferido
  const [currentStep, setCurrentStep] = useState<number>(0);

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
      setCurrentStep(0);
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
  const dotActiveBg = accent === 'amber' ? 'bg-amber-400' : 'bg-emerald-400';

  const primaryRateLabel =
    currentSpeedBps > 0
      ? formatSpeed(currentSpeedBps)
      : progress.phase === 'scanning'
      ? `${folderRatePerSec.toFixed(1)} pastas/s`
      : progress.phase === 'compressing'
      ? 'Compactando'
      : '0 KB/s';

  const remainingBytes = Math.max(0, (progress.totalBytesExpected || 0) - (progress.downloadedBytes || 0));

  const getCurrentFolderInfo = (): { folderPath: string; fileName: string } => {
    const raw = (progress.currentItem || '').trim();
    if (progress.phase === 'scanning') {
      return {
        folderPath: raw || 'Meu Drive',
        fileName: 'Varrendo estrutura de pastas...',
      };
    }
    if (progress.phase === 'compressing') {
      return {
        folderPath: 'Compactador ZIP',
        fileName: raw || 'Compactando pacote final...',
      };
    }
    if (progress.phase === 'saving') {
      return {
        folderPath: 'Pasta Local do Computador',
        fileName: raw || 'Gravando arquivo final no disco...',
      };
    }
    const lastSlash = raw.lastIndexOf('/');
    if (lastSlash >= 0) {
      return {
        folderPath: raw.substring(0, lastSlash) || 'Meu Drive',
        fileName: raw.substring(lastSlash + 1) || 'Lendo arquivo...',
      };
    }
    return {
      folderPath: 'Raiz (Meu Drive)',
      fileName: raw || 'Lendo arquivo...',
    };
  };

  const folderInfo = getCurrentFolderInfo();

  const nextStep = () => {
    setCurrentStep((prev) => (prev + 1) % TOTAL_STEPS);
  };

  const prevStep = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentStep((prev) => (prev - 1 + TOTAL_STEPS) % TOTAL_STEPS);
  };

  const nextStepExplicit = (e: React.MouseEvent) => {
    e.stopPropagation();
    nextStep();
  };

  // Step definitions
  const STEP_METADATA = [
    {
      index: 0,
      title: 'Velocidade de Leitura',
      icon: Activity,
      badgeText: 'Gráfico',
      nextHint: 'Tempo Decorrido',
    },
    {
      index: 1,
      title: 'Tempo Decorrido',
      icon: Clock,
      badgeText: 'Decorrido',
      nextHint: 'Arquivos & Pastas',
    },
    {
      index: 2,
      title: 'Arquivos & Pastas',
      icon: FolderTree,
      badgeText: 'Contagem',
      nextHint: 'Pasta Atual',
    },
    {
      index: 3,
      title: 'Pasta Atual Sendo Lida',
      icon: FolderOpen,
      badgeText: 'Pasta Atual',
      nextHint: 'Previsão (ETA)',
    },
    {
      index: 4,
      title: 'Previsão de Término (ETA)',
      icon: Timer,
      badgeText: 'Previsão',
      nextHint: 'Vazão Média & Pico',
    },
    {
      index: 5,
      title: 'Vazão Média & Pico Máximo',
      icon: Gauge,
      badgeText: 'Vazão',
      nextHint: 'Volume Transferido',
    },
    {
      index: 6,
      title: 'Volume de Dados Transferido',
      icon: HardDrive,
      badgeText: 'Volume',
      nextHint: 'Gráfico de Leitura',
    },
  ];

  const currentMeta = STEP_METADATA[currentStep] || STEP_METADATA[0];
  const StepIcon = currentMeta.icon;

  const filesPercent =
    progress.totalFiles > 0
      ? Math.round((progress.processedFiles / progress.totalFiles) * 100)
      : progress.percent;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={nextStep}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          nextStep();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextStep();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setCurrentStep((prev) => (prev - 1 + TOTAL_STEPS) % TOTAL_STEPS);
        }
      }}
      className="flex-1 w-full min-w-0 bg-slate-950/85 hover:bg-slate-950 border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-3 flex flex-col justify-between shadow-inner cursor-pointer transition-all duration-200 group select-none relative focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
      title="Clique para alternar para a próxima informação de processamento (1 de 7 por clique)"
    >
      {/* Top Header: Current Step Title + Step Dots Indicator + Next/Prev Controls */}
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <div className="flex items-center space-x-1.5 min-w-0">
          <StepIcon className={`w-3.5 h-3.5 shrink-0 ${textAccent}`} />
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 truncate">
            {currentStep + 1}/{TOTAL_STEPS} • {currentMeta.title}
          </span>
        </div>

        {/* Stepper Dots & Arrow Navigators */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <div className="hidden xs:flex items-center space-x-1 mr-1">
            {STEP_METADATA.map((st) => (
              <button
                key={st.index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentStep(st.index);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  st.index === currentStep
                    ? `${dotActiveBg} w-3`
                    : 'bg-slate-700 hover:bg-slate-500'
                }`}
                title={`Ir para ${st.title}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={prevStep}
            className="p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Informação anterior"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={nextStepExplicit}
            className="p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Próxima informação"
          >
            <ChevronRight className="w-3 h-3" />
          </button>

          <span className={`text-xs font-extrabold font-mono ml-1 ${textAccent}`}>
            {primaryRateLabel}
          </span>
        </div>
      </div>

      {/* BODY: Displays strictly ONE piece of information at a time with smooth transition */}
      <div className="relative w-full h-16 flex items-center min-w-0">
        {/* STEP 0: Gráfico de Velocidade de Leitura */}
        {currentStep === 0 && (
          <div className="w-full h-16 animate-in fade-in duration-150">
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

              <path d={areaPath} fill={`url(#speedGrad-${gradientId})`} />

              <polyline
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={linePointsAttr}
              />

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
        )}

        {/* STEP 1: Tempo Decorrido */}
        {currentStep === 1 && (
          <div className="w-full h-full flex flex-col justify-center px-1 animate-in fade-in duration-150">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 tracking-tight">
                {timing.elapsedFormatted}
              </span>
              <span className="text-xs text-slate-400 font-medium">decorrido</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center space-x-2">
              <span>
                Início às <strong className="text-slate-200">{timing.startClock}</strong>
              </span>
              <span>•</span>
              <span className="text-slate-400 truncate">
                Data: <strong className="text-slate-300">{timing.startDateTime.split(' ')[0]}</strong>
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: Quantidade de Arquivos e Pastas */}
        {currentStep === 2 && (
          <div className="w-full h-full grid grid-cols-2 gap-2 items-center animate-in fade-in duration-150">
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl px-3 py-1.5 flex flex-col justify-center">
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center space-x-1">
                <span>Arquivos Lidos</span>
              </div>
              <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-400 truncate">
                {progress.processedFiles}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  de {progress.totalFiles || '?'}
                </span>
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                {filesPercent}% do total de arquivos
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl px-3 py-1.5 flex flex-col justify-center">
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center space-x-1">
                <span>Pastas Mapeadas</span>
              </div>
              <div className="text-base sm:text-lg font-extrabold font-mono text-amber-400 truncate">
                {progress.folderCount}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  {progress.discoveredFolders && progress.discoveredFolders > progress.folderCount
                    ? `de ${progress.discoveredFolders}`
                    : 'pastas'}
                </span>
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                Estrutura original intacta
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Pasta Atual Sendo Lida */}
        {currentStep === 3 && (
          <div className="w-full h-full flex flex-col justify-center px-1 animate-in fade-in duration-150 min-w-0">
            <div className="flex items-center space-x-1 text-[10px] uppercase font-bold text-amber-400 mb-0.5">
              <Folder className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Diretório de Leitura Atual:</span>
            </div>
            <div
              className="text-xs sm:text-sm font-mono font-bold text-slate-100 truncate bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-800/90"
              title={folderInfo.folderPath}
            >
              📁 {folderInfo.folderPath}
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-1 flex items-center space-x-1">
              <span className="text-slate-500 shrink-0">Item:</span>
              <span className="text-slate-300 font-medium truncate" title={folderInfo.fileName}>
                {folderInfo.fileName}
              </span>
            </div>
          </div>
        )}

        {/* STEP 4: Previsão de Término (ETA) */}
        {currentStep === 4 && (
          <div className="w-full h-full flex flex-col justify-center px-1 animate-in fade-in duration-150">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-blue-300 tracking-tight truncate">
              {progress.phase === 'scanning'
                ? timing.scanEstimateLabel
                : timing.finishEstimateLabel}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2">
              <span>Término calculado dinamicamente</span>
              <span>•</span>
              <span className="text-slate-300 font-mono font-semibold">
                {progress.percent}% concluído
              </span>
            </div>
          </div>
        )}

        {/* STEP 5: Vazão Média & Pico Máximo */}
        {currentStep === 5 && (
          <div className="w-full h-full grid grid-cols-2 gap-2 items-center animate-in fade-in duration-150">
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl px-3 py-1.5 flex flex-col justify-center">
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                Vazão Média da Sessão
              </div>
              <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-400 truncate">
                {formatSpeed(avgSpeedBps)}
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                Baseada em {timing.elapsedFormatted}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl px-3 py-1.5 flex flex-col justify-center">
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                Pico Máximo Atingido
              </div>
              <div className="text-base sm:text-lg font-extrabold font-mono text-amber-400 truncate">
                {formatSpeed(peakSpeedBps)}
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                Taxa máxima de transferência
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Volume de Dados Transferido */}
        {currentStep === 6 && (
          <div className="w-full h-full flex flex-col justify-center px-1 animate-in fade-in duration-150 min-w-0">
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-slate-400">Dados Baixados:</span>
              <span className="font-bold text-white">
                {formatBytes(progress.downloadedBytes)} de {formatBytes(progress.totalBytesExpected)}
              </span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-300"
                style={{ width: `${Math.max(2, progress.percent)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-mono">
              <span>Restam: {formatBytes(remainingBytes)}</span>
              <span className="text-emerald-400 font-bold">{progress.percent}% gravado</span>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER: Context Info + Dynamic "Clique para ver: Próxima Informação" Prompt */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1 pt-1 border-t border-slate-800/60 min-w-0">
        <span className="text-slate-500 truncate mr-2 font-sans text-[10px]">
          {currentStep === 0 && `Pico: ${formatSpeed(peakSpeedBps)} • Escala: ${formatSpeed(maxSample)}`}
          {currentStep === 1 && `Tempo real acumulado`}
          {currentStep === 2 && `Varredura de itens e hierarquia`}
          {currentStep === 3 && `Pasta atual em processamento`}
          {currentStep === 4 && `Estimativa com base na taxa de rede`}
          {currentStep === 5 && `Instantâneo: ${formatSpeed(currentSpeedBps)}`}
          {currentStep === 6 && `Taxa total de compressão e dados`}
        </span>

        <span className="inline-flex items-center space-x-1 text-[9px] text-emerald-400/90 group-hover:text-emerald-300 font-sans font-semibold shrink-0 transition-colors">
          <span>Clique para ver: {currentMeta.nextHint}</span>
          <span className="text-[11px] leading-none transition-transform group-hover:translate-x-0.5">
            {currentStep === TOTAL_STEPS - 1 ? '↺' : '→'}
          </span>
        </span>
      </div>
    </div>
  );
};
