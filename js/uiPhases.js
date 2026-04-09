// ═══════════════════════════════════════════════════════════
//  uiPhases.js — Phase-driven UI orchestration for the
//  branded AMC mirror experience
// ═══════════════════════════════════════════════════════════

import { subscribeAppState } from './appState.js';
import { CHAOS_AUTO_GESTURE_MS, HARMONY_COPY_DELAY_MS, PHASE } from './config.js';
import {
  animateBrandsFlyIn,
  animateHarmony,
  clearSignatureOverlay,
  hideBrands,
  playSceneTransition,
  startFloatingAnimation,
  startRingPulse,
  startTechGlow,
  updateSelectedOptionDebug,
} from './uiAnimations.js';

/* global gsap */

const OVERLAY_DIM = 0;
const OVERLAY_CLEAR = 0;
const OVERLAY_IDLE = 0;
const TEXT_BLUR = 0;

const TEXT_BLACKOUT_MS = Math.max(CHAOS_AUTO_GESTURE_MS - 600, 1800);
const OVERLAY_FADE_DUR = 0.5;
const TEXT_IN_DUR = 0.7;
const TEXT_OUT_DUR = 0.45;

let activePhase = -1;
let activeSelectedOptionId = null;
let activeErrorMessage = null;
let firstChaosTriggered = false;
let blackoutTimer = null;
let harmonyTextTimer = null;
let phaseDebounceTimer = null;
let textVisible = false;
let heroTimeline = null;
let stopAppStateSync = null;

const PHASE_DEBOUNCE_MS = 500;  // delay before committing a non-critical phase change

const _overlay = () => document.getElementById('mock-3d-canvas');
const _blurOverlay = () => document.getElementById('data-transition-overlay');
const _headline = () => document.getElementById('main-headline');
const _subHeadline = () => document.getElementById('sub-headline');
const _rule = () => document.querySelector('.headline-rule');

export function getActivePhase() {
  return activePhase;
}

export function initUIPhaseSync() {
  if (stopAppStateSync) return stopAppStateSync;

  stopAppStateSync = subscribeAppState((state) => {
    setPhase(state.phase, {
      selectedOptionId: state.selectedOptionId,
      activeOptionId: state.activeOptionId,
      errorMessage: state.errorMessage,
    });
  }, { immediate: true });

  return stopAppStateSync;
}

function killHeroTimeline() {
  if (heroTimeline) {
    heroTimeline.kill();
    heroTimeline = null;
  }
  gsap.killTweensOf([_overlay(), _blurOverlay(), _headline(), _rule(), _subHeadline()].filter(Boolean));
}

function clearAllTimers() {
  if (blackoutTimer) { clearTimeout(blackoutTimer); blackoutTimer = null; }
  if (harmonyTextTimer) { clearTimeout(harmonyTextTimer); harmonyTextTimer = null; }
  if (phaseDebounceTimer) { clearTimeout(phaseDebounceTimer); phaseDebounceTimer = null; }
}

function hideText(dur = 1.0) {
  const targets = [_headline(), _subHeadline(), _rule()].filter(Boolean);
  killHeroTimeline();

  heroTimeline = gsap.timeline({ onComplete: () => { heroTimeline = null; } });
  heroTimeline
    .to(targets, {
      autoAlpha: 0,
      y: -24,
      scale: 0.97,
      duration: Math.min(dur, TEXT_OUT_DUR),
      stagger: 0.05,
      ease: 'power2.inOut',
    }, 0)
    .to(_overlay(), {
      opacity: OVERLAY_CLEAR,
      duration: dur,
      ease: 'power2.inOut',
    }, 0)
    .to(_blurOverlay(), {
      autoAlpha: 0,
      backgroundColor: 'rgba(0, 164, 228, 0.045)',
      backdropFilter: 'blur(0px)',
      webkitBackdropFilter: 'blur(0px)',
      duration: dur,
      ease: 'power2.inOut',
    }, 0);

  textVisible = false;
}

