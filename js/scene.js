// ═══════════════════════════════════════════════════════════
//  scene.js — Three.js initialization, lighting, shelves,
//  environment map — all branded with AMC colors
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import {
  AMC_COLORS, NUM_SHELVES, SHELF_X, SHELF_Z_BASE,
  SHELF_Y_MIN, SHELF_Y_MAX, SHELF_LENGTH, SHELF_DEPTH, PLANK_THICK,
} from './config.js';

// ─── Exported state ─────────────────────────────────────────
export let scene, camera, renderer, clock, envMap;

// ─── Initialize Three.js ────────────────────────────────────
export function initThree() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x7e8894, 10, 28);

  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 5.5);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x7e8894);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.48;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
  const envMat = new THREE.MeshBasicMaterial({ color: 0xb8c0cc, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(envGeo, envMat));

  // Ceiling fluorescent strips
  const stripGeo = new THREE.PlaneGeometry(6, 0.6);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
  for (let z = -4; z <= 4; z += 2.5) {
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 7, z);
    strip.rotation.x = Math.PI / 2;
    envScene.add(strip);
  }

  // Floor bounce
  const floorEnv = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshBasicMaterial({ color: 0x889099 })
  );
  floorEnv.position.y = -4;
  floorEnv.rotation.x = -Math.PI / 2;
  envScene.add(floorEnv);

  envMap = pmrem.fromScene(envScene, 0, 0.1, 50).texture;
  pmrem.dispose();
  scene.environment = envMap;

  // ── Lighting ──
  const hemi = new THREE.HemisphereLight(0xc8d4e8, 0x3a4450, 2.5);
  scene.add(hemi);

  scene.add(new THREE.AmbientLight(0x8090a8, 0.35));

  // Key directional — shadow caster
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(2, 8, 4);
  key.castShadow = true;
  key.shadow.mapSize.width  = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far  = 25;
  key.shadow.camera.left = key.shadow.camera.bottom = -8;
  key.shadow.camera.right = key.shadow.camera.top = 8;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  // Soft fill
  const fill = new THREE.DirectionalLight(0xccddff, 1.0);
  fill.position.set(-3, 5, 2);
  scene.add(fill);

  // ── Supermarket floor ──
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x5a6270,
    roughness: 0.95,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = SHELF_Y_MIN - 0.35;
  floor.receiveShadow = false;
  scene.add(floor);

  clock = new THREE.Clock();
}

// ─── Create shelf visual geometry ───────────────────────────
export function createShelfVisuals() {
  const shelfYs = [];
  for (let s = 0; s < NUM_SHELVES; s++) {
    shelfYs.push(SHELF_Y_MIN + s * (SHELF_Y_MAX - SHELF_Y_MIN) / (NUM_SHELVES - 1));
  }

  // AMC-branded shelf materials
  const plankGeom = new THREE.BoxGeometry(SHELF_DEPTH, PLANK_THICK, SHELF_LENGTH);
  const plankMat  = new THREE.MeshStandardMaterial({
    color: AMC_COLORS.blue,
    roughness: 1.0,
    metalness: 0.0,
  });

  const panelGeom = new THREE.BoxGeometry(0.06, SHELF_Y_MAX - SHELF_Y_MIN + 0.6, SHELF_LENGTH);
  const panelMat  = new THREE.MeshStandardMaterial({
    color: AMC_COLORS.navy,
    roughness: 1.0,
    metalness: 0.0,
  });

  for (const side of [-1, 1]) {
    const x = side * SHELF_X;

    // Vertical back panel
    const panel = new THREE.Mesh(panelGeom, panelMat);
    panel.position.set(x + side * (SHELF_DEPTH / 2 + 0.03), 0, SHELF_Z_BASE);
    scene.add(panel);

    // Horizontal shelf planks
    for (const y of shelfYs) {
      const plank = new THREE.Mesh(plankGeom, plankMat);
      plank.position.set(x, y - PLANK_THICK / 2, SHELF_Z_BASE);
      scene.add(plank);
    }
  }
}

// ─── Handle window resize ───────────────────────────────────
export function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
