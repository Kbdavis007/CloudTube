/**
 * Google Authentication & Workspace/YouTube OAuth Service
 * Uses Firebase Authentication SDK with GoogleAuthProvider requesting full YouTube API scopes
 * and in-memory access token caching as required by security guidelines.
 */

import {
  getAuth,
  signInWithPopup,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import { firebaseApp } from './firebaseApp';

export const auth = getAuth(firebaseApp);

// Configure Google OAuth Provider with full YouTube & user profile scopes
export const googleProvider = new GoogleAuthProvider();

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

YOUTUBE_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});

// Flag to track ongoing popup
let isSigningIn = false;

// In-memory cache for OAuth access token (MANDATORY: never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      console.warn('Google sign-in succeeded, but credential accessToken was not returned in popup.');
    }

    cachedAccessToken = credential?.accessToken || null;
    return {
      user: result.user,
      accessToken: cachedAccessToken || '',
    };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const hasCachedAccessToken = (): boolean => Boolean(cachedAccessToken);

// Re-run the Google popup to obtain a fresh YouTube OAuth access token.
// Needed after a page reload (the token is memory-only) or once it expires.
export const refreshGoogleAccessToken = async (): Promise<string> => {
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Not signed in with Google.');
  }

  const result = await reauthenticateWithPopup(current, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Google did not return an access token. Please sign in again.');
  }

  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
