// ═══════════════════════════════════════════════════════════
//  productRenderer.js — Instanced rendering for active and
//  static supermarket products from PRODUCTOS.glb
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { envMap, scene } from './scene.js';
import { DEFAULT_SELECTION_COLOR, PRODUCT_COLOR_VALUES } from './config.js';

const dynamicBatches = new Map();
const staticBatches = new Map();
const activeHandles = [];
const staticHandles = [];

const tmpScale = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpItemMatrix = new THREE.Matrix4();
const tmpPieceMatrix = new THREE.Matrix4();
const zeroScale = new THREE.Vector3(0.000001, 0.000001, 0.000001);
const tmpColor = new THREE.Color();

function getColorValue(colorId) {
  return PRODUCT_COLOR_VALUES[colorId] ?? PRODUCT_COLOR_VALUES[DEFAULT_SELECTION_COLOR];
}

function createCleanMaterial(baseMaterial) {
  const material = baseMaterial.clone();
  if ('map' in material) material.map = null;
  if ('alphaMap' in material) material.alphaMap = null;
  if ('aoMap' in material) material.aoMap = null;
  if ('bumpMap' in material) material.bumpMap = null;
  if ('displacementMap' in material) material.displacementMap = null;
  if ('emissiveMap' in material) material.emissiveMap = null;
  if ('lightMap' in material) material.lightMap = null;
  if ('metalnessMap' in material) material.metalnessMap = null;
  if ('normalMap' in material) material.normalMap = null;
  if ('roughnessMap' in material) material.roughnessMap = null;
  if ('color' in material) material.color.setHex(0xffffff);
  if ('emissive' in material) material.emissive.setHex(0x000000);
  material.vertexColors = false;
  if ('roughness' in material) material.roughness = 0.82;
  if ('metalness' in material) material.metalness = 0.05;
  material.transparent = false;
  material.needsUpdate = true;
  return material;
}

function createBatchKey(piece) {
  return `${piece.geometry.uuid}|${piece.materialIndex}`;
}

function createBatchMap(items, catalog, mode) {
  const specs = new Map();
  for (const item of items) {
    const variant = catalog.variants[item.variantIndex];
    for (const piece of variant.pieces) {
      const key = createBatchKey(piece);
      if (!specs.has(key)) {
        const baseMaterial = catalog.materials[piece.materialIndex].clone();
        const cleanMaterial = createCleanMaterial(baseMaterial);
        cleanMaterial.envMap = envMap;
        cleanMaterial.envMapIntensity = 0.45;
        cleanMaterial.needsUpdate = true;

        specs.set(key, {
          key,
          geometry: piece.geometry,
          material: cleanMaterial,
          count: 0,
          mode,
        });
      }
      specs.get(key).count += 1;
    }
  }
  return specs;
}

function instantiateBatches(specs, targetMap) {
  for (const spec of specs.values()) {
    const instancedMesh = new THREE.InstancedMesh(spec.geometry, spec.material, spec.count);
    instancedMesh.instanceMatrix.setUsage(
      spec.mode === 'dynamic' ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage,
    );
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    instancedMesh.frustumCulled = false;
    scene.add(instancedMesh);
    targetMap.set(spec.key, { mesh: instancedMesh, cursor: 0 });
  }
}

function registerHandles(items, catalog, batchMap, targetHandles) {
  for (const item of items) {
    const variant = catalog.variants[item.variantIndex];
    const handles = [];

    for (const piece of variant.pieces) {
      const key = createBatchKey(piece);
      const batch = batchMap.get(key);
      const slot = batch.cursor++;
      handles.push({
        mesh: batch.mesh,
        slot,
        localMatrix: piece.localMatrix,
      });
    }

    targetHandles.push(handles);
  }
}

function writeHandles(handles, position, quaternion, scale, visible = true) {
  tmpPos.copy(position);
  tmpQuat.copy(quaternion);
  tmpScale.setScalar(scale);
  tmpItemMatrix.compose(tmpPos, tmpQuat, visible ? tmpScale : zeroScale);

  for (const handle of handles) {
    tmpPieceMatrix.multiplyMatrices(tmpItemMatrix, handle.localMatrix);
    handle.mesh.setMatrixAt(handle.slot, tmpPieceMatrix);
  }
}

function colorHandles(handles, colorId) {
  tmpColor.setHex(getColorValue(colorId));
  for (const handle of handles) {
    handle.mesh.setColorAt(handle.slot, tmpColor);
  }
}

function finalizeBatchMatrices(batchMap, recomputeBounds = false) {
  for (const batch of batchMap.values()) {
    batch.mesh.instanceMatrix.needsUpdate = true;
    if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
    if (recomputeBounds && batch.mesh.computeBoundingSphere) batch.mesh.computeBoundingSphere();
  }
}

export function createProductRenderers(catalog, activeItems, staticItems) {
  dynamicBatches.clear();
  staticBatches.clear();
  activeHandles.length = 0;
  staticHandles.length = 0;

  const dynamicSpecs = createBatchMap(activeItems, catalog, 'dynamic');
  const staticSpecs = createBatchMap(staticItems, catalog, 'static');

  instantiateBatches(dynamicSpecs, dynamicBatches);
  instantiateBatches(staticSpecs, staticBatches);

  registerHandles(activeItems, catalog, dynamicBatches, activeHandles);
  registerHandles(staticItems, catalog, staticBatches, staticHandles);

  activeItems.forEach((item, index) => {
    writeHandles(activeHandles[index], item.position, item.restQuaternion, item.scale, true);
    colorHandles(activeHandles[index], item.colorId);
  });

  staticItems.forEach((item, index) => {
    writeHandles(staticHandles[index], item.position, item.quaternion, item.scale, true);
    colorHandles(staticHandles[index], item.colorId);
  });

  finalizeBatchMatrices(dynamicBatches, true);
  finalizeBatchMatrices(staticBatches, true);
}

export function syncActiveProductTransforms(activeItems, bodies, visibleCount) {
  for (let i = 0; i < activeItems.length; i++) {
    const handles = activeHandles[i];
    if (!handles) continue;

    const body = bodies[i]?.body;
    if (!body) continue;

    tmpPos.set(body.position.x, body.position.y, body.position.z);
    tmpQuat.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    writeHandles(handles, tmpPos, tmpQuat, activeItems[i].scale, i < visibleCount);
  }

  finalizeBatchMatrices(dynamicBatches, false);
}
