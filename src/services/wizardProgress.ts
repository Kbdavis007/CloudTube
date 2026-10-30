/**
 * Wizard progress persistence.
 *
 * Provisioning makes real Cloudflare API calls that create resources, so losing
 * track of which steps finished forces a user to redo expensive work. This keeps
 * a small record in localStorage. Credentials are deliberately NOT stored here:
 * they live in the AES-GCM encrypted vault (see crypto.ts).
 */

import type { WizardProgress, WizardStepId, WizardState } from '../types';
import { isVaultConfigured } from './crypto';

const STORAGE_KEY = 'cloudtube_wizard_progress';

const emptyCompleted = (): Record<WizardStepId, boolean> => ({
  auth: false,
  provision: false,
  encryption: false,
  health: false,
  ai: false,
  complete: false,
});

export const loadWizardProgress = (): WizardProgress | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WizardProgress>;
    const progress: WizardProgress = {
      completed: { ...emptyCompleted(), ...(parsed.completed ?? {}) },
      aiConfigured: Boolean(parsed.aiConfigured),
      details: parsed.details ?? {},
      lastStep: typeof parsed.lastStep === 'number' ? parsed.lastStep : 1,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
    // A record with nothing in it would show a false "resumed" banner, so treat
    // it as absent.
    return isMeaningfulProgress(progress) ? progress : null;
  } catch {
    // Corrupt or unavailable storage must not block the wizard.
    return null;
  }
};

/** True once the user has actually gotten somewhere worth remembering. */
export const isMeaningfulProgress = (progress: WizardProgress): boolean =>
  progress.lastStep > 1 ||
  progress.aiConfigured ||
  Object.values(progress.completed).some(Boolean);

export const saveWizardProgress = (progress: WizardProgress): void => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...progress, updatedAt: new Date().toISOString() })
    );
  } catch {
    // Quota or private-mode failures are non-fatal.
  }
};

export const clearWizardProgress = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

/**
 * Rebuilds the progress record from live wizard state, so a caller never has to
 * remember which flags to flip. `step` is the step currently on screen.
 */
export const deriveProgress = (
  step: number,
  state: WizardState,
  aiConfigured: boolean
): WizardProgress => {
  const statusValues = Object.values(state.status);
  const provisionDone =
    statusValues.length > 0 && statusValues.every((s) => s === 'success');
  const healthDone = Object.values(state.validationResults).every(Boolean);

  return {
    completed: {
      auth: Boolean(state.accountId && state.apiToken),
      provision: provisionDone,
      encryption: isVaultConfigured(),
      health: healthDone,
      ai: aiConfigured,
      complete: step > 6,
    },
    aiConfigured,
    details: state.details,
    lastStep: step,
    updatedAt: new Date().toISOString(),
  };
};
