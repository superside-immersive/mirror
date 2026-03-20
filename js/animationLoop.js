// ═══════════════════════════════════════════════════════════
//  animationLoop.js — Main render loop: pose detection →
//  gesture detection → phase transitions → cube driving →
//  physics → render
// ═══════════════════════════════════════════════════════════

import {
  STIFFNESS, MAX_SPEED, SPAWN_RATE,
  TOTAL_CUBES, BODY_CUBES, PHASE,
} from './config.js';
import { cubeRand, shelfHome }              from './cubeData.js';
import { scene, camera, renderer, clock }   from './scene.js';
import { world, cubes }                     from './physics.js';
import { detectPose, poseState }            from './mediapipe.js';
import { PhaseStateMachine }                from './gestureDetector.js';
import { syncActiveProductTransforms }      from './productRenderer.js';
import { setPhase }                         from './uiPhases.js';

// ─── State ──────────────────────────────────────────────────
let spawnCount = 0;
const phaseStateMachine = new PhaseStateMachine();

// FPS meter
let fpsFrames = 0, fpsLast = performance.now(), fpsCurrent = 0;

// Export for debug controls
export { phaseStateMachine };

// ─── Main Animation Loop ────────────────────────────────────
export function animate() {
  requestAnimationFrame(animate);

  const dt   = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();

  // ── 1. Pose Detection ──
  detectPose();

  // ── 2. Gesture Detection → Phase Transitions ──
  const { poseActive, bodyTargets, currentLandmarks } = poseState;
  const result = phaseStateMachine.update(poseActive, currentLandmarks);
  const selectedColor = result.phase === PHASE.HARMONY ? result.selectedBrand : null;
  if (result.changed) {
    setPhase(result.phase, { selectedBrand: result.selectedBrand });
  }

  // ── 3. Progressive cube spawn ──
  if (spawnCount < TOTAL_CUBES) {
    spawnCount = Math.min(TOTAL_CUBES, spawnCount + SPAWN_RATE);
  }

  // ── 4. Drive each cube toward its target ──
  for (let i = 0; i < spawnCount; i++) {
    const { body } = cubes[i];

    let target;
    const itemColor = cubeRand[i].colorId;
    const isColorMatch = !selectedColor || itemColor === selectedColor;
    if (poseActive && i < BODY_CUBES && bodyTargets && isColorMatch) {
      target = bodyTargets[i];
    } else {
      target = shelfHome[i];
    }
    if (!target) continue;

    const dx   = target.x - body.position.x;
    const dy   = target.y - body.position.y;
    const dz   = target.z - body.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const isBodyBound = poseActive && i < BODY_CUBES && isColorMatch;

    if (dist > 0.005) {
      const stiff  = isBodyBound ? STIFFNESS : STIFFNESS * 0.7;
      const maxSpd = isBodyBound ? MAX_SPEED : MAX_SPEED * 0.6;

      let speed = Math.min(dist * stiff, maxSpd);
      let vx = dx / dist * speed;
      let vy = dy / dist * speed;
      let vz = dz / dist * speed;

      // Flock / swoop when flying back to shelf
      if (!isBodyBound && dist > 0.35) {
        const phase  = i * 2.399 + time * 2.8;
        const fStr   = Math.min(dist, 2.5) * 0.55;
        vx += Math.sin(phase) * fStr;
        vy += Math.cos(phase * 0.73 + i * 0.5) * fStr * 0.6;
        vz += Math.sin(phase * 1.17 + i * 1.1) * fStr * 0.3;
      }

      body.velocity.x = vx;
      body.velocity.y = vy;
      body.velocity.z = vz;

      if (body.sleepState === 2) body.wakeUp();
    } else {
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      if (body.sleepState !== 2) body.sleep();
    }

    // Rotation behaviour
    if (isBodyBound) {
      if (dist > 0.3) {
        const d = cubeRand[i];
        if (body.angularVelocity.length() < 0.8) {
          body.angularVelocity.x = d.rx;
          body.angularVelocity.y = d.ry;
          body.angularVelocity.z = d.rz;
        }
      } else {
        const d   = cubeRand[i];
        const idx = i * 1.37;
        const amp = 0.35;
        body.angularVelocity.x = Math.sin(time * 1.8 + idx) * amp * d.rx * 3;
        body.angularVelocity.y = Math.cos(time * 1.4 + idx * 0.7) * amp * d.ry * 3;
        body.angularVelocity.z = Math.sin(time * 2.1 + idx * 1.3) * amp * d.rz * 3;
      }
    } else if (dist > 0.35) {
      const d = cubeRand[i];
      body.angularVelocity.x += (d.rx * 2 - body.angularVelocity.x) * 0.05;
      body.angularVelocity.y += (d.ry * 2 - body.angularVelocity.y) * 0.05;
      body.angularVelocity.z += (d.rz * 2 - body.angularVelocity.z) * 0.05;
    } else {
      const rest = cubeRand[i].restQuaternion;
      body.quaternion.set(rest.x, rest.y, rest.z, rest.w);
      body.angularVelocity.set(0, 0, 0);
    }
  }

  // ── 5. Step physics ──
  world.step(1 / 60, dt, 1);

  // ── 6. Sync instanced product transforms from physics bodies ──
  syncActiveProductTransforms(cubeRand, cubes, spawnCount);

  // ── 7. Render ──
  renderer.render(scene, camera);

  // ── 8. FPS counter ──
  fpsFrames++;
  const now = performance.now();
  if (now - fpsLast >= 500) {
    fpsCurrent = Math.round(fpsFrames / ((now - fpsLast) / 1000));
    fpsFrames = 0;
    fpsLast = now;
    const el = document.getElementById('fps');
    if (el) el.textContent = fpsCurrent + ' FPS';
  }
}
