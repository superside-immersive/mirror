// ═══════════════════════════════════════════════════════════
//  productCatalog.js — Loads branded hero GLBs (or a shared
//  catalog) and normalizes their native geometry/materials
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js';

const loader = new GLTFLoader();
const catalogCache = new Map();

function inferCategory(name) {
  const normalized = (name || '').toLowerCase();
  if (normalized.includes('bottle') || normalized.includes('water') || normalized.includes('coke')) return 'bottle';
  if (normalized.includes('milk') || normalized.includes('tea') || normalized.includes('toothpaste') || normalized.includes('box')) return 'box';
  if (normalized.includes('cream') || normalized.includes('nivea') || normalized.includes('jar')) return 'care';
  if (normalized.includes('can') || normalized.includes('tin')) return 'can';
  if (normalized.includes('toilet')) return 'household';
  return 'box';
}

function sanitizeName(name, index) {
  return (name || `Product ${index + 1}`).replace(/[_-]+/g, ' ').trim();
}

function countMeshes(root) {
  let count = 0;
  root.traverse(child => {
    if (child.isMesh && child.geometry) count++;
  });
  return count;
}

function createRelativeMatrix(child) {
  child.updateWorldMatrix(true, false);
  return child.matrixWorld.clone();
}

function inferUprightCorrection(/* size */) {
  // GLB objects are now pre-oriented with bases at Y=0; no automatic rotation needed
  return new THREE.Matrix4().identity();
}

function transformBounds(box, matrix) {
  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ];

  const transformed = corners.map(corner => corner.applyMatrix4(matrix));
  return new THREE.Box3().setFromPoints(transformed);
}

function bakePieceGeometry(geometry, matrix) {
  const bakedGeometry = geometry.clone();
  bakedGeometry.applyMatrix4(matrix);
  bakedGeometry.computeBoundingBox();
  bakedGeometry.computeBoundingSphere();
  return bakedGeometry;
}

function appendMergedSingleMaterialPieces(groups, pieces) {
  for (const group of groups.values()) {
    if (group.geometries.length === 1) {
      pieces.push({
        geometry: group.geometries[0],
        materialIndices: group.materialIndices,
        materialKey: group.materialKey,
        localMatrix: null,
      });
      continue;
    }

    const mergedGeometry = mergeGeometries(group.geometries, false);
    if (mergedGeometry) {
      mergedGeometry.computeBoundingBox();
      mergedGeometry.computeBoundingSphere();
      pieces.push({
        geometry: mergedGeometry,
        materialIndices: group.materialIndices,
        materialKey: group.materialKey,
        localMatrix: null,
      });
      continue;
    }

    for (const geometry of group.geometries) {
      pieces.push({
        geometry,
        materialIndices: group.materialIndices,
        materialKey: group.materialKey,
        localMatrix: null,
      });
    }
  }
}

export async function loadProductCatalog(assetPath) {
  const cacheKey = Array.isArray(assetPath)
    ? `options:${assetPath.map(option => `${option.id}:${option.heroProductAssetPath}`).join('|')}`
    : `catalog:${assetPath}`;
  if (catalogCache.has(cacheKey)) return catalogCache.get(cacheKey);

  const materialCache = new Map();
  const materials = [];
  const variants = [];

  const registerMaterial = (sourceMaterial) => {
    const key = sourceMaterial.uuid;
    if (!materialCache.has(key)) {
      const material = sourceMaterial.clone();
      materialCache.set(key, materials.length);
      materials.push(material);
    }
    return materialCache.get(key);
  };

  const appendVariant = (variantRoot, variantIndex, meta = {}) => {
    variantRoot.updateWorldMatrix(true, true);

    const bounds = new THREE.Box3().setFromObject(variantRoot);
    const size = bounds.getSize(new THREE.Vector3());

    if (size.lengthSq() === 0 || size.y <= 1e-5) return;

    const uprightCorrection = inferUprightCorrection(size);
    const correctedBounds = transformBounds(bounds, uprightCorrection);
    const correctedSize = correctedBounds.getSize(new THREE.Vector3());
    const correctedCenter = correctedBounds.getCenter(new THREE.Vector3());
    const normalizeScale = 1 / correctedSize.y;
    const normalizeMatrix = new THREE.Matrix4()
      .makeScale(normalizeScale, normalizeScale, normalizeScale)
      .multiply(new THREE.Matrix4().makeTranslation(-correctedCenter.x, -correctedCenter.y, -correctedCenter.z));

    const pieces = [];
    const singleMaterialGroups = new Map();
    variantRoot.traverse(child => {
      if (!child.isMesh || !child.geometry) return;

      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
      const materialIndices = sourceMaterials.map(registerMaterial);
      const relativeMatrix = createRelativeMatrix(child);
      const pieceMatrix = normalizeMatrix.clone().multiply(uprightCorrection).multiply(relativeMatrix);
      const materialKey = materialIndices.join(',');
      const bakedGeometry = bakePieceGeometry(child.geometry, pieceMatrix);

      if (materialIndices.length === 1) {
        if (!singleMaterialGroups.has(materialKey)) {
          singleMaterialGroups.set(materialKey, {
            materialIndices,
            materialKey,
            geometries: [],
          });
        }

        singleMaterialGroups.get(materialKey).geometries.push(bakedGeometry);
        return;
      }

      pieces.push({
        geometry: bakedGeometry,
        materialIndices,
        materialKey,
        localMatrix: null,
      });
    });

    appendMergedSingleMaterialPieces(singleMaterialGroups, pieces);

    const normalizedSize = correctedSize.clone().multiplyScalar(normalizeScale);

    variants.push({
      id: variantIndex,
      name: meta.name || sanitizeName(variantRoot.name, variantIndex),
      category: meta.category || inferCategory(variantRoot.name),
      optionId: meta.optionId || null,
      signatureStyle: meta.signatureStyle || null,
      normalizedSize,
      pieces,
      sourceNodeName: variantRoot.name || null,
      assetPath: meta.assetPath || null,
    });
  };

  const collectRoots = (root) => {
    const roots = root.children.filter(child => countMeshes(child) > 0);
    if (roots.length > 0) return roots;
    return countMeshes(root) > 0 ? [root] : [];
  };

  if (Array.isArray(assetPath)) {
    for (const option of assetPath) {
      const gltf = await loader.loadAsync(option.heroProductAssetPath);
      const root = gltf.scene;
      root.updateWorldMatrix(true, true);
      const variantRoot = collectRoots(root)[0];
      if (!variantRoot) continue;

      appendVariant(variantRoot, variants.length, {
        name: option.heroLabel,
        category: option.id,
        optionId: option.id,
        signatureStyle: option.signatureStyle,
        assetPath: option.heroProductAssetPath,
      });
    }
  } else {
    const gltf = await loader.loadAsync(assetPath);
    const root = gltf.scene;
    root.updateWorldMatrix(true, true);

    const roots = collectRoots(root);
    roots.forEach((variantRoot, variantIndex) => {
      appendVariant(variantRoot, variantIndex);
    });
  }

  const catalog = {
    categories: [...new Set(variants.map(variant => variant.category))],
    materials,
    variants,
    optionVariantMap: Object.fromEntries(
      variants.filter(variant => variant.optionId).map(variant => [variant.optionId, variant.id]),
    ),
  };

  catalogCache.set(cacheKey, catalog);
  return catalog;
}
