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

const viewportMetrics = {
  videoWidth: 0,
  videoHeight: 0,
  screenWidth: 0,
  screenHeight: 0,
  renderedWidth: 0,
  renderedHeight: 0,
  cropX: 0,
  cropY: 0,
  viewWidth: 0,
  viewHeight: 0,
};

const bodyTargetPool = Array.from({ length: BODY_CUBES }, () => new THREE.Vector3());
const tmpLandmarkVec = new THREE.Vector3();
const tmpCenter = new THREE.Vector3();
const tmpLineStart = new THREE.Vector3();
const tmpLineEnd = new THREE.Vector3();
const tmpQuadTL = new THREE.Vector3();
const tmpQuadTR = new THREE.Vector3();
const tmpQuadBR = new THREE.Vector3();
const tmpQuadBL = new THREE.Vector3();
const tmpQuadTop = new THREE.Vector3();
const tmpQuadBottom = new THREE.Vector3();

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

  if (
    viewportMetrics.videoWidth === videoWidth
    && viewportMetrics.videoHeight === videoHeight
    && viewportMetrics.screenWidth === screenWidth
    && viewportMetrics.screenHeight === screenHeight
  ) {
    return viewportMetrics;
  }

  const coverScale = Math.max(screenWidth / videoWidth, screenHeight / videoHeight);
  const renderedWidth = videoWidth * coverScale;
  const renderedHeight = videoHeight * coverScale;
  const cropX = (renderedWidth - screenWidth) * 0.5;
  const cropY = (renderedHeight - screenHeight) * 0.5;
  const planeDistance = CAMERA_Z - BODY_TARGET_Z;
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV * 0.5)) * planeDistance;
  const viewWidth = viewHeight * (screenWidth / screenHeight);

  Object.assign(viewportMetrics, {
    videoWidth,
    videoHeight,
    screenWidth,
    screenHeight,
    renderedWidth,
    renderedHeight,
    cropX,
    cropY,
    viewWidth,
    viewHeight,
  });

  return viewportMetrics;
}

function landmarkDepth(worldLandmarks, idx) {
  if (!worldLandmarks?.[idx]) return BODY_TARGET_Z;
  const depthOffset = THREE.MathUtils.clamp(-worldLandmarks[idx].z * BODY_DEPTH_SCALE, -1.15, 1.15);
  return BODY_TARGET_Z + depthOffset;
}

/** Convert a MediaPipe image landmark → Three.js Vector3 aligned with the mirrored cover-fit webcam. */
export function lm2v(imageLandmarks, worldLandmarks, idx, viewport, target = new THREE.Vector3()) {
  const source = imageLandmarks[idx];
  const screenX = source.x * viewport.renderedWidth - viewport.cropX;
  const screenY = source.y * viewport.renderedHeight - viewport.cropY;
  const normalizedX = THREE.MathUtils.clamp(screenX / viewport.screenWidth, 0, 1);
  const normalizedY = THREE.MathUtils.clamp(screenY / viewport.screenHeight, 0, 1);
  const mirroredX = 1 - normalizedX;

  return target.set(
    (mirroredX - 0.5) * viewport.viewWidth,
    (0.5 - normalizedY) * viewport.viewHeight,
    landmarkDepth(worldLandmarks, idx),
  );
}

/** Midpoint of several landmarks */
export function lmMid(imageLandmarks, worldLandmarks, indices, viewport, target = new THREE.Vector3()) {
  target.set(0, 0, 0);

  for (const i of indices) {
    target.add(lm2v(imageLandmarks, worldLandmarks, i, viewport, tmpLandmarkVec));
  }

  return target.divideScalar(indices.length);
}

/** Resolve endpoint: array of landmark indices → midpoint, single → lm2v */
export function endpointVec(imageLandmarks, worldLandmarks, to, viewport, target = new THREE.Vector3()) {
  return Array.isArray(to)
    ? lmMid(imageLandmarks, worldLandmarks, to, viewport, target)
    : lm2v(imageLandmarks, worldLandmarks, to, viewport, target);
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
  const targets = bodyTargetPool;
  const viewport = getViewportMetrics(video);

  for (const { start, end, seg } of segRanges) {
    if (seg.type === 'cluster') {
      const xyScale = seg.radius * SCALE;
      const zScale = xyScale * BODY_DEPTH_SCALE;
      const center = lm2v(imageLandmarks, worldLandmarks, seg.center, viewport, tmpCenter);

      for (let i = start; i < end; i++) {
        const d = cubeRand[i];
        targets[i].set(
          center.x + d.ox * xyScale,
          center.y + d.oy * xyScale,
          center.z + d.oz * zScale,
        );
      }

    } else if (seg.type === 'line') {
      const xyScale = seg.thickness * SCALE;
      const zScale = xyScale * BODY_DEPTH_SCALE;
      const a = lm2v(imageLandmarks, worldLandmarks, seg.from, viewport, tmpLineStart);
      const b = endpointVec(imageLandmarks, worldLandmarks, seg.to, viewport, tmpLineEnd);
      let li = 0;

      for (let i = start; i < end; i++) {
        const frac = seg.count > 1 ? li / (seg.count - 1) : 0.5;
        const d = cubeRand[i];
        const target = targets[i].copy(a).lerp(b, frac);
        target.x += d.ox * xyScale;
        target.y += d.oy * xyScale;
        target.z += d.oz * zScale;
        li++;
      }

    } else if (seg.type === 'quad') {
      const xyScale = seg.thickness * SCALE;
      const zScale = xyScale * BODY_DEPTH_SCALE;
      const tl = lm2v(imageLandmarks, worldLandmarks, seg.corners[0], viewport, tmpQuadTL);
      const tr = lm2v(imageLandmarks, worldLandmarks, seg.corners[1], viewport, tmpQuadTR);
      const br = lm2v(imageLandmarks, worldLandmarks, seg.corners[2], viewport, tmpQuadBR);
      const bl = lm2v(imageLandmarks, worldLandmarks, seg.corners[3], viewport, tmpQuadBL);

      for (let i = start; i < end; i++) {
        const d = cubeRand[i];
        const top = tmpQuadTop.copy(tl).lerp(tr, d.qu);
        const bottom = tmpQuadBottom.copy(bl).lerp(br, d.qu);
        const target = targets[i].copy(top).lerp(bottom, d.qv);
        target.x += d.ox * xyScale;
        target.y += d.oy * xyScale;
        target.z += d.oz * zScale;
      }
    }
  }

  return targets;
}
