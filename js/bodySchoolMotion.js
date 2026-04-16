import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { BODY_CUBES, BODY_SCHOOL, PHASE, segRanges } from './config.js';
import { cubeRand } from './cubeData.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0);
const WORLD_FORWARD = new THREE.Vector3(0, 0, 1);

const segmentStatePool = segRanges.map(() => ({
  center: new THREE.Vector3(),
  axis: new THREE.Vector3(0, 1, 0),
  normal: new THREE.Vector3(1, 0, 0),
  binormal: new THREE.Vector3(0, 0, 1),
}));

const motionPool = Array.from({ length: BODY_CUBES }, () => ({
  targetOffset: new THREE.Vector3(),
  angularVelocity: new THREE.Vector3(),
  rotationBlend: 0,
}));

const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const tmpVecC = new THREE.Vector3();
const tmpVecD = new THREE.Vector3();

function safeNormalize(vec, fallback) {
  if (vec.lengthSq() > 1e-8) return vec.normalize();
  return vec.copy(fallback);
}

function limitVectorLength(vec, maxLength) {
  if (maxLength <= 0) {
    vec.set(0, 0, 0);
    return vec;
  }

  if (vec.lengthSq() > maxLength * maxLength) {
    vec.setLength(maxLength);
  }

  return vec;
}

function resetMotion(motion) {
  motion.targetOffset.set(0, 0, 0);
  motion.angularVelocity.set(0, 0, 0);
  motion.rotationBlend = 0;
  return motion;
}

function getPhaseAttenuation(phase) {
  switch (phase) {
    case PHASE.HARMONY:
      return BODY_SCHOOL.harmonyAttenuation;
    case PHASE.CHAOS:
      return BODY_SCHOOL.chaosAttenuation;
    default:
      return 1;
  }
}

function buildLineSegmentState(state, range, bodyTargets) {
  const startTarget = bodyTargets[range.start];
  const endTarget = bodyTargets[range.end - 1];

  state.center.copy(startTarget).lerp(endTarget, 0.5);
  state.axis.subVectors(endTarget, startTarget);
  safeNormalize(state.axis, WORLD_UP);

  const reference = Math.abs(state.axis.dot(WORLD_UP)) > 0.92 ? WORLD_RIGHT : WORLD_UP;
  state.normal.crossVectors(state.axis, reference);
  safeNormalize(state.normal, WORLD_RIGHT);
  state.binormal.crossVectors(state.axis, state.normal);
  safeNormalize(state.binormal, WORLD_FORWARD);
}

function buildClusterSegmentState(state, range, bodyTargets) {
  state.center.set(0, 0, 0);

  for (let i = range.start; i < range.end; i++) {
    state.center.add(bodyTargets[i]);
  }

  state.center.multiplyScalar(1 / Math.max(1, range.end - range.start));
  state.axis.copy(WORLD_UP);
  state.normal.copy(WORLD_RIGHT);
  state.binormal.copy(WORLD_FORWARD);
}

function buildQuadSegmentState(state, range, bodyTargets) {
  state.center.set(0, 0, 0);
  tmpVecA.set(0, 0, 0);
  tmpVecB.set(0, 0, 0);
  tmpVecC.set(0, 0, 0);
  tmpVecD.set(0, 0, 0);

  let topCount = 0;
  let bottomCount = 0;
  let leftCount = 0;
  let rightCount = 0;

  for (let i = range.start; i < range.end; i++) {
    const target = bodyTargets[i];
    const item = cubeRand[i];

    state.center.add(target);

    if ((item.qv ?? 0.5) <= 0.35) {
      tmpVecA.add(target);
      topCount++;
    }
    if ((item.qv ?? 0.5) >= 0.65) {
      tmpVecB.add(target);
      bottomCount++;
    }
    if ((item.qu ?? 0.5) <= 0.35) {
      tmpVecC.add(target);
      leftCount++;
    }
    if ((item.qu ?? 0.5) >= 0.65) {
      tmpVecD.add(target);
      rightCount++;
    }
  }

  state.center.multiplyScalar(1 / Math.max(1, range.end - range.start));

  if (topCount > 0) tmpVecA.multiplyScalar(1 / topCount);
  else tmpVecA.copy(state.center).addScaledVector(WORLD_UP, 0.25);

  if (bottomCount > 0) tmpVecB.multiplyScalar(1 / bottomCount);
  else tmpVecB.copy(state.center).addScaledVector(WORLD_UP, -0.25);

  if (leftCount > 0) tmpVecC.multiplyScalar(1 / leftCount);
  else tmpVecC.copy(state.center).addScaledVector(WORLD_RIGHT, -0.25);

  if (rightCount > 0) tmpVecD.multiplyScalar(1 / rightCount);
  else tmpVecD.copy(state.center).addScaledVector(WORLD_RIGHT, 0.25);

  state.axis.subVectors(tmpVecB, tmpVecA);
  safeNormalize(state.axis, WORLD_UP);

  state.binormal.subVectors(tmpVecD, tmpVecC);
  safeNormalize(state.binormal, WORLD_RIGHT);

  state.normal.crossVectors(state.binormal, state.axis);
  safeNormalize(state.normal, WORLD_FORWARD);
}

function populateSegmentStates(bodyTargets) {
  for (let segmentIndex = 0; segmentIndex < segRanges.length; segmentIndex++) {
    const range = segRanges[segmentIndex];
    const state = segmentStatePool[segmentIndex];

    switch (range.seg.type) {
      case 'line':
        buildLineSegmentState(state, range, bodyTargets);
        break;
      case 'quad':
        buildQuadSegmentState(state, range, bodyTargets);
        break;
      default:
        buildClusterSegmentState(state, range, bodyTargets);
        break;
    }
  }
}

