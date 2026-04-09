// ═══════════════════════════════════════════════════════════
//  main.js — Entry point: orchestrates initialization
//  and connects all modules together
// ═══════════════════════════════════════════════════════════

import { PHASE } from './config.js';
import { generateCubeData, generateShelfPositions, generateStaticShelfItems, cubeRand, staticShelfItems } from './cubeData.js';
import { initThree, onResize }  from './scene.js';
import { initPhysics, createCubes }           from './physics.js';
import { initWebcam, initPose, stopWebcam }   from './mediapipe.js';
import { initUIAnimations, animateBrandHeader } from './uiAnimations.js';
import { setPhase, forcePhase }               from './uiPhases.js';
import { animate, phaseStateMachine }         from './animationLoop.js';
import { loadProductCatalog }                 from './productCatalog.js';
import { createProductRenderers }             from './productRenderer.js';
import {
  DEFAULT_PRODUCT_OPTION_ID,
  PRODUCT_OPTIONS,
  setActiveProductOption,
  selectProductOption,
} from './productOptions.js';

// ─── Loading helpers ────────────────────────────────────────
function setLoadingText(txt) {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = txt;
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

// ─── Debug controls setup ───────────────────────────────────
function setupDebugControls() {
  const isDebug = new URLSearchParams(window.location.search).has('debug');
  const controls = document.getElementById('dev-controls');
  if (!controls) return;

  if (isDebug) {
    controls.classList.add('visible');
  }

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'd') {
      controls.classList.toggle('visible');
    }
  });

  // Bind buttons
  controls.querySelectorAll('.dev-btn[data-phase]').forEach(btn => {
    btn.addEventListener('click', () => {
      const phase = parseInt(btn.dataset.phase);
      const selectedOptionId = DEFAULT_PRODUCT_OPTION_ID;
      phaseStateMachine.forcePhase(phase, phase === PHASE.HARMONY ? selectedOptionId : null, phase === PHASE.ERROR ? 'Debug error state.' : null);
      forcePhase(phase, {
        selectedOptionId: phase === PHASE.HARMONY ? selectedOptionId : null,
        errorMessage: phase === PHASE.ERROR ? 'Debug error state.' : null,
      });
    });
  });
}

// ─── Brand logo click handlers ──────────────────────────────
function setupBrandClicks() {
  document.querySelectorAll('.brand-logo').forEach(logo => {
    logo.addEventListener('click', (e) => {
      const optionId = e.currentTarget.dataset.option;
      selectProductOption(optionId);
      phaseStateMachine.selectOption(optionId);
      forcePhase(PHASE.HARMONY, { selectedOptionId: optionId });
    });
  });
}

// ─── Window event handlers ──────────────────────────────────
function setupWindowEvents() {
  window.addEventListener('resize', onResize);
  window.addEventListener('beforeunload', stopWebcam);
}

// ─── Main entry point ───────────────────────────────────────
async function main() {
  try {
    setActiveProductOption(DEFAULT_PRODUCT_OPTION_ID);
    setLoadingText('Initializing...');
    initThree();
    initUIAnimations();
    setupDebugControls();
    setupBrandClicks();
    setupWindowEvents();
    forcePhase(PHASE.BOOT);

    // 2. Load product assets and generate product populations
    setLoadingText('Loading product library...');
    const catalog = await loadProductCatalog(PRODUCT_OPTIONS);

    generateCubeData(catalog);
    generateShelfPositions();
    generateStaticShelfItems(catalog);

    // 3. Initialize 3D proxies + instanced renderers
    initPhysics();
    createCubes();
    createProductRenderers(catalog, cubeRand, staticShelfItems);

    // 4. Initialize MediaPipe before releasing BOOT so the machine enters IDLE only when ready
    setLoadingText('Starting camera...');
    await initWebcam();

    setLoadingText('Loading pose model...');
    await initPose();

    hideLoading();
    animateBrandHeader();
    phaseStateMachine.markReady();
    setPhase(PHASE.IDLE, { selectedOptionId: DEFAULT_PRODUCT_OPTION_ID });
    animate();
  } catch (err) {
    console.error('App init error:', err);
    phaseStateMachine.setError(err.message);
    forcePhase(PHASE.ERROR, { errorMessage: err.message, selectedOptionId: DEFAULT_PRODUCT_OPTION_ID });
    setLoadingText(`Init error: ${err.message}`);
    hideLoading();
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
