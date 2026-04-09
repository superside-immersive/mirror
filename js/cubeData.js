// ═══════════════════════════════════════════════════════════
//  cubeData.js — Active product metadata and shelf placement
//  using normalized variants from the branded hero GLBs
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import {
  TOTAL_CUBES, BODY_CUBES, segRanges,
  NUM_SHELVES, SHELF_X, SHELF_Z_BASE, SHELF_Y_MIN, SHELF_Y_MAX,
  SHELF_LENGTH, SHELF_DEPTH, PLANK_THICK,
  STATIC_SHELF_ITEMS, ACTIVE_SHELF_ROWS, STATIC_SHELF_ROWS, SHELF_GAP, SHELF_SETTLE_OFFSET,
  PRODUCT_GLOBAL_SCALE,
} from './config.js';
import { getProductOptionForIndex } from './productOptions.js';

// ─── Exported state ─────────────────────────────────────────
export const cubeRand = [];         // active product metadata (body-capable + active shelf items)
export const shelfHome = [];        // resting shelf position for active products
export const staticShelfItems = []; // decorative dense shelf-only instances

// ─── Helpers ────────────────────────────────────────────────
const rand = (a, b) => a + Math.random() * (b - a);

function randomOnSphere() {
  const u = Math.random(), v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
}

function pickRandomVariant(catalog, category = null) {
  const pool = category
    ? catalog.variants.filter(variant => variant.category === category)
    : catalog.variants;
  return pool[Math.floor(Math.random() * pool.length)] || catalog.variants[0];
}

function computeUniformScale(variant, targetHeight, maxWidth, maxDepth) {
  const fitByHeight = targetHeight / Math.max(variant.normalizedSize.y, 0.0001);
  const fitByWidth = maxWidth / Math.max(variant.normalizedSize.x, 0.0001);
  const fitByDepth = maxDepth / Math.max(variant.normalizedSize.z, 0.0001);
  return Math.max(0.05, Math.min(fitByHeight, fitByWidth, fitByDepth));
}

function createAisleFacingQuaternion(side, variance = 0.08) {
  const yaw = (side < 0 ? Math.PI / 2 : -Math.PI / 2) + rand(-variance, variance);
  const q = new THREE.Quaternion();
  q.setFromEuler(new THREE.Euler(0, yaw, 0));
  return q;
}

function applyShelfOrientationToItem(item) {
  return item;
}

function rowXBounds(side, rowCount, xCenter, inset) {
  const front = xCenter - side * (SHELF_DEPTH / 2 - inset);
  const back  = xCenter + side * (SHELF_DEPTH / 2 - inset);
  const rows = [];
  for (let r = 0; r < rowCount; r++) {
    const frac = rowCount > 1 ? r / (rowCount - 1) : 0.5;
    rows.push(front + (back - front) * frac);
  }
  return rows;
}

function rowScaleMultiplier(rowIndex, rowCount, frontBoost = 1.18, backScale = 0.86) {
  if (rowCount <= 1) return frontBoost;
  const t = rowIndex / (rowCount - 1);
  return frontBoost + (backScale - frontBoost) * t;
}

function rescaleItem(item, multiplier) {
  item.scale *= multiplier;
  if (typeof item.renderScale === 'number') item.renderScale *= multiplier;
  item.w *= multiplier;
  item.h *= multiplier;
  item.d *= multiplier;
}

function spreadZPosition(index, count, margin, jitter = 0.06) {
  const usableLength = SHELF_LENGTH - margin * 2;
  const frac = count <= 1 ? 0.5 : index / (count - 1);
  const base = SHELF_Z_BASE - SHELF_LENGTH / 2 + margin + frac * usableLength;
  const jitterAmount = count <= 1 ? 0 : rand(-jitter, jitter);
  return base + jitterAmount;
}

function createShelfYs() {
  const shelfYs = [];
  for (let s = 0; s < NUM_SHELVES; s++) {
    shelfYs.push(SHELF_Y_MIN + s * (SHELF_Y_MAX - SHELF_Y_MIN) / (NUM_SHELVES - 1));
  }
  return shelfYs;
}

function createOffscreenHome(index) {
  const lane = index % 4;
  const spread = ((index * 0.61803398875) % 1) - 0.5;
  const depth = rand(-1.2, 1.4);

  switch (lane) {
    case 0:
      return new THREE.Vector3(-6.8 - rand(0, 1.2), spread * 5.8, depth);
    case 1:
      return new THREE.Vector3(6.8 + rand(0, 1.2), spread * 5.8, depth);
    case 2:
      return new THREE.Vector3(spread * 6.6, 4.8 + rand(0, 1.0), depth);
    default:
      return new THREE.Vector3(spread * 6.6, -4.8 - rand(0, 1.0), depth);
  }
}

function distributeIndices(totalCount, totalShelves) {
  const bins = Array.from({ length: totalShelves }, () => []);
  const indices = Array.from({ length: totalCount }, (_, i) => i);

  for (let j = indices.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [indices[j], indices[k]] = [indices[k], indices[j]];
  }

  for (let i = 0; i < indices.length; i++) bins[i % totalShelves].push(indices[i]);
  return bins;
}

