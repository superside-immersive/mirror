// ═══════════════════════════════════════════════════════════
//  scene.js — Three.js initialization and transparent render
//  overlay for webcam-first product motion
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { CAMERA_FOV, CAMERA_Z } from './config.js';

// ─── Exported state ─────────────────────────────────────────
export let scene, camera, renderer, clock, envMap;

// ─── Initialize Three.js ────────────────────────────────────
export function initThree() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(CAMERA_FOV, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, CAMERA_Z);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  // Insert canvas as first child of body (behind UI layer)
  const canvas = renderer.domElement;
  canvas.id = 'three-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);

  // ── Generate bright environment map (supermarket-like) ──
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();

  // Bright neutral sky dome
  const envGeo = new THREE.SphereGeometry(10, 32, 16);
  const envMat = new THREE.MeshBasicMaterial({ color: 0x4c5563, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(envGeo, envMat));

  // Ceiling fluorescent strips
  const stripGeo = new THREE.PlaneGeometry(6, 0.6);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xbcc7d6 });
  for (let z = -4; z <= 4; z += 2.5) {
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 7, z);
    strip.rotation.x = Math.PI / 2;
    envScene.add(strip);
  }

  // Floor bounce
  const floorEnv = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshBasicMaterial({ color: 0x2f3742 })
  );
  floorEnv.position.y = -4;
  floorEnv.rotation.x = -Math.PI / 2;
  envScene.add(floorEnv);

  envMap = pmrem.fromScene(envScene, 0, 0.1, 50).texture;
  pmrem.dispose();
  scene.environment = envMap;

  // ── Lighting ──
  const hemi = new THREE.HemisphereLight(0xaeb9c9, 0x1a2330, 1.25);
  scene.add(hemi);

  scene.add(new THREE.AmbientLight(0x7b8ea7, 0.16));

  const key = new THREE.DirectionalLight(0xf3f6fb, 0.95);
  key.position.set(2, 8, 4);
  scene.add(key);

  // Soft fill
  const fill = new THREE.DirectionalLight(0xa6b4c9, 0.32);
  fill.position.set(-3, 5, 2);
  scene.add(fill);

  clock = new THREE.Clock();
}

// ─── No static scene geometry in webcam-first mode ─────────
export function createShelfVisuals() {
  // Intentionally empty: no floor, gondola, or static environment.
}

// ─── Handle window resize ───────────────────────────────────
export function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
