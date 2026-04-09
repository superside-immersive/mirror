// ═══════════════════════════════════════════════════════════
//  uiPhases.js — Phase-driven UI orchestration for the
//  branded AMC mirror experience
// ═══════════════════════════════════════════════════════════

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
const OVERLAY_FADE_DUR = 0.35;
const TEXT_IN_DUR = 0.55;
const TEXT_OUT_DUR = 0.28;

let activePhase = -1;
let activeSelectedOptionId = null;
let activeErrorMessage = null;
let firstChaosTriggered = false;
let blackoutTimer = null;
let harmonyTextTimer = null;
let textVisible = false;
let heroTimeline = null;

const _overlay = () => document.getElementById('mock-3d-canvas');
const _blurOverlay = () => document.getElementById('data-transition-overlay');
const _headline = () => document.getElementById('main-headline');
const _subHeadline = () => document.getElementById('sub-headline');
const _rule = () => document.querySelector('.headline-rule');
const _photoCTA = () => document.getElementById('photo-cta');

export function getActivePhase() {
  return activePhase;
}

function killHeroTimeline() {
  if (heroTimeline) {
    heroTimeline.kill();
    heroTimeline = null;
  }
  gsap.killTweensOf([_overlay(), _blurOverlay(), _headline(), _rule(), _subHeadline(), _photoCTA()].filter(Boolean));
}

function clearAllTimers() {
  if (blackoutTimer) { clearTimeout(blackoutTimer); blackoutTimer = null; }
  if (harmonyTextTimer) { clearTimeout(harmonyTextTimer); harmonyTextTimer = null; }
}

function hidePhotoCTA() {
  const photoCTA = _photoCTA();
  if (!photoCTA) return;
  gsap.to(photoCTA, {
    autoAlpha: 0,
    y: 12,
    duration: 0.24,
    ease: 'power2.inOut',
  });
}

function showPhotoCTA() {
  const photoCTA = _photoCTA();
  if (!photoCTA) return;
  gsap.fromTo(photoCTA,
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }
  );
}

function hideText(dur = 1.0) {
  const targets = [_headline(), _subHeadline(), _rule()].filter(Boolean);
  killHeroTimeline();
  hidePhotoCTA();

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
      y: -18,
      scale: 0.98,
      duration: textVisible ? TEXT_OUT_DUR : 0.01,
      stagger: 0.03,
      ease: 'power2.inOut',
    }, 0)
    .call(() => {
      headline.innerHTML = headlineHTML;
      subHeadline.innerHTML = subHTML;
      gsap.set(headline, { y: 18, scale: 0.98 });
      gsap.set(rule, { y: 12, autoAlpha: 0 });
      gsap.set(subHeadline, { y: 18, scale: 1 });
    })
    .to(headline, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: TEXT_IN_DUR,
      ease: 'power3.out',
    }, textVisible ? 0.18 : 0.08)
    .to(rule, {
      autoAlpha: 0.45,
      y: 0,
      duration: 0.4,
      ease: 'power2.out',
    }, textVisible ? 0.22 : 0.12)
    .to(subHeadline, {
      autoAlpha: 1,
      y: 0,
      duration: TEXT_IN_DUR,
      ease: 'expo.out',
    }, textVisible ? 0.24 : 0.14);

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
  hidePhotoCTA();
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
  hidePhotoCTA();
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

function triggerChaos() {
  hideBrands();
  hidePhotoCTA();
  clearSignatureOverlay();

  playSceneTransition(() => {
    setBackground('bg-chaos');
  }, () => {
    if (!firstChaosTriggered) {
      firstChaosTriggered = true;
      hideText(1.2);
      blackoutTimer = setTimeout(() => {
        if (activePhase === PHASE.CHAOS) {
          showTextWithOverlay(
            'THE AISLE IS <span class="text-accent">NOISY.</span>',
            'Without data, brands struggle to attract the right attention.'
          );
        }
        blackoutTimer = null;
      }, TEXT_BLACKOUT_MS);
    } else {
      showTextWithOverlay(
        'THE AISLE IS <span class="text-accent">NOISY.</span>',
        'Without data, brands struggle to attract the right attention.'
      );
    }
  });
}

function triggerGesture() {
  if (blackoutTimer) { clearTimeout(blackoutTimer); blackoutTimer = null; }
  hidePhotoCTA();

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
      showPhotoCTA();
    }
    harmonyTextTimer = null;
  }, HARMONY_COPY_DELAY_MS);
}

function triggerPoseLost() {
  hideBrands();
  hidePhotoCTA();
  clearSignatureOverlay();

  playSceneTransition(() => {
    setBackground('bg-pose-lost');
  }, () => {
    showTextWithOverlay(
      'RETURNING TO <span class="text-accent">SHELF.</span>',
      'Step back in when you are ready to form your next match.'
    );
  });
}

function triggerError(errorMessage) {
  hideBrands();
  hidePhotoCTA();
  clearSignatureOverlay();
  setBackground('bg-error');
  showTextWithOverlay(
    'SYSTEM <span class="text-accent">ERROR.</span>',
    errorMessage || 'A critical startup error occurred. Check camera permissions and assets.'
  );
}

export function setPhase(phase, opts = {}) {
  const { selectedOptionId = null, errorMessage = null } = opts;
  if (phase === activePhase && selectedOptionId === activeSelectedOptionId && errorMessage === activeErrorMessage) return;

  clearAllTimers();
  killHeroTimeline();
  activePhase = phase;
  activeSelectedOptionId = selectedOptionId;
  activeErrorMessage = errorMessage;

  updateSelectedOptionDebug(selectedOptionId);

  const indicator = document.getElementById('phase-indicator');
  const names = {
    [PHASE.BOOT]: 'Boot',
    [PHASE.IDLE]: 'Idle',
    [PHASE.CHAOS]: 'Chaos',
    [PHASE.GESTURE]: 'Gesture',
    [PHASE.HARMONY]: 'Harmony',
    [PHASE.POSE_LOST]: 'Pose Lost',
    [PHASE.ERROR]: 'Error',
  };
  if (indicator) indicator.textContent = `Phase ${phase}: ${names[phase] || ''}`;

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
      triggerChaos();
      break;
    case PHASE.GESTURE:
      triggerGesture();
      break;
    case PHASE.HARMONY:
      triggerHarmony(selectedOptionId || 'coca-cola');
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
