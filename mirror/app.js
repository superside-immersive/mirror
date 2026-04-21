// ═══════════════════════════════════════════════════════════════
//  Mirror Body — MediaPipe Pose → 3D Cube Body with Physics
//  Cubes start on supermarket shelves, fly to form the body
//  All loaded from CDN, zero installs needed
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

// ─── constants ──────────────────────────────────────────────
const SCALE       = 3;       // world-landmark meters → scene units
const STIFFNESS   = 3;       // how fast cubes seek their target
const MAX_SPEED   = 4;       // velocity cap (scene units/s)
const SMOOTH      = 0.55;    // landmark temporal smoothing
const SPAWN_RATE  = 12;      // cubes spawned per frame

// ─── shelf layout ───────────────────────────────────────────
const SHELF_X       = 3.2;    // distance from center to each shelf wall
const SHELF_Z_BASE  = -1.0;   // base z of shelves
const NUM_SHELVES   = 6;      // shelf rows per side
const SHELF_Y_MIN   = -2.8;   // bottom shelf y
const SHELF_Y_MAX   = 2.8;    // top shelf y
const SHELF_EXTRA   = 600;    // extra cubes that stay on shelves
const SHELF_LENGTH  = 8;      // total z-extent of each shelf
const SHELF_DEPTH   = 1.2;    // depth of each shelf (x-direction)
const PLANK_THICK   = 0.04;   // plank thickness

// ─── product types (w=width-x, h=height-y, d=depth-z) ──────
const PRODUCT_TYPES = [
  { w: 0.10, h: 0.16, d: 0.07 },  // small box
  { w: 0.12, h: 0.28, d: 0.08 },  // cereal box
  { w: 0.08, h: 0.12, d: 0.08 },  // can
  { w: 0.07, h: 0.22, d: 0.07 },  // bottle
  { w: 0.18, h: 0.14, d: 0.12 },  // wide box
  { w: 0.06, h: 0.09, d: 0.06 },  // small jar
  { w: 0.14, h: 0.20, d: 0.10 },  // medium box
  { w: 0.10, h: 0.10, d: 0.10 },  // cube item
];

// ─── body segment definitions ───────────────────────────────
const SEGMENTS = [
  { type: 'cluster', center: 0,  count: 35,  radius: 0.15, sz: 0.70 },          // head
  { type: 'line', from: 0, to: [11, 12], count: 8, thickness: 0.05, sz: 0.80 }, // neck
  { type: 'quad', corners: [11, 12, 24, 23], count: 118, thickness: 0.08, sz: 1 }, // torso
  { type: 'line', from: 11, to: 13, count: 22, thickness: 0.055, sz: 0.85 },    // L upper arm
  { type: 'line', from: 13, to: 15, count: 18, thickness: 0.04,  sz: 0.75 },    // L forearm
  { type: 'line', from: 12, to: 14, count: 22, thickness: 0.055, sz: 0.85 },    // R upper arm
  { type: 'line', from: 14, to: 16, count: 18, thickness: 0.04,  sz: 0.75 },    // R forearm
  { type: 'line', from: 23, to: 25, count: 35, thickness: 0.065, sz: 0.90 },    // L upper leg
  { type: 'line', from: 25, to: 27, count: 25, thickness: 0.045, sz: 0.80 },    // L lower leg
  { type: 'line', from: 27, to: 31, count: 5,  thickness: 0.035, sz: 0.70 },    // L foot
  { type: 'line', from: 24, to: 26, count: 35, thickness: 0.065, sz: 0.90 },    // R upper leg
  { type: 'line', from: 26, to: 28, count: 25, thickness: 0.045, sz: 0.80 },    // R lower leg
  { type: 'line', from: 28, to: 32, count: 5,  thickness: 0.035, sz: 0.70 },    // R foot
];

// pre-compute ranges: which cube indices belong to which segment
const segRanges = [];
let _off = 0;
for (const s of SEGMENTS) {
  segRanges.push({ start: _off, end: _off + s.count, seg: s });
  _off += s.count;
}
const BODY_CUBES  = _off;              // ~351
const TOTAL_CUBES = BODY_CUBES + SHELF_EXTRA; // ~801

