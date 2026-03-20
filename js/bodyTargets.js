// ═══════════════════════════════════════════════════════════
//  bodyTargets.js — Landmark helpers, body target computation,
//  landmark smoothing
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { SCALE, SMOOTH, BODY_CUBES, segRanges, FLOOR_Y, BODY_FLOOR_CLEARANCE } from './config.js';
import { cubeRand } from './cubeData.js';

// ─── State ──────────────────────────────────────────────────
let smoothedLm = null;

/** Reset smoothing state (e.g. when pose is lost) */
export function resetSmoothing() {
  smoothedLm = null;
}

// ─── Landmark Helpers ───────────────────────────────────────

/** Convert a MediaPipe worldLandmark → Three.js Vector3 (mirrored X for mirror effect) */
export function lm2v(wl, idx) {
  return new THREE.Vector3(-wl[idx].x * SCALE, -wl[idx].y * SCALE, -wl[idx].z * SCALE);
}

/** Midpoint of several landmarks */
export function lmMid(wl, indices) {
  const v = new THREE.Vector3();
  for (const i of indices) v.add(lm2v(wl, i));
  return v.divideScalar(indices.length);
}

/** Resolve endpoint: array of landmark indices → midpoint, single → lm2v */
export function endpointVec(wl, to) {
  return Array.isArray(to) ? lmMid(wl, to) : lm2v(wl, to);
}

// ─── Smooth Landmarks ───────────────────────────────────────
export function smoothLandmarks(current) {
  if (!smoothedLm) {
    smoothedLm = current.map(l => ({ x: l.x, y: l.y, z: l.z }));
    return smoothedLm;
  }
  for (let i = 0; i < current.length; i++) {
    smoothedLm[i].x += (current[i].x - smoothedLm[i].x) * SMOOTH;
    smoothedLm[i].y += (current[i].y - smoothedLm[i].y) * SMOOTH;
    smoothedLm[i].z += (current[i].z - smoothedLm[i].z) * SMOOTH;
  }
  return smoothedLm;
}

// ─── Compute Body Targets from world landmarks ─────────────
export function computeBodyTargets(wl) {
  const t = new Array(BODY_CUBES);
  const footAnchors = [27, 28, 31, 32]
    .map(idx => lm2v(wl, idx).y)
    .filter(Number.isFinite);

  for (const { start, end, seg } of segRanges) {
    if (seg.type === 'cluster') {
      const center = lm2v(wl, seg.center);
      for (let i = start; i < end; i++) {
        const d = cubeRand[i];
        t[i] = new THREE.Vector3(
          center.x + d.ox * seg.radius * SCALE,
          center.y + d.oy * seg.radius * SCALE,
          center.z + d.oz * seg.radius * SCALE,
        );
      }

    } else if (seg.type === 'line') {
      const a = lm2v(wl, seg.from);
      const b = endpointVec(wl, seg.to);
      let li = 0;
      for (let i = start; i < end; i++) {
        const frac = seg.count > 1 ? li / (seg.count - 1) : 0.5;
        const d    = cubeRand[i];
        const base = a.clone().lerp(b, frac);
        t[i] = new THREE.Vector3(
          base.x + d.ox * seg.thickness * SCALE,
          base.y + d.oy * seg.thickness * SCALE,
          base.z + d.oz * seg.thickness * SCALE,
        );
        li++;
      }

    } else if (seg.type === 'quad') {
      const tl = lm2v(wl, seg.corners[0]);
      const tr = lm2v(wl, seg.corners[1]);
      const br = lm2v(wl, seg.corners[2]);
      const bl = lm2v(wl, seg.corners[3]);
      for (let i = start; i < end; i++) {
        const d   = cubeRand[i];
        const u   = d.qu, v = d.qv;
        const top = tl.clone().lerp(tr, u);
        const bot = bl.clone().lerp(br, u);
        const pt  = top.lerp(bot, v);
        t[i] = new THREE.Vector3(
          pt.x + d.ox * seg.thickness * SCALE,
          pt.y + d.oy * seg.thickness * SCALE,
          pt.z + d.oz * seg.thickness * SCALE,
        );
      }
    }
  }

  const minFootY = footAnchors.length ? Math.min(...footAnchors) : Infinity;

  if (Number.isFinite(minFootY)) {
    const lift = FLOOR_Y + BODY_FLOOR_CLEARANCE - minFootY;
    for (const target of t) {
      if (target) target.y += lift;
    }
  }

  return t;
}
