// ═══════════════════════════════════════════════════════════
//  main.js — Entry point: orchestrates initialization
//  and connects all modules together
// ═══════════════════════════════════════════════════════════

import { DEFAULT_SELECTION_COLOR, PHASE, PRODUCT_ASSET_PATH } from './config.js';
import { generateCubeData, generateShelfPositions, generateStaticShelfItems, cubeRand, staticShelfItems } from './cubeData.js';
import { initThree, createShelfVisuals, onResize }  from './scene.js';
import { initPhysics, createCubes }           from './physics.js';
import { initWebcam, initPose, stopWebcam }   from './mediapipe.js';
import { initUIAnimations, animateBrandHeader } from './uiAnimations.js';
import { setPhase, forcePhase }               from './uiPhases.js';
import { animate, phaseStateMachine }         from './animationLoop.js';
import { loadProductCatalog }                 from './productCatalog.js';
import { createProductRenderers }             from './productRenderer.js';

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

  // Bind buttons
  controls.querySelectorAll('.dev-btn[data-phase]').forEach(btn => {
    btn.addEventListener('click', () => {
      const phase = parseInt(btn.dataset.phase);
      phaseStateMachine.forcePhase(phase, phase === PHASE.HARMONY ? DEFAULT_SELECTION_COLOR : null);
      forcePhase(phase, { selectedBrand: phase === PHASE.HARMONY ? DEFAULT_SELECTION_COLOR : null });
    });
  });
}

// ─── Brand logo click handlers ──────────────────────────────
function setupBrandClicks() {
  document.querySelectorAll('.brand-logo').forEach(logo => {
    logo.addEventListener('click', (e) => {
      const brand = e.currentTarget.dataset.brand;
      phaseStateMachine.forcePhase(PHASE.HARMONY, brand);
      forcePhase(PHASE.HARMONY, { selectedBrand: brand });
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
    setLoadingText('Initializing...');

    // 1. Initialize 3D scene
    initThree();

    // 2. Load product assets and generate product populations
    setLoadingText('Loading product library...');
    const catalog = await loadProductCatalog(PRODUCT_ASSET_PATH);

    generateCubeData(catalog);
    generateShelfPositions();
    generateStaticShelfItems(catalog);

    // 3. Initialize 3D proxies + shelves + instanced renderers
    initPhysics();
    createShelfVisuals();
    createCubes();
    createProductRenderers(catalog, cubeRand, staticShelfItems);

    // 4. Initialize UI
    initUIAnimations();
    setupDebugControls();
    setupBrandClicks();
    setupWindowEvents();

    // 5. Go immediately — camera/pose boot in background
    hideLoading();
    animateBrandHeader();
    setPhase(PHASE.IDLE);
    animate();

    // 6. Initialize MediaPipe in background so the scene never blocks on loading
    (async () => {
      try {
        setLoadingText('Starting camera...');
        await initWebcam();

        setLoadingText('Loading pose model...');
        await initPose();
      } catch (err) {
        console.error('MediaPipe init error:', err);
      }
    })();
  } catch (err) {
    console.error('App init error:', err);
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
