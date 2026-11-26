/**
 * Web Worker-based Timers
 *
 * Browsers (Chromium/Chrome, Edge, Firefox, Safari) aggressively throttle
 * main-thread `setInterval` and `setTimeout` in background tabs (clamping to
 * 1,000ms minimum, and after 5 minutes in background, slowing down to 60,000ms
 * or freezing the tab).
 *
 * Web Workers run on an isolated background thread and are strictly exempt
 * from the 1-minute intensive background timer throttling. This utility creates
 * an inline worker that guarantees exact, uninterrupted interval ticks for
 * background downloads, speed telemetry, and real-time Google Drive auto-sync.
 */

type TimerCallback = () => void;

interface WorkerTimerInstance {
  worker: Worker | null;
  callbacks: Map<number, TimerCallback>;
  nextId: number;
}

let instance: WorkerTimerInstance | null = null;

const createWorker = (): Worker | null => {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof Blob === 'undefined') {
    return null;
  }

  try {
    const workerScript = `
      var timers = new Map();
      self.onmessage = function(e) {
        var data = e.data;
        if (!data) return;
        var action = data.action;
        var id = data.id;
        var delay = data.delay;

        if (action === 'setInterval') {
          var intId = setInterval(function() {
            self.postMessage({ id: id, type: 'interval' });
          }, delay);
          timers.set(id, intId);
        } else if (action === 'clearInterval') {
          var existing = timers.get(id);
          if (existing !== undefined) {
            clearInterval(existing);
            timers.delete(id);
          }
        } else if (action === 'setTimeout') {
          var timeoutId = setTimeout(function() {
            self.postMessage({ id: id, type: 'timeout' });
            timers.delete(id);
          }, delay);
          timers.set(id, timeoutId);
        } else if (action === 'clearTimeout') {
          var existingTimeout = timers.get(id);
          if (existingTimeout !== undefined) {
            clearTimeout(existingTimeout);
            timers.delete(id);
          }
        }
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    // Revoke object URL after worker starts
    URL.revokeObjectURL(url);
    return worker;
  } catch (err) {
    console.warn('Web Worker timer could not be initialized, falling back to window timers:', err);
    return null;
  }
};

const getWorkerInstance = (): WorkerTimerInstance => {
  if (!instance) {
    const worker = createWorker();
    const callbacks = new Map<number, TimerCallback>();

    if (worker) {
      worker.onmessage = (e: MessageEvent<{ id: number; type: 'interval' | 'timeout' }>) => {
        const { id, type } = e.data || {};
        const cb = callbacks.get(id);
        if (cb) {
          try {
            cb();
          } catch (err) {
            console.error('Erro no callback do timer de segundo plano:', err);
          }
          if (type === 'timeout') {
            callbacks.delete(id);
          }
        }
      };
    }

    instance = {
      worker,
      callbacks,
      nextId: 1,
    };
  }
  return instance;
};

/**
 * Creates an interval that runs reliably even if other browser tabs are active.
 */
export const workerSetInterval = (callback: TimerCallback, intervalMs: number): number => {
  const inst = getWorkerInstance();
  const id = inst.nextId++;

  if (inst.worker) {
    inst.callbacks.set(id, callback);
    inst.worker.postMessage({
      action: 'setInterval',
      id,
      delay: Math.max(10, intervalMs),
    });
    return id;
  }

  // Graceful fallback to standard window.setInterval if Web Workers are restricted
  const fallbackId = window.setInterval(callback, intervalMs);
  inst.callbacks.set(id, () => window.clearInterval(fallbackId));
  return id;
};

/**
 * Clears an interval created by workerSetInterval.
 */
export const workerClearInterval = (id: number): void => {
  if (!instance) return;
  const inst = instance;

  if (inst.worker) {
    inst.callbacks.delete(id);
    inst.worker.postMessage({
      action: 'clearInterval',
      id,
    });
    return;
  }

  const fallbackCleanup = inst.callbacks.get(id);
  if (fallbackCleanup) {
    fallbackCleanup();
    inst.callbacks.delete(id);
  }
};

/**
 * Creates a timeout that runs reliably in background tabs.
 */
export const workerSetTimeout = (callback: TimerCallback, timeoutMs: number): number => {
  const inst = getWorkerInstance();
  const id = inst.nextId++;

  if (inst.worker) {
    inst.callbacks.set(id, callback);
    inst.worker.postMessage({
      action: 'setTimeout',
      id,
      delay: Math.max(0, timeoutMs),
    });
    return id;
  }

  const fallbackId = window.setTimeout(callback, timeoutMs);
  inst.callbacks.set(id, () => window.clearTimeout(fallbackId));
  return id;
};

/**
 * Clears a timeout created by workerSetTimeout.
 */
export const workerClearTimeout = (id: number): void => {
  if (!instance) return;
  const inst = instance;

  if (inst.worker) {
    inst.callbacks.delete(id);
    inst.worker.postMessage({
      action: 'clearTimeout',
      id,
    });
    return;
  }

  const fallbackCleanup = inst.callbacks.get(id);
  if (fallbackCleanup) {
    fallbackCleanup();
    inst.callbacks.delete(id);
  }
};

/**
 * Returns true if the Web Worker timer engine is active on this browser.
 */
export const isWorkerTimerActive = (): boolean => {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined' && instance?.worker !== null;
};
