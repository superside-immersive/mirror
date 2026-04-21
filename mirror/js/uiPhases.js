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
const OVERLAY_FADE_DUR = 0.72;
const TEXT_IN_DUR = 1.02;
const TEXT_OUT_DUR = 0.72;
const IDLE_COVER_RETURN_MS = 15000;
const GESTURE_INTRO_MS = 5000;

let activePhase = -1;
let activeSelectedOptionId = null;
let activeErrorMessage = null;
let firstChaosTriggered = false;
let blackoutTimer = null;
let harmonyTextTimer = null;
let phaseDebounceTimer = null;
let idleCoverTimer = null;
let idleCoverVisible = true;
let hasSeenTrackedPerson = false;
let gestureIntroActive = false;
let gestureIntroEndsAt = 0;
let textVisible = false;
let heroTimeline = null;
let stopAppStateSync = null;

const PHASE_DEBOUNCE_MS = 500;  // delay before committing a non-critical phase change

const _overlay = () => document.getElementById('mock-3d-canvas');
const _blurOverlay = () => document.getElementById('data-transition-overlay');
const _headline = () => document.getElementById('main-headline');
const _subHeadline = () => document.getElementById('sub-headline');
const _rule = () => document.querySelector('.headline-rule');
const _idleCover = () => document.getElementById('idle-attract-cover');

const HARMONY_COPY_BY_OPTION = {
  'kraft-heinz': 'RECIPES<br>THAT<br><span class="text-accent">CONVERT</span>',
  mondelez: 'PROVE<br>IN-STORE<br><span class="text-accent">IMPACT</span>',
  'coca-cola': 'TURN ATTRACTION<br>INTO<br><span class="text-accent">ACTION</span>',
};

export function getActivePhase() {
  return activePhase;
}

function cancelIdleCoverTimer() {
  if (idleCoverTimer) {
    clearTimeout(idleCoverTimer);
    idleCoverTimer = null;
  }
}

