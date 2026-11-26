import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App instance safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Google Drive scopes: read-only across Drive + drive.file to save/manage app tracking files in Drive root
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
// Request offline access prompt if needed to ensure fresh tokens
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token strictly in memory (per security guidelines)
let cachedAccessToken: string | null = null;
// Track approximate OAuth2 access token expiration (Google tokens usually expire in 3600s)
let tokenExpiresAt: number = 0;

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

const updateTokenExpiration = (result?: any) => {
  const rawExpiresIn = Number(result?._tokenResponse?.expiresIn);
  const ttlSeconds = Number.isFinite(rawExpiresIn) && rawExpiresIn > 120 ? rawExpiresIn : 3500;
  // Subtract 3 minutes safety buffer
  tokenExpiresAt = Date.now() + Math.max(60, ttlSeconds - 180) * 1000;
};

/**
 * Initialize auth state listener and handle redirect result if popup was blocked.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check redirect result once on load
  const redirectPromise = getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          updateTokenExpiration(result);
          if (onAuthSuccess) onAuthSuccess(result.user, cachedAccessToken);
        }
      }
    })
    .catch((err) => {
      console.warn('Erro ao processar resultado do redirect:', err);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    await redirectPromise;
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Access tokens are kept strictly in memory; after a page reload, prompt re-authentication
        cachedAccessToken = null;
        tokenExpiresAt = 0;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      tokenExpiresAt = 0;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Must be triggered by user interaction (button click).
 * Falls back to signInWithRedirect only if popup is blocked outside an iframe.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    updateTokenExpiration(result);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      return null;
    }

    const inIframe = (() => {
      try {
        return typeof window !== 'undefined' && window.self !== window.top;
      } catch {
        return true;
      }
    })();

    if (error?.code === 'auth/popup-blocked' && !inIframe) {
      console.warn('Popup bloqueado, tentando redirecionamento (redirect):', error);
      await signInWithRedirect(auth, provider);
      return null;
    }

    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Renew OAuth2 access token using the current signed-in user's email hint.
 * Must be invoked directly from a user interaction (click) to avoid popup blockers.
 */
export const refreshGoogleAccessToken = async (
  loginHint?: string | null
): Promise<{ user: User; accessToken: string } | null> => {
  const hint = loginHint || auth.currentUser?.email || undefined;
  const refreshProvider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => refreshProvider.addScope(scope));
  if (hint) {
    refreshProvider.setCustomParameters({
      login_hint: hint,
    });
  } else {
    refreshProvider.setCustomParameters({
      prompt: 'select_account',
    });
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, refreshProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao renovar token de acesso do Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    updateTokenExpiration(result);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      return null;
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Fast lightweight check whether the current Google Drive OAuth2 token is still accepted by Google.
 */
export const validateAccessToken = async (accessToken: string): Promise<boolean> => {
  if (!accessToken) return false;
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.ok;
  } catch {
    return true; // Network glitch shouldn't falsely invalidate token
  }
};

export const isTokenLikelyExpired = (): boolean => {
  if (!cachedAccessToken) return true;
  if (!tokenExpiresAt) return false;
  return Date.now() >= tokenExpiresAt;
};

/**
 * Get current in-memory access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Manually update access token in memory if re-authenticated
 */
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (!token) {
    tokenExpiresAt = 0;
  } else if (!tokenExpiresAt) {
    tokenExpiresAt = Date.now() + 50 * 60 * 1000;
  }
};

/**
 * Sign out and clear in-memory token.
 */
export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  tokenExpiresAt = 0;
};
