// ═══════════════════════════════════════════════════════════
//  config.js — Constants, product types, body segments
//  Single source of truth for all tuning parameters
// ═══════════════════════════════════════════════════════════

// ─── AMC Brand Colors (hex ints for Three.js materials) ────
export const AMC_COLORS = {
  navy:      0x001A36,
  black:     0x111111,
  blue:      0x003E7E,
  blueLight: 0x0052A3,
  cyan:      0x00A4E4,
  red:       0xE1251B,
  white:     0xFFFFFF,
};

// ─── Physics & Motion ───────────────────────────────────────
export const SCALE       = 3;        // world-landmark meters → scene units
export const STIFFNESS   = 3;        // how fast cubes seek their target
export const MAX_SPEED   = 4;        // velocity cap (scene units/s)
export const SMOOTH      = 0.55;     // landmark temporal smoothing
export const SPAWN_RATE  = 18;       // active products made visible per frame

// ─── Camera & Pose Projection ──────────────────────────────
export const CAMERA_FOV = 60;
export const CAMERA_Z = 5.5;
export const BODY_TARGET_Z = 0;
export const BODY_DEPTH_SCALE = 0.85;

// ─── Assets & Product Density ──────────────────────────────
export const PRODUCT_GLOBAL_SCALE = 3.29;
export const STATIC_SHELF_ITEMS = 200;   // decorative static shelf fill

// ─── Shelf Layout ───────────────────────────────────────────
export const SHELF_X       = 3.2;    // distance from center to each shelf wall
export const SHELF_Z_BASE  = -1.0;   // base z of shelves
export const NUM_SHELVES   = 6;      // shelf rows per side
export const SHELF_Y_MIN   = -2.8;   // bottom shelf y
export const SHELF_Y_MAX   = 2.8;    // top shelf y
export const SHELF_EXTRA   = 0;      // webcam-first mode keeps only body-bound active products
export const SHELF_LENGTH  = 8;      // total z-extent of each shelf
export const SHELF_DEPTH   = 1.2;    // depth of each shelf (x-direction)
export const PLANK_THICK   = 0.04;   // plank thickness
export const ACTIVE_SHELF_ROWS = 2;
export const STATIC_SHELF_ROWS = 3;
export const SHELF_GAP         = 0.02;
export const SHELF_SETTLE_OFFSET = 0.02;
export const FLOOR_Y           = SHELF_Y_MIN - 0.35;
export const BODY_FLOOR_CLEARANCE = 0.65;

// ─── Product Types (w=width-x, h=height-y, d=depth-z) ──────
export const PRODUCT_TYPES = [
  { w: 0.10, h: 0.16, d: 0.07 },   // small box
  { w: 0.12, h: 0.28, d: 0.08 },   // cereal box
  { w: 0.08, h: 0.12, d: 0.08 },   // can
  { w: 0.07, h: 0.22, d: 0.07 },   // bottle
  { w: 0.18, h: 0.14, d: 0.12 },   // wide box
  { w: 0.06, h: 0.09, d: 0.06 },   // small jar
  { w: 0.14, h: 0.20, d: 0.10 },   // medium box
  { w: 0.10, h: 0.10, d: 0.10 },   // cube item
];

// ─── Body Segment Definitions ───────────────────────────────
export const BODY_DENSITY = 0.5;

const BASE_SEGMENTS = [
  { type: 'cluster', center: 0,  count: 40,  radius: 0.15, sz: 0.70 },            // head
  { type: 'line', from: 0, to: [11, 12], count: 10, thickness: 0.05, sz: 0.80 },  // neck
  { type: 'quad', corners: [11, 12, 24, 23], count: 144, thickness: 0.08, sz: 1 }, // torso
  { type: 'line', from: 11, to: 13, count: 44, thickness: 0.11,  sz: 0.95 },      // L upper arm
  { type: 'line', from: 13, to: 15, count: 34, thickness: 0.085, sz: 0.88 },      // L forearm
  { type: 'line', from: 12, to: 14, count: 44, thickness: 0.11,  sz: 0.95 },      // R upper arm
  { type: 'line', from: 14, to: 16, count: 34, thickness: 0.085, sz: 0.88 },      // R forearm
  { type: 'line', from: 23, to: 25, count: 38, thickness: 0.065, sz: 0.90 },      // L upper leg
  { type: 'line', from: 25, to: 27, count: 28, thickness: 0.045, sz: 0.80 },      // L lower leg
  { type: 'line', from: 27, to: 31, count: 6,  thickness: 0.035, sz: 0.70 },      // L foot
  { type: 'line', from: 24, to: 26, count: 38, thickness: 0.065, sz: 0.90 },      // R upper leg
  { type: 'line', from: 26, to: 28, count: 28, thickness: 0.045, sz: 0.80 },      // R lower leg
  { type: 'line', from: 28, to: 32, count: 6,  thickness: 0.035, sz: 0.70 },      // R foot
];

export const SEGMENTS = BASE_SEGMENTS.map(segment => ({
  ...segment,
  count: Math.max(1, Math.round(segment.count * BODY_DENSITY)),
}));

// Pre-compute segment ranges: which cube indices belong to which segment
export const segRanges = [];
let _off = 0;
for (const s of SEGMENTS) {
  segRanges.push({ start: _off, end: _off + s.count, seg: s });
  _off += s.count;
}
export const BODY_CUBES  = _off;
export const TOTAL_CUBES = BODY_CUBES + SHELF_EXTRA;

// ─── Gesture Detection Thresholds ───────────────────────────
export const HAND_RAISE_Y_OFFSET  = -0.15;   // wrist Y must be this much above shoulder Y (negative = up in MediaPipe)
export const PHASE_DEBOUNCE_MS    = 600;      // ms a state must be stable before phase transition
export const PHASE_EXIT_DELAY_MS  = 1200;     // ms before dropping from a higher phase when gesture stops
export const POSE_PRESENT_FRAMES  = 8;
export const POSE_LOST_FRAMES     = 24;
export const HAND_RAISE_FRAMES    = 5;
export const GESTURE_COOLDOWN_MS  = 1200;
export const GESTURE_TIMEOUT_MS   = 5000;
export const CHAOS_AUTO_GESTURE_MS = 10000;
export const HARMONY_HOLD_MS      = 4500;
export const HARMONY_COPY_DELAY_MS = 2500;
export const POSE_LOST_RETURN_MS  = 2600;

// ─── Phase Constants ────────────────────────────────────────
export const PHASE = {
  BOOT:      0,
  IDLE:      1,
  CHAOS:     2,
  GESTURE:   3,
  HARMONY:   4,
  POSE_LOST: 5,
  ERROR:     6,
};