function buildShelfCategoryOrder(categories, totalShelves) {
  const ordered = [];
  for (let i = 0; i < totalShelves; i++) {
    ordered.push(categories[i % categories.length]);
  }
  return ordered;
}

function groupActiveIndicesByCategory() {
  const groups = new Map();
  for (let i = 0; i < cubeRand.length; i++) {
    const category = cubeRand[i].category || 'box';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(i);
  }
  return groups;
}

function buildCategoryBins(totalShelves, categories) {
  const bins = Array.from({ length: totalShelves }, () => []);
  const shelfCategories = buildShelfCategoryOrder(categories, totalShelves);

  // Shuffle all indices to avoid any ordering bias
  const allIndices = Array.from({ length: cubeRand.length }, (_, i) => i);
  for (let j = allIndices.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [allIndices[j], allIndices[k]] = [allIndices[k], allIndices[j]];
  }

  // Simple round-robin: distribute shuffled indices evenly across all shelves
  for (let i = 0; i < allIndices.length; i++) {
    bins[i % totalShelves].push(allIndices[i]);
  }

  return { bins, shelfCategories };
}

function createActiveItemData(index, catalog) {
  const sph = randomOnSphere();
  const option = getProductOptionForIndex(index);
  const heroVariantId = catalog.optionVariantMap?.[option.id];
  const variant = typeof heroVariantId === 'number'
    ? catalog.variants[heroVariantId]
    : pickRandomVariant(catalog, option.id);

  let seg = null;
  if (index < BODY_CUBES) {
    const range = segRanges.find(r => index >= r.start && index < r.end);
    seg = range?.seg || null;
  }

  const sizeBias = seg ? seg.sz : rand(0.85, 1.05);
  const targetHeight = rand(0.10, 0.22) * sizeBias;
  const bodyScaleMultiplier = index < BODY_CUBES ? (option.bodyScaleMultiplier || 1) : 1;
  const scale = computeUniformScale(variant, targetHeight, 0.28 * sizeBias, 0.26 * sizeBias) * rand(0.92, 1.08) * PRODUCT_GLOBAL_SCALE * bodyScaleMultiplier;

  const data = {
    variantIndex: variant.id,
    category: option.id,
    optionId: option.id,
    signatureStyle: option.signatureStyle,
    scale,
    renderScale: scale,
    ox: sph[0], oy: sph[1], oz: sph[2],
    w: variant.normalizedSize.x * scale,
    h: variant.normalizedSize.y * scale,
    d: variant.normalizedSize.z * scale,
    rx: (Math.random() - 0.5) * 0.6,
    ry: (Math.random() - 0.5) * 0.6,
    rz: (Math.random() - 0.5) * 0.6,
    motionSeed: Math.random(),
    restQuaternion: new THREE.Quaternion(),
    position: new THREE.Vector3(),
  };

  if (seg && seg.type === 'quad') {
    const range = segRanges.find(r => index >= r.start && index < r.end);
    const localI = index - range.start;
    const cols = Math.ceil(Math.sqrt(seg.count * 1.4));
    const rows = Math.ceil(seg.count / cols);
    const col = localI % cols;
    const row = Math.floor(localI / cols);
    data.qu = Math.min(1, (col + 0.1 + Math.random() * 0.8) / cols);
    data.qv = Math.min(1, (row + 0.1 + Math.random() * 0.8) / rows);
  }

  return data;
}

function createStaticItemData(catalog, category, index) {
  const variant = typeof catalog.optionVariantMap?.[category] === 'number'
    ? catalog.variants[catalog.optionVariantMap[category]]
    : pickRandomVariant(catalog, category);
  const targetHeight = rand(0.09, 0.22);
  const scale = computeUniformScale(variant, targetHeight, 0.32, 0.26) * rand(0.92, 1.05) * PRODUCT_GLOBAL_SCALE;

  return {
    variantIndex: variant.id,
    category,
    optionId: category,
    signatureStyle: variant.signatureStyle || null,
    scale,
    renderScale: scale,
    w: variant.normalizedSize.x * scale,
    h: variant.normalizedSize.y * scale,
    d: variant.normalizedSize.z * scale,
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  };
}

// ─── Generate active product data (done once at startup) ───
export function generateCubeData(catalog) {
  cubeRand.length = 0;
  for (let i = 0; i < TOTAL_CUBES; i++) {
    cubeRand.push(createActiveItemData(i, catalog));
  }
}

// ─── Generate offscreen staging positions for active products ──
export function generateShelfPositions() {
  shelfHome.length = TOTAL_CUBES;

  for (let i = 0; i < TOTAL_CUBES; i++) {
    const item = cubeRand[i];
    const pos = createOffscreenHome(i);
    shelfHome[i] = pos;
    item.position.copy(pos);
    item.restQuaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(
      rand(-0.45, 0.45),
      rand(-Math.PI, Math.PI),
      rand(-0.35, 0.35),
    )));
  }
}

// ─── No static shelf fill in webcam-first mode ─────────────
export function generateStaticShelfItems(/* catalog */) {
  staticShelfItems.length = 0;
}
