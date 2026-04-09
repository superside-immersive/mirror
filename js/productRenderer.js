// ═══════════════════════════════════════════════════════════
//  productRenderer.js — Instanced rendering for active and
//  static branded products with phase-based emphasis controls
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { PHASE } from './config.js';
import { envMap, scene } from './scene.js';

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
let activePhase = null;
let activeSelection = null;

function isGlassLikeMaterial(material) {
  const name = (material.name || '').toLowerCase();
  return material.transmission > 0 || material.ior > 1 || material.thickness > 0 || name.includes('glass') || name.includes('bottle') || name.includes('liquid');
}

function createInstancedMaterial(baseMaterial, optionId = null) {
  const material = baseMaterial.clone();
  const glassLike = isGlassLikeMaterial(material);

  if ('envMap' in material) {
    material.envMap = envMap;
  }

  if (glassLike) {
    if ('transmission' in material) material.transmission = 0;
    if ('thickness' in material) material.thickness = 0;
    if ('ior' in material) material.ior = 1.45;
    if ('roughness' in material && typeof material.roughness === 'number') {
      material.roughness = Math.max(material.roughness, 0.08);
    }
    if ('metalness' in material && typeof material.metalness === 'number') {
      material.metalness = 0;
    }

    material.transparent = baseMaterial.opacity < 1 || baseMaterial.transparent;
    material.opacity = baseMaterial.opacity < 1 ? baseMaterial.opacity : 0.96;
    material.depthWrite = true;
    material.side = THREE.FrontSide;

    if ('envMapIntensity' in material) {
      material.envMapIntensity = optionId === 'coca-cola' ? 0.08 : 0.16;
    }

    if (optionId === 'coca-cola' && material.color) {
      material.color.multiplyScalar(0.42);
    }
  } else {
    material.transparent = baseMaterial.transparent;
    material.opacity = baseMaterial.opacity;
    material.depthWrite = baseMaterial.depthWrite;
    if ('envMapIntensity' in material && typeof material.envMapIntensity === 'number') {
      material.envMapIntensity = Math.min(material.envMapIntensity, 0.35);
    }
  }

  material.needsUpdate = true;
  return material;
}

function createBatchKey(item, piece) {
  return `${item.optionId || 'generic'}|${piece.geometry.uuid}|${piece.materialKey}`;
}

function createBatchMap(items, catalog, mode) {
  const specs = new Map();
  for (const item of items) {
    const variant = catalog.variants[item.variantIndex];
    for (const piece of variant.pieces) {
      const key = createBatchKey(item, piece);
      if (!specs.has(key)) {
        const baseMaterials = piece.materialIndices.map(index => catalog.materials[index]);
        const instancedMaterial = baseMaterials.length === 1
          ? createInstancedMaterial(baseMaterials[0], item.optionId)
          : baseMaterials.map(material => createInstancedMaterial(material, item.optionId));

        specs.set(key, {
          key,
          geometry: piece.geometry,
          material: instancedMaterial,
          count: 0,
          mode,
          optionId: item.optionId || null,
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
    instancedMesh.castShadow = false;
    instancedMesh.receiveShadow = false;
    instancedMesh.frustumCulled = false;
    scene.add(instancedMesh);
    targetMap.set(spec.key, { mesh: instancedMesh, cursor: 0, optionId: spec.optionId });
  }
}

function registerHandles(items, catalog, batchMap, targetHandles) {
  for (const item of items) {
    const variant = catalog.variants[item.variantIndex];
    const handles = [];

    for (const piece of variant.pieces) {
      const key = createBatchKey(item, piece);
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

function finalizeBatchMatrices(batchMap, recomputeBounds = false) {
  for (const batch of batchMap.values()) {
    batch.mesh.instanceMatrix.needsUpdate = true;
    if (recomputeBounds && batch.mesh.computeBoundingSphere) batch.mesh.computeBoundingSphere();
  }
}

function updateBatchAppearance(batchMap, phase, selectedOptionId) {
  for (const batch of batchMap.values()) {
    const materials = Array.isArray(batch.mesh.material) ? batch.mesh.material : [batch.mesh.material];

    for (const material of materials) {
      material.opacity = 1;
      material.needsUpdate = true;
    }
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
    writeHandles(activeHandles[index], item.position, item.restQuaternion, item.renderScale ?? item.scale, true);
  });

  staticItems.forEach((item, index) => {
    writeHandles(staticHandles[index], item.position, item.quaternion, item.renderScale ?? item.scale, true);
  });

  finalizeBatchMatrices(dynamicBatches, true);
  finalizeBatchMatrices(staticBatches, true);
}

export function setProductRenderState(phase, selectedOptionId = null) {
  activePhase = phase;
  activeSelection = selectedOptionId;
  updateBatchAppearance(dynamicBatches, phase, selectedOptionId);
  updateBatchAppearance(staticBatches, phase, selectedOptionId);
}

export function syncActiveProductTransforms(activeItems, bodies, visibleCount) {
  for (let i = 0; i < activeItems.length; i++) {
    const handles = activeHandles[i];
    if (!handles) continue;

    const body = bodies[i]?.body;
    if (!body) continue;

    tmpPos.set(body.position.x, body.position.y, body.position.z);
    tmpQuat.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    const isVisible = i < visibleCount;
    writeHandles(handles, tmpPos, tmpQuat, activeItems[i].renderScale ?? activeItems[i].scale, isVisible);
  }

  finalizeBatchMatrices(dynamicBatches, false);
}
