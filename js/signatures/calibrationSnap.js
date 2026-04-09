// ═══════════════════════════════════════════════════════════
//  calibrationSnap.js — Mondelez signature lock behavior
// ═══════════════════════════════════════════════════════════

export function applyCalibrationSnapSignature(context) {
  const { time, elapsedMs, item } = context;
  const settle = Math.max(0, 1 - Math.min(1, elapsedMs / 1400));
  const phase = time * 7 + item.motionSeed * 8;

  return {
    bodyEligible: true,
    scaleMultiplier: 1.02 + (1 - settle) * 0.06,
    targetOffset: {
      x: Math.sin(phase) * 0.08 * settle,
      y: Math.cos(phase * 1.4) * 0.04 * settle,
      z: Math.sin(phase * 0.7) * 0.05 * settle,
    },
  };
}
