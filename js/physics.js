// ═══════════════════════════════════════════════════════════
//  physics.js — Cannon-es physics world & proxy body creation
// ═══════════════════════════════════════════════════════════

import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { TOTAL_CUBES } from './config.js';
import { cubeRand, shelfHome } from './cubeData.js';

// ─── Exported state ─────────────────────────────────────────
export let world;
export const cubes = [];   // { body }

// ─── Initialize Cannon-es physics ───────────────────────────
export function initPhysics() {
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
  world.solver.iterations = 1;
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.tolerance = 0.5;

  world.defaultContactMaterial.friction    = 0;
  world.defaultContactMaterial.restitution = 0;
}

// ─── Create proxy bodies for all active items ───────────────
export function createCubes() {
  const cannonMat  = new CANNON.Material('product-proxy');

  for (let i = 0; i < TOTAL_CUBES; i++) {
    const d = cubeRand[i];

    const home = shelfHome[i];
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(d.w / 2, d.h / 2, d.d / 2)),
      material: cannonMat,
      linearDamping:  0.5,
      angularDamping: 0.7,
      sleepSpeedLimit: 0.2,
      sleepTimeLimit:  0.3,
      collisionFilterGroup: 0,   // no collision group
      collisionFilterMask:  0,   // collide with nothing
      position: new CANNON.Vec3(home.x, home.y, home.z),
    });
    body.quaternion.set(
      d.restQuaternion.x,
      d.restQuaternion.y,
      d.restQuaternion.z,
      d.restQuaternion.w,
    );
    world.addBody(body);

    cubes.push({ body });
  }
}
