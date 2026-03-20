// ═══════════════════════════════════════════════════════════
//  gestureDetector.js — Detects gestures from MediaPipe landmarks
//  and drives UI phase transitions with debounce/hysteresis
// ═══════════════════════════════════════════════════════════

import {
  PHASE, HAND_RAISE_Y_OFFSET,
  PHASE_DEBOUNCE_MS, PHASE_EXIT_DELAY_MS, DEFAULT_SELECTION_COLOR,
} from './config.js';

// ─── Hand Raise Detection ───────────────────────────────────
// MediaPipe Y axis: negative is UP. If wrist.y < shoulder.y + offset → raised.
// Landmarks: 11=L shoulder, 12=R shoulder, 15=L wrist, 16=R wrist

export function detectHandRaise(landmarks) {
  if (!landmarks || landmarks.length < 33) return { left: false, right: false };

  const lShoulder = landmarks[11];
  const rShoulder = landmarks[12];
  const lWrist    = landmarks[15];
  const rWrist    = landmarks[16];

  return {
    left:  lWrist.y < lShoulder.y + HAND_RAISE_Y_OFFSET,
    right: rWrist.y < rShoulder.y + HAND_RAISE_Y_OFFSET,
  };
}

// ─── Brand Selection Detection ──────────────────────────────
// Check if a raised hand's wrist X position is near one of the
// brand logos. Since we're in mirror mode, we map screen-relative
// positions. The brands sit at roughly -0.3, 0, +0.3 in normalized X.

const BRAND_X_POSITIONS = [
  { id: 'white', x: -0.25 },   // Brand A (left)
  { id: 'black', x:  0.00 },   // Brand B (center)
  { id: 'blue',  x:  0.25 },   // Brand C (right)
];
const BRAND_SELECT_RADIUS = 0.18;   // how close wrist X must be to brand center

export function detectBrandSelection(landmarks) {
  if (!landmarks || landmarks.length < 33) return null;

  const hands = detectHandRaise(landmarks);
  if (!hands.left && !hands.right) return null;

  // Use the raised hand's wrist position
  // In mirrored view, x is negated. MediaPipe x is 0..1 range.
  const wrist = hands.right ? landmarks[16] : landmarks[15];
  const wx = -wrist.x;   // mirror

  for (const brand of BRAND_X_POSITIONS) {
    if (Math.abs(wx - brand.x) < BRAND_SELECT_RADIUS) {
      return brand.id;
    }
  }
  return null;
}

// ─── Phase State Machine ────────────────────────────────────
// Manages transitions between phases with debounce to prevent flickering.
// Rules:
//   No pose detected → IDLE
//   Pose detected, no gesture → CHAOS
//   Hand raised → GESTURE
//   Brand button clicked → HARMONY (stays locked until reset)

export class PhaseStateMachine {
  constructor() {
    this.currentPhase  = PHASE.IDLE;
    this.pendingPhase  = PHASE.IDLE;
    this.pendingStart  = 0;
    this.selectedBrand = null;
    this.harmonyLocked = false;   // once HARMONY triggers, stay locked until pose lost
  }

  /**
   * Update the state machine. Call this every frame.
   * @param {boolean} poseActive - Is a body currently detected?
   * @param {object|null} landmarks - Smoothed world landmarks
   * @returns {{ phase: number, changed: boolean, selectedBrand: string|null }}
   */
  update(poseActive, landmarks) {
    const now = performance.now();
    let targetPhase = PHASE.IDLE;
    let brand = null;

    if (this.harmonyLocked) {
      // Stay in HARMONY once triggered via button click
      targetPhase = PHASE.HARMONY;
      brand = this.selectedBrand;
    } else if (!poseActive) {
      targetPhase = PHASE.IDLE;
      this.selectedBrand = null;
    } else {
      // Pose is active — check gestures
      const hands = detectHandRaise(landmarks);
      const anyHandRaised = hands.left || hands.right;

      if (anyHandRaised) {
        // Hand raised → GESTURE only.
        // HARMONY is triggered exclusively by clicking brand buttons.
        targetPhase = PHASE.GESTURE;
      } else {
        targetPhase = PHASE.CHAOS;
      }
    }

    // Debounce logic
    if (targetPhase !== this.pendingPhase) {
      this.pendingPhase = targetPhase;
      this.pendingStart = now;
    }

    const debounce = targetPhase < this.currentPhase
      ? PHASE_EXIT_DELAY_MS    // going down takes longer (hysteresis)
      : PHASE_DEBOUNCE_MS;     // going up is faster

    const changed = (
      this.pendingPhase !== this.currentPhase &&
      (now - this.pendingStart) >= debounce
    );

    if (changed) {
      this.currentPhase  = this.pendingPhase;
      this.selectedBrand = brand;

      if (this.currentPhase === PHASE.HARMONY && brand) {
        this.harmonyLocked = true;
      }
    }

    return {
      phase:         this.currentPhase,
      changed,
      selectedBrand: this.currentPhase === PHASE.HARMONY ? (this.selectedBrand || DEFAULT_SELECTION_COLOR) : null,
    };
  }

  /** Force a specific phase (for debug buttons) */
  forcePhase(phase, brand = null) {
    const changed = this.currentPhase !== phase;
    this.currentPhase  = phase;
    this.pendingPhase  = phase;
    this.selectedBrand = brand;
    this.harmonyLocked = phase === PHASE.HARMONY;
    return { phase, changed, selectedBrand: brand };
  }

  /** Reset to idle */
  reset() {
    this.currentPhase  = PHASE.IDLE;
    this.pendingPhase  = PHASE.IDLE;
    this.selectedBrand = null;
    this.harmonyLocked = false;
  }
}
