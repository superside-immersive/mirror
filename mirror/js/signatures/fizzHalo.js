// ═══════════════════════════════════════════════════════════
//  fizzHalo.js — Coca-Cola signature fizz behavior
// ═══════════════════════════════════════════════════════════

export function applyFizzHaloSignature(context) {
  const { time, elapsedMs, item } = context;
  const settle = Math.max(0, 1 - Math.min(1, elapsedMs / 1800));
  const phase = time * 4.2 + item.motionSeed * 12;
  const bubbleLift = Math.abs(Math.sin(phase)) * 0.18 * settle;

  return {
    bodyEligible: true,
    scaleMultiplier: 1.04 + (1 - settle) * 0.08,
    targetOffset: {
      x: Math.cos(phase * 0.8) * 0.04 * settle,
      y: bubbleLift,
      z: Math.sin(phase * 1.2) * 0.03 * settle,
    },
  };
}
