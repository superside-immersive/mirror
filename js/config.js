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
  red:       0x003E7E,
  white:     0xFFFFFF,
};

// ─── Physics & Motion ───────────────────────────────────────
export const SCALE       = 3;        // world-landmark meters → scene units
export const STIFFNESS   = 3;        // how fast cubes seek their target
export const MAX_SPEED   = 4;        // velocity cap (scene units/s)
export const SMOOTH      = 0.55;     // landmark temporal smoothing
export const SPAWN_RATE  = 18;       // active products made visible per frame

// ─── Assets & Product Density ──────────────────────────────
export const PRODUCT_ASSET_PATH = './PRODUCTOS.glb';
export const PRODUCT_GLOBAL_SCALE = 2.0;
export const STATIC_SHELF_ITEMS = 200;   // decorative static shelf fill

// ─── Shelf Layout ───────────────────────────────────────────
export const SHELF_X       = 3.2;    // distance from center to each shelf wall
export const SHELF_Z_BASE  = -1.0;   // base z of shelves
export const NUM_SHELVES   = 6;      // shelf rows per side
export const SHELF_Y_MIN   = -2.8;   // bottom shelf y
export const SHELF_Y_MAX   = 2.8;    // top shelf y
export const SHELF_EXTRA   = 120;    // active shelf items that stay on / return to shelves
export const SHELF_LENGTH  = 8;      // total z-extent of each shelf
export const SHELF_DEPTH   = 1.2;    // depth of each shelf (x-direction)
export const PLANK_THICK   = 0.04;   // plank thickness
export const ACTIVE_SHELF_ROWS = 2;
export const STATIC_SHELF_ROWS = 3;
export const SHELF_GAP         = 0.02;
export const SHELF_SETTLE_OFFSET = 0.02;
export const FLOOR_Y           = SHELF_Y_MIN - 0.35;
export const BODY_FLOOR_CLEARANCE = 0.65;

// ─── Product / Selection Colors ────────────────────────────
export const PRODUCT_COLOR_IDS = ['white', 'black', 'blue'];
export const PRODUCT_COLOR_VALUES = {
  white: AMC_COLORS.white,
  black: AMC_COLORS.black,
  blue: AMC_COLORS.blueLight,
};
export const DEFAULT_SELECTION_COLOR = 'blue';

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
export const SEGMENTS = [
  { type: 'cluster', center: 0,  count: 50,  radius: 0.15, sz: 0.70 },            // head
  { type: 'line', from: 0, to: [11, 12], count: 12, thickness: 0.05, sz: 0.80 },  // neck
  { type: 'quad', corners: [11, 12, 24, 23], count: 180, thickness: 0.08, sz: 1 }, // torso
  { type: 'line', from: 11, to: 13, count: 30, thickness: 0.055, sz: 0.85 },      // L upper arm
  { type: 'line', from: 13, to: 15, count: 24, thickness: 0.04,  sz: 0.75 },      // L forearm
  { type: 'line', from: 12, to: 14, count: 30, thickness: 0.055, sz: 0.85 },      // R upper arm
  { type: 'line', from: 14, to: 16, count: 24, thickness: 0.04,  sz: 0.75 },      // R forearm
  { type: 'line', from: 23, to: 25, count: 48, thickness: 0.065, sz: 0.90 },      // L upper leg
  { type: 'line', from: 25, to: 27, count: 34, thickness: 0.045, sz: 0.80 },      // L lower leg
  { type: 'line', from: 27, to: 31, count: 8,  thickness: 0.035, sz: 0.70 },      // L foot
  { type: 'line', from: 24, to: 26, count: 48, thickness: 0.065, sz: 0.90 },      // R upper leg
  { type: 'line', from: 26, to: 28, count: 34, thickness: 0.045, sz: 0.80 },      // R lower leg
  { type: 'line', from: 28, to: 32, count: 8,  thickness: 0.035, sz: 0.70 },      // R foot
];

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

// ─── Phase Constants ────────────────────────────────────────
export const PHASE = {
  IDLE:    1,
  CHAOS:   2,
  GESTURE: 3,
  HARMONY: 4,
};
