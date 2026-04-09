// ═══════════════════════════════════════════════════════════
//  productOptions.js — Branded hero product definitions and
//  shared selection state for the AMC mirror experience
// ═══════════════════════════════════════════════════════════

import { getAppState, updateAppState } from './appState.js';

export const PRODUCT_OPTIONS = [
  {
    id: 'kraft-heinz',
    label: 'Kraft Heinz',
    heroLabel: 'Heinz Mustard',
    heroProductAssetPath: './assets/glb/mustard.glb',
    logoAssetPath: null,
    signatureStyle: 'stack',
    bodyScaleMultiplier: 1.48,
    colorTheme: {
      accent: '#F2C400',
      glow: 'rgba(242, 196, 0, 0.42)',
      border: 'rgba(242, 196, 0, 0.82)',
      background: 'rgba(94, 70, 0, 0.34)',
    },
  },
  {
    id: 'mondelez',
    label: 'Mondelez',
    heroLabel: 'Oreo Cookie',
    heroProductAssetPath: './assets/glb/oreo_pacman.glb',
    logoAssetPath: './assets/logos/MDLZ_Logo/MDLZ Logo Reversed RGB.png',
    signatureStyle: 'calibration',
    bodyScaleMultiplier: 1,
    colorTheme: {
      accent: '#59C8FF',
      glow: 'rgba(89, 200, 255, 0.42)',
      border: 'rgba(89, 200, 255, 0.88)',
      background: 'rgba(0, 54, 112, 0.34)',
    },
  },
  {
    id: 'coca-cola',
    label: 'Coca-Cola',
    heroLabel: 'Coca-Cola Classic',
    heroProductAssetPath: './assets/glb/cocacola.glb',
    logoAssetPath: './assets/logos/coca-cola-company-white.svg',
    signatureStyle: 'fizz',
    bodyScaleMultiplier: 1.58,
    colorTheme: {
      accent: '#FF5A53',
      glow: 'rgba(255, 90, 83, 0.42)',
      border: 'rgba(255, 90, 83, 0.88)',
      background: 'rgba(120, 18, 14, 0.34)',
    },
  },
];

export const DEFAULT_PRODUCT_OPTION_ID = PRODUCT_OPTIONS[2].id;

const optionMap = new Map(PRODUCT_OPTIONS.map(option => [option.id, option]));

export const productSelectionState = {
  get activeOptionId() {
    return getAppState().activeOptionId || DEFAULT_PRODUCT_OPTION_ID;
  },
  get selectedOptionId() {
    return getAppState().selectedOptionId;
  },
  get currentPhase() {
    return getAppState().phase;
  },
};

export function getDefaultProductOption() {
  return optionMap.get(DEFAULT_PRODUCT_OPTION_ID);
}

export function getProductOptionById(optionId) {
  return optionMap.get(optionId) || getDefaultProductOption();
}

export function getProductOptionForIndex(index) {
  return PRODUCT_OPTIONS[index % PRODUCT_OPTIONS.length];
}

export function setActiveProductOption(optionId) {
  const option = getProductOptionById(optionId);
  updateAppState({ activeOptionId: option.id });
  return option;
}

export function selectProductOption(optionId) {
  const option = getProductOptionById(optionId);
  updateAppState({
    selectedOptionId: option.id,
    activeOptionId: option.id,
  });
  return option;
}

export function clearSelectedProductOption() {
  updateAppState({ selectedOptionId: null });
}
