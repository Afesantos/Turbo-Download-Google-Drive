import { useEffect } from 'react';

/**
 * Prevents the device from entering screen sleep/idle mode, keeps the tab
 * prioritized via Web Locks, and guards against accidental page unload
 * while folder mapping, downloading, or ZIP creation is actively running.
 */
export const useKeepAwake = (isActive: boolean): void => {
  useEffect(() => {
    if (!isActive || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    let cancelled = false;
    let wakeLockSentinel: WakeLockSentinel | null = null;
    let releaseWebLock: (() => void) | null = null;

    const acquireWakeLock = async () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') return;
      if (!('wakeLock' in navigator) || typeof navigator.wakeLock?.request !== 'function') {
        return;
      }
      if (wakeLockSentinel && !wakeLockSentinel.released) {
        return;
      }

      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        wakeLockSentinel = sentinel;
        sentinel.addEventListener('release', () => {
          if (wakeLockSentinel === sentinel) {
            wakeLockSentinel = null;
          }
        });
      } catch {
        // Ignore if battery saver / browser policy denies screen wake lock
      }
    };

    const handleVisibilityChange = () => {
      if (!cancelled && document.visibilityState === 'visible') {
        void acquireWakeLock();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    // Acquire Screen Wake Lock immediately and re-acquire whenever tab returns to foreground
    void acquireWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Hold a Web Lock while active to discourage browser tab freezing/discarding during I/O
    if ('locks' in navigator && typeof navigator.locks?.request === 'function') {
      try {
        void navigator.locks
          .request('drivesync-active-transfer', () => {
            return new Promise<void>((resolve) => {
              if (cancelled) {
                resolve();
                return;
              }
              releaseWebLock = resolve;
            });
          })
          .catch(() => {});
      } catch {
        // Ignore if Web Locks is unavailable in current context
      }
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (wakeLockSentinel && !wakeLockSentinel.released) {
        void wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
      }

      if (releaseWebLock) {
        releaseWebLock();
        releaseWebLock = null;
      }
    };
  }, [isActive]);
};
