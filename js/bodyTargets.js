// ═══════════════════════════════════════════════════════════
//  bodyTargets.js — Landmark helpers, body target computation,
//  landmark smoothing
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import {
  SCALE,
  SMOOTH,
  BODY_CUBES,
  segRanges,
  CAMERA_FOV,
  CAMERA_Z,
  BODY_TARGET_Z,
  BODY_DEPTH_SCALE,
} from './config.js';
import { cubeRand } from './cubeData.js';

// ─── State ──────────────────────────────────────────────────
const smoothedLm = {
  image: null,
  world: null,
};

/** Reset smoothing state (e.g. when pose is lost) */
export function resetSmoothing() {
  smoothedLm.image = null;
  smoothedLm.world = null;
}

// ─── Landmark Helpers ───────────────────────────────────────

function getViewportMetrics(video) {
  const videoWidth = Math.max(video?.videoWidth || 640, 1);
  const videoHeight = Math.max(video?.videoHeight || 480, 1);
  const screenWidth = Math.max(window.innerWidth || videoWidth, 1);
  const screenHeight = Math.max(window.innerHeight || videoHeight, 1);
  const coverScale = Math.max(screenWidth / videoWidth, screenHeight / videoHeight);
  const renderedWidth = videoWidth * coverScale;
  const renderedHeight = videoHeight * coverScale;
  const cropX = (renderedWidth - screenWidth) * 0.5;
  const cropY = (renderedHeight - screenHeight) * 0.5;
  const planeDistance = CAMERA_Z - BODY_TARGET_Z;
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV * 0.5)) * planeDistance;
  const viewWidth = viewHeight * (screenWidth / screenHeight);

  return {
    screenWidth,
    screenHeight,
    renderedWidth,
    renderedHeight,
    cropX,
    cropY,
    viewWidth,
    viewHeight,
  };
}

function landmarkDepth(worldLandmarks, idx) {
  if (!worldLandmarks?.[idx]) return BODY_TARGET_Z;
  const depthOffset = THREE.MathUtils.clamp(-worldLandmarks[idx].z * BODY_DEPTH_SCALE, -1.15, 1.15);
  return BODY_TARGET_Z + depthOffset;
}

/** Convert a MediaPipe image landmark → Three.js Vector3 aligned with the mirrored cover-fit webcam. */
export function lm2v(imageLandmarks, worldLandmarks, idx, viewport) {
  const source = imageLandmarks[idx];
  const screenX = source.x * viewport.renderedWidth - viewport.cropX;
  const screenY = source.y * viewport.renderedHeight - viewport.cropY;
  const normalizedX = THREE.MathUtils.clamp(screenX / viewport.screenWidth, 0, 1);
  const normalizedY = THREE.MathUtils.clamp(screenY / viewport.screenHeight, 0, 1);
  const mirroredX = 1 - normalizedX;

  return new THREE.Vector3(
    (mirroredX - 0.5) * viewport.viewWidth,
    (0.5 - normalizedY) * viewport.viewHeight,
    landmarkDepth(worldLandmarks, idx),
  );
}

/** Midpoint of several landmarks */
export function lmMid(imageLandmarks, worldLandmarks, indices, viewport) {
  const v = new THREE.Vector3();
  for (const i of indices) v.add(lm2v(imageLandmarks, worldLandmarks, i, viewport));
  return v.divideScalar(indices.length);
}

/** Resolve endpoint: array of landmark indices → midpoint, single → lm2v */
export function endpointVec(imageLandmarks, worldLandmarks, to, viewport) {
  return Array.isArray(to)
    ? lmMid(imageLandmarks, worldLandmarks, to, viewport)
    : lm2v(imageLandmarks, worldLandmarks, to, viewport);
}

// ─── Smooth Landmarks ───────────────────────────────────────
export function smoothLandmarks(current, key = 'world') {
  if (!current?.length) return null;

  if (!smoothedLm[key]) {
    smoothedLm[key] = current.map(l => ({ x: l.x, y: l.y, z: l.z }));
    return smoothedLm[key];
  }

  for (let i = 0; i < current.length; i++) {
    smoothedLm[key][i].x += (current[i].x - smoothedLm[key][i].x) * SMOOTH;
    smoothedLm[key][i].y += (current[i].y - smoothedLm[key][i].y) * SMOOTH;
    smoothedLm[key][i].z += (current[i].z - smoothedLm[key][i].z) * SMOOTH;
  }

  return smoothedLm[key];
}

// ─── Compute Body Targets from image landmarks ─────────────
export function computeBodyTargets(imageLandmarks, worldLandmarks, video) {
  const t = new Array(BODY_CUBES);
  const viewport = getViewportMetrics(video);

  for (const { start, end, seg } of segRanges) {
    if (seg.type === 'cluster') {
      const center = lm2v(imageLandmarks, worldLandmarks, seg.center, viewport);
      for (let i = start; i < end; i++) {
        const d = cubeRand[i];
        t[i] = new THREE.Vector3(
          center.x + d.ox * seg.radius * SCALE,
          center.y + d.oy * seg.radius * SCALE,
          center.z + d.oz * seg.radius * SCALE * BODY_DEPTH_SCALE,
        );
      }

    } else if (seg.type === 'line') {
      const a = lm2v(imageLandmarks, worldLandmarks, seg.from, viewport);
      const b = endpointVec(imageLandmarks, worldLandmarks, seg.to, viewport);
      let li = 0;
      for (let i = start; i < end; i++) {
        const frac = seg.count > 1 ? li / (seg.count - 1) : 0.5;
        const d    = cubeRand[i];
        const base = a.clone().lerp(b, frac);
        t[i] = new THREE.Vector3(
          base.x + d.ox * seg.thickness * SCALE,
          base.y + d.oy * seg.thickness * SCALE,
          base.z + d.oz * seg.thickness * SCALE * BODY_DEPTH_SCALE,
        );
        li++;
      }

    } else if (seg.type === 'quad') {
      const tl = lm2v(imageLandmarks, worldLandmarks, seg.corners[0], viewport);
      const tr = lm2v(imageLandmarks, worldLandmarks, seg.corners[1], viewport);
      const br = lm2v(imageLandmarks, worldLandmarks, seg.corners[2], viewport);
      const bl = lm2v(imageLandmarks, worldLandmarks, seg.corners[3], viewport);
      for (let i = start; i < end; i++) {
        const d   = cubeRand[i];
        const u   = d.qu, v = d.qv;
        const top = tl.clone().lerp(tr, u);
        const bot = bl.clone().lerp(br, u);
        const pt  = top.lerp(bot, v);
        t[i] = new THREE.Vector3(
          pt.x + d.ox * seg.thickness * SCALE,
          pt.y + d.oy * seg.thickness * SCALE,
          pt.z + d.oz * seg.thickness * SCALE * BODY_DEPTH_SCALE,
        );
      }
    }
  }

  return t;
}
