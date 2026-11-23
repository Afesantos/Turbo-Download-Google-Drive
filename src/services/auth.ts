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

// Google Drive Read-Only scope for browsing, listing, and downloading files
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
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

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

/**
 * Initialize auth state listener and handle redirect result if popup was blocked.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check redirect result on load
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          if (onAuthSuccess) onAuthSuccess(result.user, cachedAccessToken);
        }
      }
    })
    .catch((err) => {
      console.warn('Erro ao processar resultado do redirect:', err);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If user is logged in via redirect but credential isn't in memory yet, try getting OAuth credential
        const credential = GoogleAuthProvider.credentialFromResult(await getRedirectResult(auth) as any);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else {
          // If no OAuth token in memory, keep user authenticated if possible or prompt re-auth for Drive access
          if (onAuthSuccess && cachedAccessToken) {
            onAuthSuccess(user, cachedAccessToken);
          } else {
            // If we lack Drive scope token, we can still let user connect or use cached token if present
            if (onAuthSuccess && auth.currentUser) {
              // Try to pass dummy or proceed
            }
          }
        }
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Must be triggered by user interaction (button click).
 * Falls back to signInWithRedirect if popup is blocked (common in iframes).
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
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.warn('Popup bloqueado ou falhou, tentando redirecionamento (redirect):', error);
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.message?.includes('popup') ||
      error?.message?.includes('cross-origin')
    ) {
      try {
        await signInWithRedirect(auth, provider);
        return null;
      } catch (redirectErr) {
        console.error('Erro no signInWithRedirect:', redirectErr);
        throw redirectErr;
      }
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
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
};

/**
 * Sign out and clear in-memory token.
 */
export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
