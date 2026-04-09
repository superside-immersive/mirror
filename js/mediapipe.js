// ═══════════════════════════════════════════════════════════
//  mediapipe.js — Webcam initialization, PoseLandmarker setup,
//  detection wrapper
// ═══════════════════════════════════════════════════════════

import { smoothLandmarks, computeBodyTargets } from './bodyTargets.js';

// ─── State ──────────────────────────────────────────────────
let video = null;
let poseLandmarker = null;
let lastVideoTime = -1;

// Pose state object — shared reference so importers see live updates
export const poseState = {
  bodyTargets:      null,
  poseActive:       false,
  currentLandmarks: null,   // raw smoothed landmarks for gesture detection
};

// ─── Webcam Init ────────────────────────────────────────────
export async function initWebcam() {
  video = document.getElementById('webcam');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
  });
  video.srcObject = stream;
  await new Promise(resolve => { video.onloadeddata = resolve; });
}

// ─── MediaPipe Pose Init ────────────────────────────────────
export async function initPose() {
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
export function detectPose() {
  if (!poseLandmarker || !video || video.readyState < 2 || video.currentTime === lastVideoTime) {
    return;
  }

  lastVideoTime = video.currentTime;

  try {
    const result = poseLandmarker.detectForVideo(video, performance.now());
    if (result.landmarks && result.landmarks.length > 0) {
      const imageLandmarks = smoothLandmarks(result.landmarks[0], 'image');
      const worldLandmarks = result.worldLandmarks?.length
        ? smoothLandmarks(result.worldLandmarks[0], 'world')
        : null;

      poseState.bodyTargets      = computeBodyTargets(imageLandmarks, worldLandmarks, video);
      poseState.poseActive       = true;
      poseState.currentLandmarks = imageLandmarks;
    } else {
      poseState.poseActive       = false;
      poseState.currentLandmarks = null;
    }
  } catch (e) {
    // Detection can occasionally fail on frame transitions
  }
}

// ─── Cleanup ────────────────────────────────────────────────
export function stopWebcam() {
  if (video?.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
  }
}
