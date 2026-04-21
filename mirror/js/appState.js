// ═══════════════════════════════════════════════════════════
//  appState.js — Central app state for phase, selection,
//  and runtime error synchronization across modules
// ═══════════════════════════════════════════════════════════

import { PHASE } from './config.js';

const appState = {
  phase: PHASE.BOOT,
  activeOptionId: null,
  selectedOptionId: null,
  errorMessage: null,
};

const listeners = new Set();

function snapshotState() {
  return { ...appState };
}

function notifyListeners(previousState) {
  const nextState = snapshotState();
  for (const listener of listeners) {
    listener(nextState, previousState);
  }
}

export function getAppState() {
  return snapshotState();
}

export function subscribeAppState(listener, { immediate = false } = {}) {
  listeners.add(listener);

  if (immediate) {
    listener(snapshotState(), null);
  }

  return () => listeners.delete(listener);
}

export function updateAppState(patch) {
  if (!patch || typeof patch !== 'object') return snapshotState();

  const previousState = snapshotState();
  let changed = false;

  for (const [key, value] of Object.entries(patch)) {
    if (appState[key] !== value) {
      appState[key] = value;
      changed = true;
    }
  }

  if (changed) {
    notifyListeners(previousState);
  }

  return snapshotState();
}

export function applyPhaseState({ phase, selectedOptionId = null, errorMessage = null } = {}) {
  const nextState = {
    phase: phase ?? appState.phase,
    selectedOptionId,
    errorMessage,
  };

  if (selectedOptionId) {
    nextState.activeOptionId = selectedOptionId;
  }

  return updateAppState(nextState);
}