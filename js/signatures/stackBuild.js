// ═══════════════════════════════════════════════════════════
//  stackBuild.js — Kraft Heinz signature build behavior
// ═══════════════════════════════════════════════════════════

export function applyStackBuildSignature(context) {
  const {
    target,
    bodyMinY,
    bodyMaxY,
    elapsedMs,
  } = context;

  const span = Math.max(0.001, bodyMaxY - bodyMinY);
  const normalizedY = (target.y - bodyMinY) / span;
  const progress = Math.max(0, Math.min(1, (elapsedMs - 250) / 1700));

  return {
    bodyEligible: normalizedY <= progress + 0.18,
    scaleMultiplier: 0.96 + progress * 0.14,
    targetOffset: { x: 0, y: 0, z: 0 },
  };
}