// ─── globals ────────────────────────────────────────────────
let scene, camera, renderer, clock, envMap;
let world;
const cubes        = [];   // { mesh, body }
const cubeRand     = [];   // per-cube random data
const shelfHome    = [];   // Vec3 — each cube's resting shelf position
let bodyTargets    = null; // THREE.Vector3[] — body formation targets
let smoothedLm     = null;
let spawnCount     = 0;
let poseActive     = false;
let video, poseLandmarker;
let lastVideoTime  = -1;

// FPS meter
let fpsFrames = 0, fpsLast = performance.now(), fpsCurrent = 0;

// ─── helpers ────────────────────────────────────────────────
const rand  = (a, b) => a + Math.random() * (b - a);

function randomOnSphere() {
  const u = Math.random(), v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi   = Math.acos(2 * v - 1);
  return [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
}

/** Convert a MediaPipe worldLandmark → Three.js Vector3 (mirrored X for mirror effect) */
function lm2v(wl, idx) {
  return new THREE.Vector3(-wl[idx].x * SCALE, -wl[idx].y * SCALE, -wl[idx].z * SCALE);
}

/** Midpoint of several landmarks */
function lmMid(wl, indices) {
  const v = new THREE.Vector3();
  for (const i of indices) v.add(lm2v(wl, i));
  return v.divideScalar(indices.length);
}

function endpointVec(wl, to) {
  return Array.isArray(to) ? lmMid(wl, to) : lm2v(wl, to);
}

// ─── generate shelf home positions ────────────────────────────
function generateShelfPositions() {
  const shelfYs = [];
  for (let s = 0; s < NUM_SHELVES; s++) {
    shelfYs.push(SHELF_Y_MIN + s * (SHELF_Y_MAX - SHELF_Y_MIN) / (NUM_SHELVES - 1));
  }

  // distribute cubes round-robin into shelf bins (left shelves, then right)
  // shuffle assignment so body cubes come from all over the gondolas
  const totalShelves = NUM_SHELVES * 2;
  const bins = Array.from({ length: totalShelves }, () => []);
  const indices = Array.from({ length: TOTAL_CUBES }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let j = indices.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [indices[j], indices[k]] = [indices[k], indices[j]];
  }
  for (let n = 0; n < indices.length; n++) bins[n % totalShelves].push(indices[n]);

  const GAP    = 0.015;

  shelfHome.length = TOTAL_CUBES;

  for (let s = 0; s < totalShelves; s++) {
    const side   = s < NUM_SHELVES ? -1 : 1;
    const row    = s < NUM_SHELVES ? s : s - NUM_SHELVES;
    const shelfY = shelfYs[row];
    const xCenter = side * SHELF_X;
    // plank top surface
    const plankTopY = shelfY - PLANK_THICK / 2 + PLANK_THICK;

    // pack products in a grid: multiple rows along X depth, packed along Z
    const xInner = xCenter - side * (SHELF_DEPTH / 2 - 0.04); // front edge (toward center)
    const xOuter = xCenter + side * (SHELF_DEPTH / 2 - 0.04); // back edge (toward wall)
    const zStart = SHELF_Z_BASE - SHELF_LENGTH / 2;

    // figure out how many X rows we can fit (~3-4 rows)
    const avgProductW = 0.12;
    const numXRows = Math.max(2, Math.floor(SHELF_DEPTH / (avgProductW + GAP)));

    // assign products to X rows round-robin, then pack along Z
    const xRows = Array.from({ length: numXRows }, () => []);
    for (let p = 0; p < bins[s].length; p++) xRows[p % numXRows].push(bins[s][p]);

    for (let r = 0; r < numXRows; r++) {
      const xFrac = numXRows > 1 ? r / (numXRows - 1) : 0.5;
      // lerp from inner edge to outer edge
      const rowX = xInner + (xOuter - xInner) * xFrac;

      let zCursor = zStart;
      for (const idx of xRows[r]) {
        const cd = cubeRand[idx];
        shelfHome[idx] = new THREE.Vector3(
          rowX,
          plankTopY + cd.h / 2,   // sit flat on plank top
          zCursor + cd.d / 2,
        );
        zCursor += cd.d + GAP;
      }
    }
  }
}

// ─── generate per-cube random data (done once at startup) ───
function generateCubeData() {
  for (let i = 0; i < TOTAL_CUBES; i++) {
    const sph = randomOnSphere();
    let seg = null;
    if (i < BODY_CUBES) {
      const range = segRanges.find(r => i >= r.start && i < r.end);
      seg = range.seg;
    }
    const szMul = seg ? seg.sz : rand(0.7, 1.0);

    // pick a random product shape with slight variation
    const pt   = PRODUCT_TYPES[Math.floor(Math.random() * PRODUCT_TYPES.length)];
    const pVar = rand(0.8, 1.2) * szMul;

    const data = {
      ox: sph[0], oy: sph[1], oz: sph[2],
      w: pt.w * pVar,
      h: pt.h * pVar,
      d: pt.d * pVar,
      roughVar: rand(0.18, 0.45),
      rx: (Math.random() - 0.5) * 0.6,
      ry: (Math.random() - 0.5) * 0.6,
      rz: (Math.random() - 0.5) * 0.6,
    };

    // stratified UV for quad (torso)
    if (seg && seg.type === 'quad') {
      const range  = segRanges.find(r => i >= r.start && i < r.end);
      const localI = i - range.start;
      const cols = Math.ceil(Math.sqrt(seg.count * 1.4));
      const rows = Math.ceil(seg.count / cols);
      const col  = localI % cols;
      const row  = Math.floor(localI / cols);
      data.qu = Math.min(1, (col + 0.1 + Math.random() * 0.8) / cols);
      data.qv = Math.min(1, (row + 0.1 + Math.random() * 0.8) / rows);
    }

    cubeRand.push(data);
  }
}

// ─── compute body targets from world landmarks ─────────────
function computeBodyTargets(wl) {
  const t = new Array(BODY_CUBES);

  for (const { start, end, seg } of segRanges) {
    if (seg.type === 'cluster') {
      const center = lm2v(wl, seg.center);
      for (let i = start; i < end; i++) {
        const d = cubeRand[i];
        t[i] = new THREE.Vector3(
          center.x + d.ox * seg.radius * SCALE,
          center.y + d.oy * seg.radius * SCALE,
          center.z + d.oz * seg.radius * SCALE,
        );
      }

    } else if (seg.type === 'line') {
      const a = lm2v(wl, seg.from);
      const b = endpointVec(wl, seg.to);
      let li = 0;
      for (let i = start; i < end; i++) {
        const frac = seg.count > 1 ? li / (seg.count - 1) : 0.5;
        const d    = cubeRand[i];
        const base = a.clone().lerp(b, frac);
        t[i] = new THREE.Vector3(
          base.x + d.ox * seg.thickness * SCALE,
          base.y + d.oy * seg.thickness * SCALE,
          base.z + d.oz * seg.thickness * SCALE,
        );
        li++;
      }

    } else if (seg.type === 'quad') {
      const tl = lm2v(wl, seg.corners[0]); // left shoulder
      const tr = lm2v(wl, seg.corners[1]); // right shoulder
      const br = lm2v(wl, seg.corners[2]); // right hip
      const bl = lm2v(wl, seg.corners[3]); // left hip
      for (let i = start; i < end; i++) {
        const d   = cubeRand[i];
        const u   = d.qu, v = d.qv;
        const top = tl.clone().lerp(tr, u);
        const bot = bl.clone().lerp(br, u);
        const pt  = top.lerp(bot, v);
        t[i] = new THREE.Vector3(
          pt.x + d.ox * seg.thickness * SCALE,
          pt.y + d.oy * seg.thickness * SCALE,
          pt.z + d.oz * seg.thickness * SCALE,
        );
      }
    }
  }
  return t;
}

// ─── smooth landmarks to reduce jitter ──────────────────────
function smoothLandmarks(current) {
  if (!smoothedLm) {
    smoothedLm = current.map(l => ({ x: l.x, y: l.y, z: l.z }));
    return smoothedLm;
  }
  for (let i = 0; i < current.length; i++) {
    smoothedLm[i].x += (current[i].x - smoothedLm[i].x) * SMOOTH;
    smoothedLm[i].y += (current[i].y - smoothedLm[i].y) * SMOOTH;
    smoothedLm[i].z += (current[i].z - smoothedLm[i].z) * SMOOTH;
  }
  return smoothedLm;
}

// ─── create shelf visual geometry (planks + side panels) ────
function createShelfVisuals() {
  const shelfYs = [];
  for (let s = 0; s < NUM_SHELVES; s++) {
    shelfYs.push(SHELF_Y_MIN + s * (SHELF_Y_MAX - SHELF_Y_MIN) / (NUM_SHELVES - 1));
  }

  const plankGeom = new THREE.BoxGeometry(SHELF_DEPTH, PLANK_THICK, SHELF_LENGTH);
  const plankMat  = new THREE.MeshStandardMaterial({
    color: 0x0054a4, roughness: 1.0, metalness: 0.0,
  });

  const panelGeom = new THREE.BoxGeometry(0.06, SHELF_Y_MAX - SHELF_Y_MIN + 0.6, SHELF_LENGTH);
  const panelMat  = new THREE.MeshStandardMaterial({
    color: 0x004080, roughness: 1.0, metalness: 0.0,
  });

  for (const side of [-1, 1]) {
    const x = side * SHELF_X;

    // vertical back panel (at outer edge of shelf)
    const panel = new THREE.Mesh(panelGeom, panelMat);
    panel.position.set(x + side * (SHELF_DEPTH / 2 + 0.03), 0, SHELF_Z_BASE);
    scene.add(panel);

    // horizontal shelf planks
    for (const y of shelfYs) {
      const plank = new THREE.Mesh(plankGeom, plankMat);
      plank.position.set(x, y - PLANK_THICK / 2, SHELF_Z_BASE);
      scene.add(plank);
    }
  }
}

// ─── init Three.js ──────────────────────────────────────────
function initThree() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xa0a6ae, 8, 22);

  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 5.5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xa0a6ae);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // ── generate bright environment map (supermarket-like) ──
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  // bright neutral sky dome
  const envGeo = new THREE.SphereGeometry(10, 32, 16);
  const envMat = new THREE.MeshBasicMaterial({ color: 0xb8c0cc, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(envGeo, envMat));
  // ceiling fluorescent strips (bright white panels)
  const stripGeo = new THREE.PlaneGeometry(6, 0.6);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
  for (let z = -4; z <= 4; z += 2.5) {
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 7, z);
    strip.rotation.x = Math.PI / 2;
    envScene.add(strip);
  }
  // floor bounce (medium gray)
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

  // ── lighting — environment-driven with strong AO contrast ──
  // hemisphere: bright sky vs dark ground = strong natural AO
  const hemi = new THREE.HemisphereLight(0xc8d4e8, 0x3a4450, 2.5);
  scene.add(hemi);

  // very subtle ambient to avoid pitch-black crevices
  scene.add(new THREE.AmbientLight(0x8090a8, 0.35));

  // single key directional (shadow caster) — like ceiling fluorescent
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

  // soft fill from the other side
  const fill = new THREE.DirectionalLight(0xccddff, 1.0);
  fill.position.set(-3, 5, 2);
  scene.add(fill);

  // ── supermarket floor ──
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x6a7280,
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

