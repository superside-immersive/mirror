// ═══════════════════════════════════════════════════════════
//  productCatalog.js — Loads PRODUCTOS.glb and builds a
//  reusable catalog of normalized supermarket product variants
// ═══════════════════════════════════════════════════════════

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
let cachedCatalog = null;

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

export async function loadProductCatalog(assetPath) {
  if (cachedCatalog) return cachedCatalog;

  const gltf = await loader.loadAsync(assetPath);
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);

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

  const roots = root.children.filter(child => countMeshes(child) > 0);

  roots.forEach((variantRoot, variantIndex) => {
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
    variantRoot.traverse(child => {
      if (!child.isMesh || !child.geometry) return;

      const sourceMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
      const materialIndex = registerMaterial(sourceMaterial);
      const relativeMatrix = createRelativeMatrix(child);
      const pieceMatrix = normalizeMatrix.clone().multiply(uprightCorrection).multiply(relativeMatrix);

      pieces.push({
        geometry: child.geometry,
        materialIndex,
        localMatrix: pieceMatrix,
      });
    });

    const normalizedSize = correctedSize.clone().multiplyScalar(normalizeScale);

    variants.push({
      id: variantIndex,
      name: sanitizeName(variantRoot.name, variantIndex),
      category: inferCategory(variantRoot.name),
      normalizedSize,
      pieces,
      sourceNodeName: variantRoot.name || null,
    });
  });

  cachedCatalog = {
    categories: [...new Set(variants.map(variant => variant.category))],
    materials,
    variants,
  };

  return cachedCatalog;
}
