// ═══════════════════════════════════════════════════════════
//  uiAnimations.js — GSAP-powered transitions for selector,
//  signature overlays, and branded Harmony emphasis
// ═══════════════════════════════════════════════════════════

/* global gsap */

import { getProductOptionById } from './productOptions.js';

let headline;
let subHeadline;
let headlineRule;
let dataOverlay;
let scanLine;
let selectorPanel;
let brandButtons;

let floatAnim = null;
let ringAnim = null;
let glowAnim = null;

function killFloatAnim() { if (floatAnim) { floatAnim.kill(); floatAnim = null; } }
function killRingAnim() { if (ringAnim) { ringAnim.kill(); ringAnim = null; } }
function killGlowAnim() { if (glowAnim) { glowAnim.kill(); glowAnim = null; } }

function clearButtonState() {
  brandButtons.forEach(button => {
    button.classList.remove('selected', 'dimmed');
    gsap.set(button, { clearProps: 'boxShadow,borderColor,background' });
  });
}

export function initUIAnimations() {
  headline = document.getElementById('main-headline');
  subHeadline = document.getElementById('sub-headline');
  headlineRule = document.querySelector('.headline-rule');
  dataOverlay = document.getElementById('data-transition-overlay');
  scanLine = document.getElementById('scan-line');
  selectorPanel = document.getElementById('selector-panel');
  brandButtons = [...document.querySelectorAll('.brand-logo')];

  gsap.set(headline, { y: 42, autoAlpha: 0, scale: 0.97 });
  gsap.set(subHeadline, { y: 30, autoAlpha: 0 });
  gsap.set(headlineRule, { y: 18, autoAlpha: 0 });
  gsap.set(selectorPanel, { autoAlpha: 0, y: 24, display: 'none' });
  gsap.set(brandButtons, { autoAlpha: 0, y: 18, scale: 0.96 });
}

export function playSceneTransition(callback, onComplete) {
  const tl = gsap.timeline();

  tl.to(dataOverlay, {
    autoAlpha: 1,
    backdropFilter: 'blur(0px)',
    duration: 0.16,
    ease: 'power2.inOut',
  })
    .fromTo(scanLine,
      { y: '-10vh' },
      { y: '110vh', duration: 0.42, ease: 'power2.inOut' },
      '<'
    )
    .call(callback)
    .to(dataOverlay, {
      autoAlpha: 0,
      backdropFilter: 'blur(0px)',
      duration: 0.24,
      ease: 'power2.inOut',
    }, '+=0.04');

  if (onComplete) tl.call(onComplete);
}

export function animateBrandsFlyIn() {
  if (!selectorPanel) return;
  selectorPanel.style.visibility = 'visible';
  gsap.set(selectorPanel, { display: 'flex' });
  gsap.to(selectorPanel, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' });
  gsap.to(brandButtons, {
    autoAlpha: 1,
    y: 0,
    scale: 1,
    duration: 0.38,
    ease: 'power3.out',
    stagger: 0.05,
  });
  clearButtonState();
  clearSignatureOverlay();
}

export function startFloatingAnimation() {
  killFloatAnim();
  floatAnim = gsap.to('.brand-logo-container', {
    y: -10,
    duration: 2.4,
    stagger: { each: 0.18, repeat: -1, yoyo: true },
    ease: 'sine.inOut',
  });
}

export function startRingPulse() {
  killRingAnim();
  gsap.set('.data-ring', { opacity: 0.4, scale: 1 });
  ringAnim = gsap.to('.data-ring', {
    scale: 1.5,
    opacity: 0,
    duration: 1.4,
    stagger: 0.16,
    repeat: -1,
    ease: 'power2.out',
  });
}

export function startTechGlow() {
  killGlowAnim();
  glowAnim = gsap.to('.brand-logo', {
    boxShadow: '0 0 35px rgba(0,164,228,0.34), inset 0 0 15px rgba(0,164,228,0.12)',
    borderColor: 'rgba(0,164,228,0.82)',
    duration: 1,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
  });
}

export function clearSignatureOverlay() {
  document.body.removeAttribute('data-signature');
}

export function hideBrands() {
  if (!selectorPanel) return;
  gsap.to(selectorPanel, {
    autoAlpha: 0,
    y: 18,
    duration: 0.28,
    ease: 'power2.inOut',
    onComplete: () => {
      selectorPanel.style.visibility = 'hidden';
      selectorPanel.style.display = 'none';
      gsap.set(brandButtons, { autoAlpha: 0, y: 18, scale: 0.96 });
      clearButtonState();
    },
  });
  killFloatAnim();
  killRingAnim();
  killGlowAnim();
  clearSignatureOverlay();
}

export function updateSelectedOptionDebug(optionId) {
  const el = document.getElementById('dev-current-option');
  if (!el) return;
  if (!optionId) {
    el.textContent = 'Option: none';
    return;
  }

  const label = getProductOptionById(optionId).label;
  el.textContent = `Option: ${label}`;
}

export function animateHarmony(selectedOptionId) {
  const option = getProductOptionById(selectedOptionId);
  const tl = gsap.timeline();

  document.body.dataset.signature = option.signatureStyle;
  updateSelectedOptionDebug(selectedOptionId);

  tl.to(dataOverlay, {
    autoAlpha: 1,
    backgroundColor: option.colorTheme.glow,
    backdropFilter: 'blur(18px)',
    duration: 0.15,
  })
    .call(() => {
      killFloatAnim();
      killRingAnim();
      killGlowAnim();

      brandButtons.forEach(button => {
        const isSelected = button.dataset.option === selectedOptionId;
        button.classList.toggle('selected', isSelected);
        button.classList.toggle('dimmed', !isSelected);

        gsap.to(button, {
          autoAlpha: isSelected ? 1 : 0.18,
          scale: isSelected ? 1.08 : 0.94,
          y: isSelected ? -6 : 0,
          boxShadow: isSelected
            ? `0 0 54px ${option.colorTheme.glow}, inset 0 0 18px ${option.colorTheme.glow}`
            : '0 0 0 rgba(0,0,0,0)',
          borderColor: isSelected ? option.colorTheme.border : 'rgba(255,255,255,0.08)',
          background: isSelected ? option.colorTheme.background : 'linear-gradient(160deg, rgba(0, 62, 126, 0.18), rgba(0, 13, 26, 0.68))',
          duration: 0.6,
          ease: 'power2.out',
        });
      });
    })
    .to(dataOverlay, {
      autoAlpha: 0,
      backgroundColor: 'rgba(0, 164, 228, 0.08)',
      backdropFilter: 'blur(0px)',
      duration: 0.8,
      ease: 'power2.out',
    }, '+=0.05');
}

export function animateBrandHeader() {
  const header = document.querySelector('.brand-header');
  if (!header) return;
  gsap.fromTo(header,
    { x: -30, autoAlpha: 0 },
    { x: 0, autoAlpha: 1, duration: 0.8, delay: 0.3, ease: 'power2.out' }
  );
}