// ─── init Cannon-es physics ─────────────────────────────────
function initPhysics() {
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
  world.solver.iterations = 2;
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.tolerance = 0.1;

  world.defaultContactMaterial.friction    = 0.3;
  world.defaultContactMaterial.restitution = 0.02;
}

// ─── create cubes (Three.js mesh + Cannon-es body each) ─────
function createCubes() {
  const sharedGeom = new THREE.BoxGeometry(1, 1, 1);
  const cannonMat  = new CANNON.Material('cube');

  for (let i = 0; i < TOTAL_CUBES; i++) {
    const d = cubeRand[i];

    // Albertsons blue — full roughness, matte
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0054a4,
      roughness: 1.0,
      metalness: 0.0,
      envMap: envMap,
      envMapIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(sharedGeom, mat);
    mesh.scale.set(d.w, d.h, d.d);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    scene.add(mesh);

    // start at shelf home position
    const home = shelfHome[i];
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(d.w / 2, d.h / 2, d.d / 2)),
      material: cannonMat,
      linearDamping:  0.35,
      angularDamping: 0.6,
      sleepSpeedLimit: 0.3,
      sleepTimeLimit:  0.4,
      position: new CANNON.Vec3(home.x, home.y, home.z),
    });
    world.addBody(body);

    cubes.push({ mesh, body });
  }
}