function showTextWithOverlay(headlineHTML, subHTML) {
  const headline = _headline();
  const subHeadline = _subHeadline();
  const rule = _rule();
  const overlay = _overlay();
  const blurOverlay = _blurOverlay();
  if (!headline || !subHeadline || !rule || !overlay || !blurOverlay) return;

  killHeroTimeline();

  heroTimeline = gsap.timeline({ onComplete: () => { heroTimeline = null; } });
  heroTimeline
    .to(overlay, {
      opacity: activePhase === PHASE.IDLE ? OVERLAY_IDLE : OVERLAY_DIM,
      duration: OVERLAY_FADE_DUR,
      ease: 'power2.out',
    }, 0)
    .to(blurOverlay, {
      autoAlpha: 1,
      backgroundColor: 'rgba(0, 18, 38, 0.08)',
      backdropFilter: 'blur(0px)',
      webkitBackdropFilter: 'blur(0px)',
      duration: OVERLAY_FADE_DUR,
      ease: 'power2.out',
    }, 0)
    .to([headline, rule, subHeadline], {
      autoAlpha: 0,
      y: -12,
      duration: textVisible ? TEXT_OUT_DUR : 0.01,
      stagger: 0.04,
      ease: 'power2.inOut',
    }, 0)
    .call(() => {
      headline.innerHTML = headlineHTML;
      subHeadline.innerHTML = subHTML;
      gsap.set(headline, { y: 14 });
      gsap.set(rule, { y: 8, autoAlpha: 0 });
      gsap.set(subHeadline, { y: 14 });
    })
    .to(headline, {
      autoAlpha: 1,
      y: 0,
      duration: TEXT_IN_DUR,
      ease: 'power2.out',
    }, textVisible ? 0.3 : 0.1)
    .to(rule, {
      autoAlpha: 0.45,
      y: 0,
      duration: 0.5,
      ease: 'power2.out',
    }, textVisible ? 0.35 : 0.15)
    .to(subHeadline, {
      autoAlpha: 1,
      y: 0,
      duration: TEXT_IN_DUR,
      ease: 'power2.out',
    }, textVisible ? 0.38 : 0.18);

  textVisible = true;
}

function setBackground(className) {
  const bgCanvas = _overlay();
  if (!bgCanvas) return;
  bgCanvas.className = className;
  bgCanvas.style.opacity = '0';
  bgCanvas.style.background = 'transparent';
}

function triggerBoot() {
  hideBrands();
  clearSignatureOverlay();
  setBackground('bg-boot');
  showTextWithOverlay(
    'PREPARING THE <span class="text-accent">MIRROR.</span>',
    'Loading camera, pose tracking, and branded product assets.'
  );
}

function triggerIdle() {
  clearAllTimers();
  firstChaosTriggered = false;
  hideBrands();
  clearSignatureOverlay();

  playSceneTransition(() => {
    setBackground('bg-idle');
  }, () => {
    showTextWithOverlay(
      'THE POWER OF <span class="text-accent">ATTRACTION.</span>',
      'Step in to see how AMC\'s data magnetizes your ideal buyer.'
    );
  });
}

function triggerChaos(previousPhase) {
  hideBrands();
  clearSignatureOverlay();

  if (previousPhase === PHASE.GESTURE) {
    setBackground('bg-chaos');
    showTextWithOverlay(
      'WITHOUT <span class="text-accent">DATA</span>',
      'BRANDS STRUGGLE.'
    );
    return;
  }

  playSceneTransition(() => {
    setBackground('bg-chaos');
  }, () => {
    showTextWithOverlay(
      'WITHOUT <span class="text-accent">DATA</span>',
      'BRANDS STRUGGLE.'
    );
  });
}

function triggerGesture(previousPhase) {
  if (blackoutTimer) { clearTimeout(blackoutTimer); blackoutTimer = null; }

  // If coming from CHAOS, just show brands and update text — no flash transition
  if (previousPhase === PHASE.CHAOS || previousPhase === PHASE.POSE_LOST) {
    setBackground('bg-chaos');
    animateBrandsFlyIn();
    startFloatingAnimation();
    startRingPulse();
    startTechGlow();
    showTextWithOverlay(
      'HARNESS THE <span class="text-accent">DATA.</span>',
      'Raise your hand. Select a brand and redirect its attraction to your ideal buyer.'
    );
    return;
  }

  playSceneTransition(() => {
    setBackground('bg-chaos');
    animateBrandsFlyIn();
    startFloatingAnimation();
    startRingPulse();
    startTechGlow();
  }, () => {
    showTextWithOverlay(
      'HARNESS THE <span class="text-accent">DATA.</span>',
      'Raise your hand. Select a brand and redirect its attraction to your ideal buyer.'
    );
  });
}

