// ═══════════════════════════════════════════════════════════
//  uiPhases.js — Phase trigger functions & unified phase API
//  Bridges gestureDetector state → visual UI transitions
//
//  Overlay + text are ALWAYS managed together:
//    • showTextWithOverlay() — dims overlay FIRST, then fades in text
//    • hideText()            — fades out text only (overlay untouched)
//    • dimOverlay / clearOverlay / idleOverlay — explicit overlay control
// ═══════════════════════════════════════════════════════════

import { PHASE } from './config.js';
import {
  playSceneTransition,
  animateBrandsFlyIn, startFloatingAnimation,
  startRingPulse, startTechGlow,
  hideBrands, animateHarmony,
} from './uiAnimations.js';

/* global gsap */

// ─── Overlay Opacity Constants ──────────────────────────────
const OVERLAY_DIM   = 0.45;   // dark enough for white text to read
const OVERLAY_CLEAR = 0.10;   // nearly transparent — full 3D scene view
const OVERLAY_IDLE  = 0.35;   // default idle vibe
const TEXT_BLUR     = 10;     // readable backdrop blur behind copy

// ─── Timing Constants ───────────────────────────────────────
const TEXT_BLACKOUT_MS    = 8000;  // hide text this long after first detection
const HARMONY_DELAY_MS   = 4000;  // wait for products to settle before harmony text
const OVERLAY_FADE_DUR   = 0.35;  // seconds for overlay transitions
const TEXT_IN_DUR        = 0.55;
const TEXT_OUT_DUR       = 0.28;

// ─── State ──────────────────────────────────────────────────
let activePhase        = 0;      // current phase (avoid re-triggers)
let firstChaosTriggered = false; // has the IDLE→CHAOS transition happened?
let blackoutTimer      = null;   // timer for text blackout
let harmonyTextTimer   = null;   // timer for delayed harmony text
let textVisible        = false;  // is text currently showing?
let heroTimeline       = null;   // unified text + backdrop timeline

/** Get the current active phase number */
export function getActivePhase() { return activePhase; }

// ─── Overlay Helpers ────────────────────────────────────────
const _overlay = () => document.getElementById('mock-3d-canvas');
const _blurOverlay = () => document.getElementById('data-transition-overlay');

function dimOverlay(dur = OVERLAY_FADE_DUR) {
  const el = _overlay();
  if (el) gsap.to(el, { opacity: OVERLAY_DIM, duration: dur, ease: 'power2.inOut' });
}

function clearOverlay(dur = OVERLAY_FADE_DUR) {
  const el = _overlay();
  if (el) gsap.to(el, { opacity: OVERLAY_CLEAR, duration: dur, ease: 'power2.inOut' });
}

function idleOverlay(dur = OVERLAY_FADE_DUR) {
  const el = _overlay();
  if (el) gsap.to(el, { opacity: OVERLAY_IDLE, duration: dur, ease: 'power2.inOut' });
}

function showBlurOverlay(dur = OVERLAY_FADE_DUR) {
  const el = _blurOverlay();
  if (!el) return;
  gsap.to(el, {
    autoAlpha: 1,
    backgroundColor: 'rgba(0, 18, 38, 0.18)',
    backdropFilter: `blur(${TEXT_BLUR}px)`,
    webkitBackdropFilter: `blur(${TEXT_BLUR}px)`,
    duration: dur,
    ease: 'power2.out',
  });
}

function hideBlurOverlay(dur = OVERLAY_FADE_DUR) {
  const el = _blurOverlay();
  if (!el) return;
  gsap.to(el, {
    autoAlpha: 0,
    backgroundColor: 'rgba(0, 164, 228, 0.045)',
    backdropFilter: 'blur(0px)',
    webkitBackdropFilter: 'blur(0px)',
    duration: dur,
    ease: 'power2.inOut',
  });
}

// ─── Text Helpers ───────────────────────────────────────────
const _headline    = () => document.getElementById('main-headline');
const _subHeadline = () => document.getElementById('sub-headline');
const _rule        = () => document.querySelector('.headline-rule');

function killHeroTimeline() {
  if (heroTimeline) {
    heroTimeline.kill();
    heroTimeline = null;
  }
  const targets = [_overlay(), _blurOverlay(), _headline(), _rule(), _subHeadline()].filter(Boolean);
  gsap.killTweensOf(targets);
}

/**
 * Fade out current text AND clear the overlay.
 * Text and overlay are always coupled: no text → no dim.
 */
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

/**
 * The ONE canonical way to show text.
 * Blur + dim + text are driven by one timeline, so the readable
 * backdrop exists exactly when the copy becomes visible.
 */
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
      backgroundColor: 'rgba(0, 18, 38, 0.18)',
      backdropFilter: `blur(${TEXT_BLUR}px)`,
      webkitBackdropFilter: `blur(${TEXT_BLUR}px)`,
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