// ─── webcam init ────────────────────────────────────────────
async function initWebcam() {
  video = document.getElementById('webcam');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
  });
  video.srcObject = stream;
  await new Promise(resolve => { video.onloadeddata = resolve; });
}

// ─── MediaPipe Pose init ────────────────────────────────────
async function initPose() {
  setLoadingText('Loading pose model...');

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

// ─── small helpers ──────────────────────────────────────────
function setLoadingText(txt) {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = txt;
}

function hideLoading() {
  document.getElementById('loading')?.classList.add('hidden');
}

// ─── main animation loop ────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const dt   = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();

  // ── pose detection ──
  if (poseLandmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      const result = poseLandmarker.detectForVideo(video, performance.now());
      if (result.worldLandmarks && result.worldLandmarks.length > 0) {
        const wl    = smoothLandmarks(result.worldLandmarks[0]);
        bodyTargets = computeBodyTargets(wl);
        poseActive  = true;
      } else {
        poseActive = false;
      }
    } catch (e) {
      // detection can occasionally fail on frame transitions
    }
  }

  // progressive cube spawn
  if (spawnCount < TOTAL_CUBES) {
    spawnCount = Math.min(TOTAL_CUBES, spawnCount + SPAWN_RATE);
  }

  // ── drive each cube toward its target ──
  for (let i = 0; i < spawnCount; i++) {
    const { mesh, body } = cubes[i];
    mesh.visible = true;

    let target;
    if (poseActive && i < BODY_CUBES && bodyTargets) {
      // this cube flies off the shelf to form the body
      target = bodyTargets[i];
    } else {
      // this cube stays (or returns) to its shelf
      target = shelfHome[i];
    }
    if (!target) continue;

    const dx   = target.x - body.position.x;
    const dy   = target.y - body.position.y;
    const dz   = target.z - body.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const isBodyBound = poseActive && i < BODY_CUBES;

    if (dist > 0.005) {
      const stiff  = isBodyBound ? STIFFNESS : STIFFNESS * 0.7;
      const maxSpd = isBodyBound ? MAX_SPEED : MAX_SPEED * 0.6;

      let speed = Math.min(dist * stiff, maxSpd);
      let vx = dx / dist * speed;
      let vy = dy / dist * speed;
      let vz = dz / dist * speed;

      // flock / swoop when flying back to shelf
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

      if (body.sleepState === 2) body.wakeUp(); // SLEEPING = 2
    } else {
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      if (body.sleepState !== 2) body.sleep();
    }

    // rotation behaviour
    if (isBodyBound) {
      if (dist > 0.3) {
        // in-flight tumble
        const d = cubeRand[i];
        if (body.angularVelocity.length() < 0.8) {
          body.angularVelocity.x = d.rx;
          body.angularVelocity.y = d.ry;
          body.angularVelocity.z = d.rz;
        }
      } else {
        // on-body: gentle organic wobble so figure feels alive
        const d   = cubeRand[i];
        const idx = i * 1.37;
        const amp = 0.35;
        body.angularVelocity.x = Math.sin(time * 1.8 + idx) * amp * d.rx * 3;
        body.angularVelocity.y = Math.cos(time * 1.4 + idx * 0.7) * amp * d.ry * 3;
        body.angularVelocity.z = Math.sin(time * 2.1 + idx * 1.3) * amp * d.rz * 3;
      }
    } else if (dist > 0.35) {
      // flying back to shelf: tumble freely
      const d = cubeRand[i];
      body.angularVelocity.x += (d.rx * 2 - body.angularVelocity.x) * 0.05;
      body.angularVelocity.y += (d.ry * 2 - body.angularVelocity.y) * 0.05;
      body.angularVelocity.z += (d.rz * 2 - body.angularVelocity.z) * 0.05;
    } else {
      // near shelf: settle upright
      body.quaternion.set(0, 0, 0, 1);
      body.angularVelocity.set(0, 0, 0);
    }
  }

  // ── step physics (collision resolution) ──
  world.step(1 / 60, dt, 1);

  // ── sync Three.js meshes from physics bodies ──
  for (let i = 0; i < spawnCount; i++) {
    const { mesh, body } = cubes[i];
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }

  renderer.render(scene, camera);

  // ── FPS counter ──
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

// ─── window resize ──────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ─── cleanup on page unload ─────────────────────────────────
window.addEventListener('beforeunload', () => {
  if (video?.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
});

// ─── main entry point ───────────────────────────────────────
async function main() {
  setLoadingText('Initializing...');
  generateCubeData();
  generateShelfPositions();
  initThree();
  initPhysics();
  createShelfVisuals();
  createCubes();

  try {
    setLoadingText('Starting camera...');
    await initWebcam();
    await initPose();
  } catch (err) {
    console.error('Init error:', err);
    setLoadingText('Error: ' + err.message);
    return;
  }

  hideLoading();
  animate();
}

main();