function setIdleCoverVisible(visible) {
  const cover = _idleCover();
  if (!cover || idleCoverVisible === visible) return;

  idleCoverVisible = visible;
  cover.classList.toggle('visible', visible);
  cover.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

export function syncIdleCover(poseDetected) {
  const cover = _idleCover();
  if (!cover) return;

  if (poseDetected) {
    hasSeenTrackedPerson = true;
    cancelIdleCoverTimer();
    setIdleCoverVisible(false);
    return;
  }

  if (!hasSeenTrackedPerson) {
    cancelIdleCoverTimer();
    setIdleCoverVisible(true);
    return;
  }

  if (idleCoverVisible || idleCoverTimer) return;

  idleCoverTimer = setTimeout(() => {
    idleCoverTimer = null;
    if (hasSeenTrackedPerson) {
      setIdleCoverVisible(true);
    }
  }, IDLE_COVER_RETURN_MS);
}

function getPhaseName(phase) {
  switch (phase) {
    case PHASE.BOOT:
      return 'boot';
    case PHASE.IDLE:
      return 'idle';
    case PHASE.CHAOS:
      return 'chaos';
    case PHASE.GESTURE:
      return 'gesture';
    case PHASE.HARMONY:
      return 'harmony';
    case PHASE.POSE_LOST:
      return 'pose-lost';
    case PHASE.ERROR:
      return 'error';
    default:
      return 'unknown';
  }
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
  gestureIntroActive = false;
  gestureIntroEndsAt = 0;
}

function hideText(dur = 1.0) {
  const targets = [_headline(), _subHeadline(), _rule()].filter(Boolean);
  killHeroTimeline();

  heroTimeline = gsap.timeline({ onComplete: () => { heroTimeline = null; } });
  heroTimeline
    .to(targets, {
      autoAlpha: 0,
      y: -16,
      scale: 0.985,
      duration: Math.min(dur, TEXT_OUT_DUR),
      stagger: 0.08,
      ease: 'power3.inOut',
    }, 0)
    .to(_overlay(), {
      opacity: OVERLAY_CLEAR,
      duration: dur,
      ease: 'sine.inOut',
    }, 0)
    .to(_blurOverlay(), {
      autoAlpha: 0,
      backgroundColor: 'rgba(0, 164, 228, 0.045)',
      duration: dur,
      ease: 'sine.inOut',
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

  const textOutDuration = textVisible ? TEXT_OUT_DUR : 0.12;
  const headlineInStart = textOutDuration + (textVisible ? 0.24 : 0.12);
  const ruleInStart = textOutDuration + (textVisible ? 0.32 : 0.18);
  const subHeadlineInStart = textOutDuration + (textVisible ? 0.4 : 0.22);

  killHeroTimeline();

  heroTimeline = gsap.timeline({ onComplete: () => { heroTimeline = null; } });
  heroTimeline
    .to(overlay, {
      opacity: activePhase === PHASE.IDLE ? OVERLAY_IDLE : OVERLAY_DIM,
      duration: OVERLAY_FADE_DUR,
      ease: 'sine.out',
    }, 0)
    .to(blurOverlay, {
      autoAlpha: 1,
      backgroundColor: 'rgba(0, 18, 38, 0.08)',
      duration: OVERLAY_FADE_DUR,
      ease: 'sine.out',
    }, 0)
    .to([headline, rule, subHeadline], {
      autoAlpha: 0,
      y: -10,
      duration: textOutDuration,
      stagger: 0.06,
      ease: 'power3.inOut',
    }, 0)
    .call(() => {
      headline.innerHTML = headlineHTML;
      subHeadline.innerHTML = subHTML;
      gsap.set(headline, { y: 18, autoAlpha: 0, scale: 0.988 });
      gsap.set(rule, { y: 12, autoAlpha: 0, scaleX: 0.82, transformOrigin: '50% 50%' });
      gsap.set(subHeadline, { y: 18, autoAlpha: 0 });
    }, null, textOutDuration)
    .to(headline, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: TEXT_IN_DUR,
      ease: 'power3.out',
    }, headlineInStart)
    .to(rule, {
      autoAlpha: 0.45,
      y: 0,
      scaleX: 1,
      duration: 0.72,
      ease: 'power3.out',
    }, ruleInStart)
    .to(subHeadline, {
      autoAlpha: 1,
      y: 0,
      duration: TEXT_IN_DUR,
      ease: 'power3.out',
    }, subHeadlineInStart);

  textVisible = true;
}

function showGestureCta() {
  showTextWithOverlay(
    'HARNESS THE <span class="text-accent">DATA.</span>',
    'Raise your hand.<br>Select a brand.'
  );
}

function showGestureIntroCopy() {
  showTextWithOverlay(
    'WITHOUT <span class="text-accent">DATA,</span>',
    'Brands struggle to attract the right attention.'
  );
}

function revealGestureSelector() {
  animateBrandsFlyIn();
  startFloatingAnimation();
  startRingPulse();
  startTechGlow();
  showGestureCta();
}

function showHarmonyCopy(selectedOptionId) {
  const headlineHTML = HARMONY_COPY_BY_OPTION[selectedOptionId] || HARMONY_COPY_BY_OPTION['coca-cola'];
  showTextWithOverlay(headlineHTML, '');
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

  setBackground('bg-chaos');
  hideBrands();
  showGestureIntroCopy();
  gestureIntroActive = true;
  gestureIntroEndsAt = performance.now() + GESTURE_INTRO_MS;
}

export function syncGestureIntro(nowMs = performance.now()) {
  if (!gestureIntroActive || activePhase !== PHASE.GESTURE) return;
  if (nowMs < gestureIntroEndsAt) return;

  gestureIntroActive = false;
  gestureIntroEndsAt = 0;
  revealGestureSelector();
}

function triggerHarmony(selectedOptionId) {
  if (harmonyTextTimer) { clearTimeout(harmonyTextTimer); harmonyTextTimer = null; }
  setBackground('bg-harmony');
  animateHarmony(selectedOptionId);
  hideText(0.3);
  harmonyTextTimer = setTimeout(() => {
    harmonyTextTimer = null;
    if (activePhase !== PHASE.HARMONY || activeSelectedOptionId !== selectedOptionId) return;
    showHarmonyCopy(selectedOptionId);
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
  document.body.dataset.uiPhase = getPhaseName(phase);

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
