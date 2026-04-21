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
let selectorPanel;
let brandButtons;

let floatAnim = null;
let selectorTimeline = null;

function killFloatAnim() { if (floatAnim) { floatAnim.kill(); floatAnim = null; } }
function killSelectorTimeline() { if (selectorTimeline) { selectorTimeline.kill(); selectorTimeline = null; } }

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
    duration: 0.32,
    ease: 'sine.inOut',
  })
    .call(callback)
    .to(dataOverlay, {
      autoAlpha: 0,
      duration: 0.42,
      ease: 'sine.out',
    }, '+=0.08');

  if (onComplete) tl.call(onComplete);
}

export function animateBrandsFlyIn() {
  if (!selectorPanel) return;
  killSelectorTimeline();
  selectorPanel.style.visibility = 'visible';
  gsap.set(selectorPanel, { display: 'flex' });
  gsap.set(brandButtons, { autoAlpha: 0, y: 28, scale: 0.975 });

  selectorTimeline = gsap.timeline({ onComplete: () => { selectorTimeline = null; } });
  selectorTimeline
    .to(selectorPanel, {
      autoAlpha: 1,
      y: 0,
      duration: 0.52,
      ease: 'power3.out',
    }, 0)
    .to(brandButtons, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.72,
      ease: 'power3.out',
      stagger: 0.08,
    }, 0.06);

  clearButtonState();
  clearSignatureOverlay();
}

export function startFloatingAnimation() {
  killFloatAnim();
  floatAnim = gsap.to('.brand-logo-container', {
    y: -6,
    duration: 3.2,
    stagger: { each: 0.18, repeat: -1, yoyo: true },
    ease: 'sine.inOut',
  });
}

export function startRingPulse() {
  // Removed: data-ring elements no longer exist
}

export function startTechGlow() {
  // Removed: glow effect no longer used
}

export function clearSignatureOverlay() {
  document.body.removeAttribute('data-signature');
}

export function hideBrands() {
  if (!selectorPanel) return;
  killSelectorTimeline();
  selectorTimeline = gsap.timeline({
    onComplete: () => {
      selectorPanel.style.visibility = 'hidden';
      selectorPanel.style.display = 'none';
      gsap.set(brandButtons, { autoAlpha: 0, y: 24, scale: 0.975 });
      clearButtonState();
      selectorTimeline = null;
    },
  });
  selectorTimeline
    .to(brandButtons, {
      autoAlpha: 0,
      y: 18,
      scale: 0.985,
      duration: 0.42,
      ease: 'power2.inOut',
      stagger: { each: 0.04, from: 'end' },
    }, 0)
    .to(selectorPanel, {
      autoAlpha: 0,
      y: 12,
      duration: 0.48,
      ease: 'sine.inOut',
    }, 0.08);
  killFloatAnim();
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

  clearSignatureOverlay();
  updateSelectedOptionDebug(selectedOptionId);

  tl.to(dataOverlay, {
    autoAlpha: 1,
    backgroundColor: option.colorTheme.glow,
    duration: 0.28,
    ease: 'sine.inOut',
  })
    .call(() => {
      killFloatAnim();

      brandButtons.forEach(button => {
        const isSelected = button.dataset.option === selectedOptionId;
        button.classList.toggle('selected', isSelected);
        button.classList.toggle('dimmed', !isSelected);

        gsap.to(button, {
          autoAlpha: isSelected ? 1 : 0.18,
          scale: isSelected ? 1.05 : 0.96,
          y: isSelected ? -4 : 0,
          boxShadow: isSelected
            ? `0 0 54px ${option.colorTheme.glow}, inset 0 0 18px ${option.colorTheme.glow}`
            : '0 0 0 rgba(0,0,0,0)',
          borderColor: isSelected ? option.colorTheme.border : 'rgba(255,255,255,0.08)',
          background: isSelected ? option.colorTheme.background : 'linear-gradient(160deg, rgba(0, 62, 126, 0.18), rgba(0, 13, 26, 0.68))',
          duration: 0.82,
          ease: 'power3.out',
        });
      });
    })
    .to(dataOverlay, {
      autoAlpha: 0,
      backgroundColor: 'rgba(0, 164, 228, 0.08)',
      duration: 0.95,
      ease: 'sine.out',
    }, '+=0.08');
}

export function animateBrandHeader() {
  const header = document.querySelector('.brand-header');
  if (!header) return;
  gsap.fromTo(header,
    { x: -30, autoAlpha: 0 },
    { x: 0, autoAlpha: 1, duration: 0.8, delay: 0.3, ease: 'power2.out' }
  );
}
