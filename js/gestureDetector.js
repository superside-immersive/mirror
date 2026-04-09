// ═══════════════════════════════════════════════════════════
//  gestureDetector.js — Hand raise detection and the source
//  of truth phase state machine for the AMC mirror
// ═══════════════════════════════════════════════════════════

import {
  PHASE,
  HAND_RAISE_Y_OFFSET,
  POSE_PRESENT_FRAMES,
  POSE_LOST_FRAMES,
  HAND_RAISE_FRAMES,
  GESTURE_COOLDOWN_MS,
  GESTURE_TIMEOUT_MS,
  CHAOS_AUTO_GESTURE_MS,
  POSE_LOST_RETURN_MS,
} from './config.js';
import { DEFAULT_PRODUCT_OPTION_ID } from './productOptions.js';

export function detectHandRaise(landmarks) {
  if (!landmarks || landmarks.length < 33) return { left: false, right: false };

  const lShoulder = landmarks[11];
  const rShoulder = landmarks[12];
  const lElbow = landmarks[13];
  const rElbow = landmarks[14];
  const lWrist = landmarks[15];
  const rWrist = landmarks[16];

  return {
    left: lWrist.y < lShoulder.y + HAND_RAISE_Y_OFFSET || lElbow.y < lShoulder.y + HAND_RAISE_Y_OFFSET,
    right: rWrist.y < rShoulder.y + HAND_RAISE_Y_OFFSET || rElbow.y < rShoulder.y + HAND_RAISE_Y_OFFSET,
  };
}

export class PhaseStateMachine {
  constructor() {
    this.ready = false;
    this.currentPhase = PHASE.BOOT;
    this.phaseEnteredAt = performance.now();
    this.selectedOptionId = null;
    this.errorMessage = null;
    this.presentFrames = 0;
    this.lostFrames = 0;
    this.handRaiseFrames = 0;
    this.gestureCooldownUntil = 0;
    this.harmonyLocked = false;
  }

  getTimeInPhase(now = performance.now()) {
    return now - this.phaseEnteredAt;
  }

  markReady() {
    this.ready = true;
    return this.forcePhase(PHASE.IDLE, null);
  }

  setError(message) {
    this.ready = true;
    this.errorMessage = message;
    return this.forcePhase(PHASE.ERROR, this.selectedOptionId, message);
  }

  selectOption(optionId) {
    this.selectedOptionId = optionId || DEFAULT_PRODUCT_OPTION_ID;
    this.harmonyLocked = true;
    return this.forcePhase(PHASE.HARMONY, this.selectedOptionId);
  }

  update(poseDetected, landmarks) {
    const now = performance.now();

    if (!this.ready) {
      return {
        phase: this.currentPhase,
        changed: false,
        selectedOptionId: this.selectedOptionId,
        errorMessage: this.errorMessage,
      };
    }

    if (this.currentPhase === PHASE.ERROR) {
      return {
        phase: this.currentPhase,
        changed: false,
        selectedOptionId: this.selectedOptionId,
        errorMessage: this.errorMessage,
      };
    }

    if (poseDetected) {
      this.presentFrames += 1;
      this.lostFrames = 0;
    } else {
      this.lostFrames += 1;
      this.presentFrames = 0;
      this.handRaiseFrames = 0;
    }

    const stablePose = this.presentFrames >= POSE_PRESENT_FRAMES;
    const stablePoseLost = this.lostFrames >= POSE_LOST_FRAMES;

    if (stablePose && landmarks) {
      const hands = detectHandRaise(landmarks);
      this.handRaiseFrames = (hands.left || hands.right) ? this.handRaiseFrames + 1 : 0;
    } else {
      this.handRaiseFrames = 0;
    }

    let targetPhase = this.currentPhase;

    if (stablePoseLost) {
      targetPhase = PHASE.IDLE;
    } else if (!stablePose) {
      targetPhase = this.currentPhase === PHASE.IDLE ? PHASE.IDLE : this.currentPhase;
    } else if (this.harmonyLocked) {
      targetPhase = PHASE.HARMONY;
    } else if (this.currentPhase === PHASE.GESTURE && this.getTimeInPhase(now) >= GESTURE_TIMEOUT_MS) {
      targetPhase = PHASE.CHAOS;
      this.gestureCooldownUntil = now + GESTURE_COOLDOWN_MS;
    } else if (this.currentPhase === PHASE.CHAOS && now >= this.gestureCooldownUntil && this.getTimeInPhase(now) >= CHAOS_AUTO_GESTURE_MS) {
      targetPhase = PHASE.GESTURE;
    } else if (now >= this.gestureCooldownUntil && this.handRaiseFrames >= HAND_RAISE_FRAMES) {
      targetPhase = PHASE.GESTURE;
    } else {
      targetPhase = PHASE.CHAOS;
    }

    if (targetPhase !== this.currentPhase) {
      return this.forcePhase(targetPhase, this.selectedOptionId, this.errorMessage);
    }

    return {
      phase: this.currentPhase,
      changed: false,
      selectedOptionId: this.selectedOptionId,
      errorMessage: this.errorMessage,
    };
  }

  forcePhase(phase, optionId = this.selectedOptionId, errorMessage = this.errorMessage) {
    const changed = this.currentPhase !== phase;
    this.currentPhase = phase;
    this.phaseEnteredAt = performance.now();
    this.selectedOptionId = phase === PHASE.IDLE ? null : (optionId ?? this.selectedOptionId ?? null);
    this.errorMessage = errorMessage || null;
    this.harmonyLocked = phase === PHASE.HARMONY;

    if (phase === PHASE.IDLE) {
      this.presentFrames = 0;
      this.lostFrames = 0;
      this.handRaiseFrames = 0;
    }

    return {
      phase,
      changed,
      selectedOptionId: this.selectedOptionId,
      errorMessage: this.errorMessage,
    };
  }

  reset() {
    this.ready = false;
    this.currentPhase = PHASE.BOOT;
    this.phaseEnteredAt = performance.now();
    this.selectedOptionId = null;
    this.errorMessage = null;
    this.presentFrames = 0;
    this.lostFrames = 0;
    this.handRaiseFrames = 0;
    this.harmonyLocked = false;
  }
}
