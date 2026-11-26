import { ZipAllProgress } from '../services/zipExport';

export const formatDurationClock = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatClockHHMM = (timestampMs: number): string => {
  return new Date(timestampMs).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export interface ZipTimingMetrics {
  startClock: string;
  elapsedFormatted: string;
  scanEstimateLabel: string;
  finishEstimateLabel: string;
}

export const computeZipTimingMetrics = (
  progress: ZipAllProgress,
  fallbackStartMs: number,
  nowMs: number
): ZipTimingMetrics => {
  const startedAt = progress.startedAt || fallbackStartMs || nowMs;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  const startClock = formatClockHHMM(startedAt);
  const elapsedFormatted = formatDurationClock(elapsedSeconds);

  // 1. Estimated / actual time for scanning folder structure
  let scanEstimateLabel = 'Calculando...';
  if (progress.phase === 'scanning') {
    const scanStart = progress.scanStartedAt || startedAt;
    const scanElapsed = Math.max(1, (nowMs - scanStart) / 1000);
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
  } else if (progress.scanCompletedAt && progress.scanStartedAt) {
    const scanTotalSec = Math.max(1, Math.round((progress.scanCompletedAt - progress.scanStartedAt) / 1000));
    scanEstimateLabel = `Concluído (${formatDurationClock(scanTotalSec)})`;
  } else {
    scanEstimateLabel = 'Restaurado';
  }

  // 2. Predicted completion time for full download
  let finishEstimateLabel = 'Calculando...';
  if (progress.phase === 'scanning') {
    finishEstimateLabel = 'Aguardando pastas...';
  } else if (progress.phase === 'downloading') {
    const dlStart = progress.downloadStartedAt || progress.scanCompletedAt || startedAt;
    const dlElapsed = Math.max(1, (nowMs - dlStart) / 1000);
    const resumedBytes = progress.initialResumedBytes || 0;
    const resumedFiles = progress.initialResumedFiles || 0;
    const sessionBytes = Math.max(0, progress.downloadedBytes - resumedBytes);
    const sessionFiles = Math.max(0, progress.processedFiles - resumedFiles);

    let remainingSeconds: number | null = null;
    if (progress.totalBytesExpected > 0 && sessionBytes > 0 && dlElapsed >= 1.5) {
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
      const predictedEndClock = formatClockHHMM(nowMs + remainingSeconds * 1000);
      finishEstimateLabel = `~${formatDurationClock(remainingSeconds)} (às ${predictedEndClock})`;
    } else {
      finishEstimateLabel = 'Calculando taxa...';
    }
  } else if (progress.phase === 'compressing') {
    const remainingPct = Math.max(1, 100 - progress.percent);
    finishEstimateLabel = `Compactando (~${Math.max(2, Math.ceil(remainingPct * 0.8))}s)`;
  } else {
    finishEstimateLabel = 'Quase pronto...';
  }

  return {
    startClock,
    elapsedFormatted,
    scanEstimateLabel,
    finishEstimateLabel,
  };
};