// ─── Clear All Timers ───────────────────────────────────────
function clearAllTimers() {
  if (blackoutTimer)     { clearTimeout(blackoutTimer);     blackoutTimer     = null; }
  if (harmonyTextTimer)  { clearTimeout(harmonyTextTimer);  harmonyTextTimer  = null; }
}

// ═══════════════════════════════════════════════════════════
//  Phase Triggers
// ═══════════════════════════════════════════════════════════

// ─── Phase 1: IDLE — "The Hook" ─────────────────────────────
function triggerPhase1() {
  clearAllTimers();
  firstChaosTriggered = false;
  textVisible = false;

  playSceneTransition(() => {
    const bgCanvas = _overlay();
    if (bgCanvas) bgCanvas.className = 'bg-idle';

    hideBrands();
  }, () => {
    showTextWithOverlay(
      'THE POWER OF <span class="text-accent">ATTRACTION.</span>',
      'Step in to see how AMC\'s data magnetizes your ideal buyer.'
    );
  });
}

// ─── Phase 2: CHAOS — "The Problem" ─────────────────────────
function triggerPhase2() {
  playSceneTransition(() => {
    const bgCanvas = _overlay();
    if (bgCanvas) bgCanvas.className = 'bg-chaos';

    animateBrandsFlyIn();
    startFloatingAnimation();
  }, () => {

    if (!firstChaosTriggered) {
      // ── First time: blackout period ──
      firstChaosTriggered = true;

      // Hide text + clear overlay so user sees 3D products clearly
      hideText(1.2);

      // After blackout, show CHAOS text with overlay dimming
      if (blackoutTimer) clearTimeout(blackoutTimer);
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
      // ── Returning to CHAOS: show text right away with overlay ──
      showTextWithOverlay(
        'THE AISLE IS <span class="text-accent">NOISY.</span>',
        'Without data, brands struggle to attract the right attention.'
      );
    }
  });
}

// ─── Phase 3: GESTURE — "Activating Data" ───────────────────
function triggerPhase3() {
  // Kill any pending CHAOS blackout timer so it doesn't overwrite GESTURE text
  if (blackoutTimer) { clearTimeout(blackoutTimer); blackoutTimer = null; }

  playSceneTransition(() => {
    startRingPulse();
    startTechGlow();
  }, () => {
    showTextWithOverlay(
      'HARNESS THE <span class="text-accent">DATA.</span>',
      'Raise your hand. Select a brand and redirect its attraction to your ideal buyer.'
    );
  });
}

// ─── Phase 4: HARMONY — "Data-Driven Match" ─────────────────
function triggerPhase4(selectedBrandId = 'blue') {
  const bgCanvas = _overlay();
  if (bgCanvas) bgCanvas.className = 'bg-harmony';

  animateHarmony(selectedBrandId);

  // Hide text + clear overlay so products are visible
  hideText(0.8);

  // After products settle, show HARMONY text with overlay
  if (harmonyTextTimer) clearTimeout(harmonyTextTimer);
  harmonyTextTimer = setTimeout(() => {
    if (activePhase === PHASE.HARMONY) {
      showTextWithOverlay(
        'DATA-DRIVEN <span class="text-accent">ATTRACTION.</span>',
        'Zero friction. AMC connects your brand directly to the buyer\'s intent.'
      );
    }
    harmonyTextTimer = null;
  }, HARMONY_DELAY_MS);
}

// ═══════════════════════════════════════════════════════════
//  Unified Phase API
// ═══════════════════════════════════════════════════════════

/**
 * Set the current UI phase. Will not re-trigger if already in that phase.
 * @param {number} phase - PHASE constant (1-4)
 * @param {object} opts  - { selectedBrand?: string }
 */
export function setPhase(phase, opts = {}) {
  if (phase === activePhase) return;
  clearAllTimers();
  killHeroTimeline();
  activePhase = phase;

  // Update phase indicator
  const indicator = document.getElementById('phase-indicator');
  const names = { [PHASE.IDLE]: 'Idle', [PHASE.CHAOS]: 'Chaos', [PHASE.GESTURE]: 'Gesture', [PHASE.HARMONY]: 'Harmony' };
  if (indicator) indicator.textContent = `Phase ${phase}: ${names[phase] || ''}`;

  // Update debug button active states
  document.querySelectorAll('.dev-btn[data-phase]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.phase) === phase);
  });

  switch (phase) {
    case PHASE.IDLE:    triggerPhase1(); break;
    case PHASE.CHAOS:   triggerPhase2(); break;
    case PHASE.GESTURE: triggerPhase3(); break;
    case PHASE.HARMONY: triggerPhase4(opts.selectedBrand || 'blue'); break;
  }
}

/** Force phase from debug controls (bypasses duplicate check) */
export function forcePhase(phase, opts = {}) {
  activePhase = 0;   // reset so setPhase won't skip
  setPhase(phase, opts);
}
