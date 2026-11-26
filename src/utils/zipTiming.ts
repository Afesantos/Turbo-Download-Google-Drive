import { ZipAllProgress } from '../services/zipExport';

export const formatDurationClock = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;
};

export const formatClockHHMM = (timestampMs: number): string => {
  return new Date(timestampMs).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export const formatDateTimeClock = (timestampMs: number): string => {
  return new Date(timestampMs).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export interface ZipTimingMetrics {
  startClock: string;
  startDateTime: string;
  predictedEndDateTime: string;
  elapsedFormatted: string;
  scanEstimateLabel: string;
  finishEstimateLabel: string;
}

export const computeZipTimingMetrics = (
  progress: ZipAllProgress,
  fallbackStartMs: number,
  nowMs: number
): ZipTimingMetrics => {
  const displayStartAt = progress.originalStartedAt || progress.startedAt || fallbackStartMs || nowMs;
  const sessionAnchor = progress.startedAt || fallbackStartMs || nowMs;
  const priorElapsedMs = progress.priorElapsedMs || 0;
  const sessionElapsedMs = Math.max(0, nowMs - sessionAnchor);
  const elapsedSeconds = Math.max(0, Math.floor((priorElapsedMs + sessionElapsedMs) / 1000));
  const startClock = formatClockHHMM(displayStartAt);
  const startDateTime = formatDateTimeClock(displayStartAt);
  const elapsedFormatted = formatDurationClock(elapsedSeconds);

  // 1. Estimated / actual time for scanning folder structure
  let scanEstimateLabel = 'Calculando...';
  const priorScanMs = progress.priorScanElapsedMs || 0;
  if (progress.phase === 'scanning') {
    const scanStart = progress.scanStartedAt || sessionAnchor;
    const scanElapsed = Math.max(1, (priorScanMs + Math.max(0, nowMs - scanStart)) / 1000);
    const scanned = progress.folderCount || 0;
    const discovered = progress.discoveredFolders || scanned;

    if (scanned >= 2 && discovered > scanned) {
      const remainingFolders = discovered - scanned;
      const estRemainingSec = Math.max(2, Math.ceil((scanElapsed / scanned) * remainingFolders));
      scanEstimateLabel = `~${formatDurationClock(estRemainingSec)} rest.`;
    } else if (scanned >= 1) {
      const estRemainingSec = Math.max(3, Math.ceil(scanElapsed * 0.45 + 2));
      scanEstimateLabel = `~${formatDurationClock(estRemainingSec)} rest.`;
    } else {
      scanEstimateLabel = 'Mapeando...';
    }
  } else {
    const currentScanMs =
      progress.scanCompletedAt && progress.scanStartedAt
        ? Math.max(0, progress.scanCompletedAt - progress.scanStartedAt)
        : 0;
    const totalScanMs = priorScanMs + currentScanMs;
    if (totalScanMs > 0) {
      const scanTotalSec = Math.max(1, Math.round(totalScanMs / 1000));
      scanEstimateLabel = `Concluído (${formatDurationClock(scanTotalSec)})`;
    } else {
      scanEstimateLabel = 'Restaurado';
    }
  }

  // 2. Predicted completion time and final date for full download
  let finishEstimateLabel = 'Calculando...';
  let predictedEndDateTime = 'Calculando...';
  if (progress.phase === 'scanning') {
    finishEstimateLabel = 'Aguardando pastas...';
    predictedEndDateTime = 'Aguardando pastas...';
  } else if (progress.phase === 'downloading') {
    const dlStart = progress.downloadStartedAt || progress.scanCompletedAt || sessionAnchor;
    const dlElapsed = Math.max(1, (nowMs - dlStart) / 1000);
    const resumedBytes = progress.initialResumedBytes || 0;
    const resumedFiles = progress.initialResumedFiles || 0;
    const sessionBytes = Math.max(0, progress.downloadedBytes - resumedBytes);
    const sessionFiles = Math.max(0, progress.processedFiles - resumedFiles);

    let remainingSeconds: number | null = null;
    if (
      progress.totalBytesExpected > 0 &&
      sessionBytes > 0 &&
      dlElapsed >= 1.5 &&
      progress.downloadedBytes < progress.totalBytesExpected
    ) {
      const bytesPerSec = sessionBytes / dlElapsed;
      const remainingBytes = Math.max(0, progress.totalBytesExpected - progress.downloadedBytes);
      const compressBufferSec = Math.max(2, Math.round(progress.totalBytesExpected / (45 * 1024 * 1024)));
      remainingSeconds = Math.max(1, Math.ceil(remainingBytes / bytesPerSec) + compressBufferSec);
    } else if (progress.totalFiles > 0 && sessionFiles > 0 && dlElapsed >= 1.5) {
      const secPerFile = dlElapsed / sessionFiles;
      const remainingFiles = Math.max(0, progress.totalFiles - progress.processedFiles);
      remainingSeconds = Math.max(1, Math.ceil(remainingFiles * secPerFile));
    }

    if (remainingSeconds !== null && Number.isFinite(remainingSeconds)) {
      const predictedEndTs = nowMs + remainingSeconds * 1000;
      const predictedEndClock = formatClockHHMM(predictedEndTs);
      finishEstimateLabel = `~${formatDurationClock(remainingSeconds)} (às ${predictedEndClock})`;
      predictedEndDateTime = formatDateTimeClock(predictedEndTs);
    } else {
      finishEstimateLabel = 'Calculando taxa...';
      predictedEndDateTime = 'Calculando taxa...';
    }
  } else if (progress.phase === 'compressing') {
    const remainingPct = Math.max(1, 100 - progress.percent);
    const remainingSec = Math.max(2, Math.ceil(remainingPct * 0.8));
    finishEstimateLabel = `Compactando (~${formatDurationClock(remainingSec)})`;
    predictedEndDateTime = formatDateTimeClock(nowMs + remainingSec * 1000);
  } else {
    finishEstimateLabel = 'Quase pronto...';
    predictedEndDateTime = formatDateTimeClock(nowMs);
  }

  return {
    startClock,
    startDateTime,
    predictedEndDateTime,
    elapsedFormatted,
    scanEstimateLabel,
    finishEstimateLabel,
  };
};
