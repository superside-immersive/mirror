// ═══════════════════════════════════════════════════════════
//  mediapipe.js — Webcam initialization, PoseLandmarker setup,
//  detection wrapper
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import {
  BODY_CUBES,
  POSE_DETECTION_FPS,
  POSE_INTERPOLATION_MS,
  WEBCAM_CAPTURE_FPS,
  WEBCAM_CAPTURE_HEIGHT,
  WEBCAM_CAPTURE_MAX_HEIGHT,
  WEBCAM_CAPTURE_MAX_WIDTH,
  WEBCAM_CAPTURE_WIDTH,
} from './config.js';
import { smoothLandmarks, computeBodyTargets } from './bodyTargets.js';

// ─── State ──────────────────────────────────────────────────
let video = null;
let poseLandmarker = null;
let lastVideoTime = -1;
let lastDetectTimeMs = 0;
let lastSuccessfulDetectTimeMs = 0;
let blendStartTimeMs = 0;
let blendDurationMs = 1;
let poseFrameCount = 0;
let poseFpsLastMs = performance.now();
let hasPoseTargets = false;

const POSE_SAMPLE_INTERVAL_MS = 1000 / POSE_DETECTION_FPS;
const POSE_MISS_GRACE_MS = 125;
const interpolatedTargets = Array.from({ length: BODY_CUBES }, () => new THREE.Vector3());
const previousTargets = Array.from({ length: BODY_CUBES }, () => new THREE.Vector3());
const nextTargets = Array.from({ length: BODY_CUBES }, () => new THREE.Vector3());

// Pose state object — shared reference so importers see live updates
export const poseState = {
  bodyTargets:      null,
  poseActive:       false,
  currentLandmarks: null,   // raw smoothed landmarks for gesture detection
  perf:             null,
};

export const posePerfState = {
  inferenceMs: 0,
  targetMs: 0,
  totalMs: 0,
  poseFps: 0,
  captureWidth: 0,
  captureHeight: 0,
  captureFps: 0,
  sampleIntervalMs: Math.round(POSE_SAMPLE_INTERVAL_MS),
  interpolating: false,
  blendAlpha: 1,
};

poseState.perf = posePerfState;

function copyTargets(source, destination) {
  for (let i = 0; i < BODY_CUBES; i++) {
    destination[i].copy(source[i]);
  }
}

function updatePoseRate(nowMs) {
  poseFrameCount++;

  if (nowMs - poseFpsLastMs < 500) return;

  posePerfState.poseFps = Math.round(poseFrameCount / ((nowMs - poseFpsLastMs) / 1000));
  poseFrameCount = 0;
  poseFpsLastMs = nowMs;
}

function snapTargets(rawTargets) {
  copyTargets(rawTargets, previousTargets);
  copyTargets(rawTargets, nextTargets);
  copyTargets(rawTargets, interpolatedTargets);
  poseState.bodyTargets = interpolatedTargets;
  posePerfState.interpolating = false;
  posePerfState.blendAlpha = 1;
  hasPoseTargets = true;
}

function updateInterpolatedTargets(nowMs) {
  if (!hasPoseTargets) return;

  const alpha = THREE.MathUtils.clamp(
    (nowMs - blendStartTimeMs) / Math.max(blendDurationMs, 1),
    0,
    1,
  );

  for (let i = 0; i < BODY_CUBES; i++) {
    interpolatedTargets[i].copy(previousTargets[i]).lerp(nextTargets[i], alpha);
  }

  poseState.bodyTargets = interpolatedTargets;
  posePerfState.interpolating = alpha < 0.999;
  posePerfState.blendAlpha = alpha;
}

// ─── Webcam Init ────────────────────────────────────────────
export async function initWebcam() {
  video = document.getElementById('webcam');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: WEBCAM_CAPTURE_WIDTH, max: WEBCAM_CAPTURE_MAX_WIDTH },
      height: { ideal: WEBCAM_CAPTURE_HEIGHT, max: WEBCAM_CAPTURE_MAX_HEIGHT },
      frameRate: { ideal: WEBCAM_CAPTURE_FPS, max: 30 },
      facingMode: 'user',
    },
  });
  video.srcObject = stream;

  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings?.() ?? {};
  posePerfState.captureWidth = settings.width || 0;
  posePerfState.captureHeight = settings.height || 0;
  posePerfState.captureFps = settings.frameRate || WEBCAM_CAPTURE_FPS;

  await new Promise(resolve => { video.onloadeddata = resolve; });

  posePerfState.captureWidth = video.videoWidth || posePerfState.captureWidth || WEBCAM_CAPTURE_WIDTH;
  posePerfState.captureHeight = video.videoHeight || posePerfState.captureHeight || WEBCAM_CAPTURE_HEIGHT;
}

