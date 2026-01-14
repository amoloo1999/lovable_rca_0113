import type { RCAWizardState } from '@/hooks/useRCAWizard';

const STORAGE_KEY = 'rca-wizard-state';
const STORAGE_VERSION = '1.0';

interface StoredState {
  version: string;
  timestamp: number;
  state: RCAWizardState;
}

// Save wizard state to localStorage
export function saveWizardState(state: RCAWizardState): void {
  try {
    const storedState: StoredState = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      state,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
  } catch (error) {
    console.error('Failed to save wizard state:', error);
  }
}

// Load wizard state from localStorage
export function loadWizardState(): RCAWizardState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: StoredState = JSON.parse(stored);
    
    // Check version compatibility
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('Wizard state version mismatch, clearing storage');
      clearWizardState();
      return null;
    }

    // Check if state is too old (older than 7 days)
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - parsed.timestamp > sevenDaysInMs) {
      console.warn('Wizard state expired, clearing storage');
      clearWizardState();
      return null;
    }

    return parsed.state;
  } catch (error) {
    console.error('Failed to load wizard state:', error);
    return null;
  }
}

// Clear wizard state from localStorage
export function clearWizardState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear wizard state:', error);
  }
}

// Check if there's a saved state
export function hasSavedState(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

// Get the timestamp of the last saved state
export function getLastSavedTimestamp(): number | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const parsed: StoredState = JSON.parse(stored);
    return parsed.timestamp;
  } catch (error) {
    return null;
  }
}