function triggerHarmony(selectedOptionId) {
  setBackground('bg-harmony');
  animateHarmony(selectedOptionId);
  hideText(0.8);

  harmonyTextTimer = setTimeout(() => {
    if (activePhase === PHASE.HARMONY) {
      showTextWithOverlay(
        'FROM CHAOS TO <span class="text-accent">PRECISION.</span>',
        'AMC connects your brand to the right purchase intent—and proves it with closed-loop measurement.'
      );

    }
    harmonyTextTimer = null;
  }, HARMONY_COPY_DELAY_MS);
}

function triggerPoseLost() {
  // POSE_LOST removed — state machine goes straight to IDLE
  triggerIdle();
}

function triggerError(errorMessage) {
  hideBrands();
  clearSignatureOverlay();
  setBackground('bg-error');
  showTextWithOverlay(
    'SYSTEM <span class="text-accent">ERROR.</span>',
    errorMessage || 'A critical startup error occurred. Check camera permissions and assets.'
  );
}

export function setPhase(phase, opts = {}) {
  const { selectedOptionId = null, activeOptionId = null, errorMessage = null } = opts;
  const displayOptionId = selectedOptionId || activeOptionId || null;

  if (phase === activePhase && displayOptionId === activeSelectedOptionId && errorMessage === activeErrorMessage) return;

  // Immediate phases: HARMONY (user action), ERROR, BOOT — no debounce
  const isImmediate = phase === PHASE.HARMONY || phase === PHASE.ERROR || phase === PHASE.BOOT;

  // Skip POSE_LOST entirely if we're in CHAOS/GESTURE and it would just flicker
  // Also debounce CHAOS↔GESTURE and POSE_LOST transitions
  if (!isImmediate) {
    // If already debouncing and new phase arrives, cancel the pending one
    if (phaseDebounceTimer) { clearTimeout(phaseDebounceTimer); phaseDebounceTimer = null; }

    // For POSE_LOST, use a longer debounce to avoid flicker
    const delay = phase === PHASE.POSE_LOST ? 800 : PHASE_DEBOUNCE_MS;

    phaseDebounceTimer = setTimeout(() => {
      phaseDebounceTimer = null;
      commitPhase(phase, displayOptionId, errorMessage);
    }, delay);
    return;
  }

  // Cancel any pending debounce for immediate phases
  if (phaseDebounceTimer) { clearTimeout(phaseDebounceTimer); phaseDebounceTimer = null; }
  commitPhase(phase, displayOptionId, errorMessage);
}

function commitPhase(phase, displayOptionId, errorMessage) {
  if (phase === activePhase && displayOptionId === activeSelectedOptionId && errorMessage === activeErrorMessage) return;

  clearAllTimers();
  killHeroTimeline();
  const previousPhase = activePhase;
  activePhase = phase;
  activeSelectedOptionId = displayOptionId;
  activeErrorMessage = errorMessage;

  updateSelectedOptionDebug(displayOptionId);

  document.querySelectorAll('.dev-btn[data-phase]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.phase, 10) === phase);
  });

  switch (phase) {
    case PHASE.BOOT:
      triggerBoot();
      break;
    case PHASE.IDLE:
      triggerIdle();
      break;
    case PHASE.CHAOS:
      triggerChaos(previousPhase);
      break;
    case PHASE.GESTURE:
      triggerGesture(previousPhase);
      break;
    case PHASE.HARMONY:
      triggerHarmony(displayOptionId || 'coca-cola');
      break;
    case PHASE.POSE_LOST:
      triggerPoseLost();
      break;
    case PHASE.ERROR:
      triggerError(errorMessage);
      break;
  }
}

export function forcePhase(phase, opts = {}) {
  activePhase = -1;
  setPhase(phase, opts);
}