function applyLineMotion(motion, state, item, phaseStrength, time) {
  const wave = time * BODY_SCHOOL.travelSpeed
    - item.bodySegmentProgress * BODY_SCHOOL.phaseLag
    + item.bodySegmentIndex * 0.55;
  const orbitAngle = item.bodySegmentOrbit * Math.PI * 2 + time * 0.7 + item.motionSeed * Math.PI * 2;
  const amplitude = Math.min(BODY_SCHOOL.maxLineOffset, item.bodySegmentThickness * 0.18)
    * BODY_SCHOOL.positionAmplitude
    * phaseStrength;

  tmpVecA.copy(state.normal).multiplyScalar(Math.cos(orbitAngle));
  tmpVecB.copy(state.binormal).multiplyScalar(Math.sin(orbitAngle));
  tmpVecC.copy(tmpVecA).add(tmpVecB);
  safeNormalize(tmpVecC, state.normal);

  tmpVecD.crossVectors(state.axis, tmpVecC);
  safeNormalize(tmpVecD, state.binormal);

  motion.targetOffset.copy(tmpVecC).multiplyScalar(Math.sin(wave) * amplitude);
  motion.targetOffset.addScaledVector(tmpVecD, Math.cos(wave) * amplitude * 0.45);
  limitVectorLength(motion.targetOffset, BODY_SCHOOL.maxLineOffset * phaseStrength);

  motion.angularVelocity.copy(state.axis).multiplyScalar(
    Math.cos(wave) * BODY_SCHOOL.rotationStrength * 0.45 * phaseStrength,
  );
  motion.angularVelocity.addScaledVector(
    tmpVecD,
    Math.sin(wave) * BODY_SCHOOL.rotationStrength * 0.28 * phaseStrength,
  );
  motion.rotationBlend = BODY_SCHOOL.rotationBlend * phaseStrength;
}

function applyQuadMotion(motion, state, item, phaseStrength, time) {
  const wave = time * (BODY_SCHOOL.travelSpeed * 0.82)
    + item.bodySegmentOrbit * 5.3
    - item.bodySegmentProgress * 4.1
    + item.motionSeed * 1.7;
  const amplitude = Math.min(BODY_SCHOOL.maxQuadOffset, item.bodySegmentThickness * 0.12)
    * BODY_SCHOOL.positionAmplitude
    * phaseStrength;

  motion.targetOffset.copy(state.binormal).multiplyScalar(Math.sin(wave) * amplitude * 0.85);
  motion.targetOffset.addScaledVector(state.axis, Math.cos(wave * 0.85) * amplitude * 0.35);
  limitVectorLength(motion.targetOffset, BODY_SCHOOL.maxQuadOffset * phaseStrength);

  motion.angularVelocity.copy(state.normal).multiplyScalar(
    Math.sin(wave) * BODY_SCHOOL.rotationStrength * 0.52 * phaseStrength,
  );
  motion.angularVelocity.addScaledVector(
    state.binormal,
    Math.cos(wave * 0.6) * BODY_SCHOOL.rotationStrength * 0.16 * phaseStrength,
  );
  motion.rotationBlend = BODY_SCHOOL.rotationBlend * 0.82 * phaseStrength;
}

function applyClusterMotion(motion, state, target, item, phaseStrength, time) {
  const wave = time * (BODY_SCHOOL.travelSpeed * 1.14)
    + item.bodySegmentOrbit * Math.PI * 3
    + item.motionSeed * 4.7;
  const amplitude = Math.min(BODY_SCHOOL.maxClusterOffset, item.bodySegmentThickness * 0.16)
    * BODY_SCHOOL.positionAmplitude
    * phaseStrength;

  tmpVecA.subVectors(target, state.center);
  safeNormalize(tmpVecA, state.normal);

  tmpVecB.crossVectors(state.axis, tmpVecA);
  safeNormalize(tmpVecB, state.binormal);

  motion.targetOffset.copy(tmpVecB).multiplyScalar(Math.sin(wave) * amplitude);
  motion.targetOffset.addScaledVector(tmpVecA, Math.cos(wave * 1.1) * amplitude * 0.22);
  limitVectorLength(motion.targetOffset, BODY_SCHOOL.maxClusterOffset * phaseStrength);

  motion.angularVelocity.copy(tmpVecB).multiplyScalar(
    Math.cos(wave) * BODY_SCHOOL.rotationStrength * 0.32 * phaseStrength,
  );
  motion.angularVelocity.addScaledVector(
    tmpVecA,
    Math.sin(wave * 0.8) * BODY_SCHOOL.rotationStrength * 0.14 * phaseStrength,
  );
  motion.rotationBlend = BODY_SCHOOL.rotationBlend * 0.7 * phaseStrength;
}

export function computeBodySchoolMotionFrame({ bodyTargets, time, phase }) {
  if (!BODY_SCHOOL.enabled || !bodyTargets) return null;

  populateSegmentStates(bodyTargets);
  const phaseStrength = getPhaseAttenuation(phase);

  for (let i = 0; i < BODY_CUBES; i++) {
    const item = cubeRand[i];
    const motion = resetMotion(motionPool[i]);

    if (item.bodySegmentIndex < 0) continue;

    const state = segmentStatePool[item.bodySegmentIndex];
    const target = bodyTargets[i];

    switch (item.bodySegmentType) {
      case 'line':
        applyLineMotion(motion, state, item, phaseStrength, time);
        break;
      case 'quad':
        applyQuadMotion(motion, state, item, phaseStrength, time);
        break;
      default:
        applyClusterMotion(motion, state, target, item, phaseStrength, time);
        break;
    }
  }

  return motionPool;
}