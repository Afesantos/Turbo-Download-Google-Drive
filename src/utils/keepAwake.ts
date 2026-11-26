import { useEffect, useRef } from 'react';

/**
 * Inaudible 1-second WAV audio loop data URI.
 * Chromium, Edge, Safari, and Firefox Page Lifecycle specifications strictly exempt
 * tabs with active media playback from CPU throttling, timer clamping (no 1-minute throttles),
 * tab freezing, and proactive memory discarding.
 */
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let silentAudioElement: HTMLAudioElement | null = null;
let activeHoldersCount = 0;

const startSilentAudioKeepAlive = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  activeHoldersCount++;
  if (silentAudioElement) {
    if (silentAudioElement.paused) {
      silentAudioElement.play().catch(() => {});
    }
    return;
  }

  try {
    const audio = new Audio(SILENT_WAV_DATA_URI);
    audio.loop = true;
    audio.volume = 0.01; // virtually inaudible
    audio.setAttribute('aria-hidden', 'true');
    audio.play().catch(() => {
      // Audio autoplay may await first user click gesture
    });
    silentAudioElement = audio;
  } catch {
    // Graceful fallback if audio context is blocked
  }
};

const stopSilentAudioKeepAlive = () => {
  activeHoldersCount = Math.max(0, activeHoldersCount - 1);
  if (activeHoldersCount === 0 && silentAudioElement) {
    try {
      silentAudioElement.pause();
      silentAudioElement.src = '';
    } catch {}
    silentAudioElement = null;
  }
};

/**
 * Prevents the device from entering screen sleep/idle mode, keeps the tab
 * prioritized via Web Locks, guards against accidental page unload,
 * and maintains continuous background execution via Silent Media & Web Worker timers
 * even if other browser tabs are active.
 */
export const useKeepAwake = (isActive: boolean): void => {
  const isAudioActiveRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    let cancelled = false;
    let wakeLockSentinel: WakeLockSentinel | null = null;
    let releaseWebLock: (() => void) | null = null;

    // 1. Screen Wake Lock (Active when tab is visible; automatically re-acquired on foreground return)
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
        // Battery saver or system policy may deny screen wake lock
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

    // 2. Start Silent Audio Throttling Guard
    startSilentAudioKeepAlive();
    isAudioActiveRef.current = true;

    // 3. Acquire Screen Wake Lock and set visibility handlers
    void acquireWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 4. Web Locks API: Hold a lock while active to prevent tab discarding by Chrome Memory Saver
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

      if (isAudioActiveRef.current) {
        stopSilentAudioKeepAlive();
        isAudioActiveRef.current = false;
      }

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

/**
 * Requests native desktop notification permission if supported.
 */
export const requestDesktopNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
};

/**
 * Sends a native desktop notification when the tab is in the background.
 */
export const sendBackgroundNotification = (title: string, options?: NotificationOptions): void => {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return;
  }

  // Only trigger if document is hidden (user is in another tab or minimized)
  if (document.visibilityState === 'hidden') {
    try {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
    } catch {
      // Ignore if blocked in iframe
    }
  }
};
