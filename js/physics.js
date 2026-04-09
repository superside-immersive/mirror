// ═══════════════════════════════════════════════════════════
//  physics.js — Lightweight motion integrator for proxy
//  bodies used by the interactive product cloud
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { TOTAL_CUBES } from './config.js';
import { cubeRand, shelfHome } from './cubeData.js';

const BODY_SLEEPING = 2;
const tmpAxis = new THREE.Vector3();
const tmpRotation = new THREE.Quaternion();

class SimpleBody {
  constructor({ position, quaternion, linearDamping, angularDamping }) {
    this.position = position.clone();
    this.quaternion = quaternion.clone();
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.linearDamping = linearDamping;
    this.angularDamping = angularDamping;
    this.sleepState = BODY_SLEEPING;
  }

  wakeUp() {
    this.sleepState = 0;
  }

  sleep() {
    this.sleepState = BODY_SLEEPING;
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
  }
}

class SimpleWorld {
  constructor() {
    this.bodies = [];
  }

  addBody(body) {
    this.bodies.push(body);
  }

  step(fixedTimeStep = 1 / 60, deltaTime = fixedTimeStep) {
    const stepDt = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : fixedTimeStep;
    const dampingScale = stepDt * 60;

    for (const body of this.bodies) {
      if (body.sleepState === BODY_SLEEPING) continue;

      body.position.addScaledVector(body.velocity, stepDt);

      const angularSpeedSq = body.angularVelocity.lengthSq();
      if (angularSpeedSq > 1e-8) {
        const angularSpeed = Math.sqrt(angularSpeedSq);
        tmpAxis.copy(body.angularVelocity).multiplyScalar(1 / angularSpeed);
        tmpRotation.setFromAxisAngle(tmpAxis, angularSpeed * stepDt);
        body.quaternion.multiply(tmpRotation).normalize();
      }

      const linearDamping = Math.max(0, 1 - Math.min(0.95, body.linearDamping * dampingScale));
      const angularDamping = Math.max(0, 1 - Math.min(0.95, body.angularDamping * dampingScale));
      body.velocity.multiplyScalar(linearDamping);
      body.angularVelocity.multiplyScalar(angularDamping);
    }
  }
}

// ─── Exported state ─────────────────────────────────────────
export let world;
export const cubes = [];   // { body }

// ─── Initialize lightweight physics ────────────────────────
export function initPhysics() {
  world = new SimpleWorld();
}

// ─── Create proxy bodies for all active items ───────────────
export function createCubes() {
  cubes.length = 0;

  for (let i = 0; i < TOTAL_CUBES; i++) {
    const d = cubeRand[i];
    const home = shelfHome[i];
    const body = new SimpleBody({
      position: home,
      quaternion: d.restQuaternion,
      linearDamping: 0.5,
      angularDamping: 0.7,
    });

    world.addBody(body);
    cubes.push({ body });
  }
}