// ─── MediaPipe Pose Init ────────────────────────────────────
export async function initPose() {
  lastVideoTime = -1;
  lastDetectTimeMs = 0;
  lastSuccessfulDetectTimeMs = 0;
  blendStartTimeMs = 0;
  blendDurationMs = 1;
  hasPoseTargets = false;
  posePerfState.inferenceMs = 0;
  posePerfState.targetMs = 0;
  posePerfState.totalMs = 0;
  posePerfState.poseFps = 0;
  posePerfState.interpolating = false;
  posePerfState.blendAlpha = 1;

  const mpVision = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm'
  );
  const FilesetResolver = mpVision.FilesetResolver;
  const PoseLandmarker  = mpVision.PoseLandmarker;

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence:  0.5,
    minTrackingConfidence:      0.5,
  });
}

// ─── Detect Pose (called every frame from animationLoop) ────
export function detectPose(nowMs = performance.now()) {
  updateInterpolatedTargets(nowMs);

  if (!poseLandmarker || !video || video.readyState < 2) {
    return posePerfState;
  }

  if (nowMs - lastDetectTimeMs < POSE_SAMPLE_INTERVAL_MS || video.currentTime === lastVideoTime) {
    return posePerfState;
  }

  lastDetectTimeMs = nowMs;
  lastVideoTime = video.currentTime;

  try {
    const inferenceStart = performance.now();
    const result = poseLandmarker.detectForVideo(video, nowMs);
    posePerfState.inferenceMs = performance.now() - inferenceStart;

    if (result.landmarks && result.landmarks.length > 0) {
      const targetStart = performance.now();
      const imageLandmarks = smoothLandmarks(result.landmarks[0], 'image');
      const worldLandmarks = result.worldLandmarks?.length
        ? smoothLandmarks(result.worldLandmarks[0], 'world')
        : null;
      const rawTargets = computeBodyTargets(imageLandmarks, worldLandmarks, video);
      posePerfState.targetMs = performance.now() - targetStart;
      posePerfState.totalMs = posePerfState.inferenceMs + posePerfState.targetMs;

      if (!poseState.poseActive || !hasPoseTargets) {
        snapTargets(rawTargets);
      } else {
        copyTargets(interpolatedTargets, previousTargets);
        copyTargets(rawTargets, nextTargets);
        blendStartTimeMs = nowMs;
        blendDurationMs = Math.max(
          POSE_INTERPOLATION_MS,
          lastSuccessfulDetectTimeMs > 0 ? nowMs - lastSuccessfulDetectTimeMs : POSE_SAMPLE_INTERVAL_MS,
        );
        hasPoseTargets = true;
        updateInterpolatedTargets(nowMs);
      }

      lastSuccessfulDetectTimeMs = nowMs;
      updatePoseRate(nowMs);

      poseState.bodyTargets      = interpolatedTargets;
      poseState.poseActive       = true;
      poseState.currentLandmarks = imageLandmarks;

      return posePerfState;
    }

    if (nowMs - lastSuccessfulDetectTimeMs > POSE_MISS_GRACE_MS) {
      hasPoseTargets = false;
      poseState.poseActive       = false;
      poseState.currentLandmarks = null;
      posePerfState.targetMs = 0;
      posePerfState.totalMs = posePerfState.inferenceMs;
      posePerfState.interpolating = false;
      posePerfState.blendAlpha = 1;
    }
  } catch (e) {
    // Detection can occasionally fail on frame transitions
  }

  return posePerfState;
}

// ─── Cleanup ────────────────────────────────────────────────
export function stopWebcam() {
  hasPoseTargets = false;
  if (video?.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
  }
}
