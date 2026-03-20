// ═══════════════════════════════════════════════════════════
//  uiAnimations.js — GSAP-powered cinematic transitions,
//  text animations, floating effects, ring pulses
// ═══════════════════════════════════════════════════════════

/* global gsap */

const BRAND_THEME = {
  white: {
    glow: 'rgba(255, 255, 255, 0.7)',
    border: '#FFFFFF',
    background: 'rgba(255, 255, 255, 0.18)',
  },
  black: {
    glow: 'rgba(17, 17, 17, 0.75)',
    border: '#111111',
    background: 'rgba(24, 24, 30, 0.82)',
  },
  blue: {
    glow: 'rgba(0, 164, 228, 0.8)',
    border: '#00A4E4',
    background: 'rgba(0, 62, 126, 0.8)',
  },
};

// ─── DOM References (cached once) ───────────────────────────
let headline, subHeadline, headlineRule, dataOverlay, scanLine;
let _initialized = false;

export function initUIAnimations() {
  headline    = document.getElementById('main-headline');
  subHeadline = document.getElementById('sub-headline');
  headlineRule = document.querySelector('.headline-rule');
  dataOverlay = document.getElementById('data-transition-overlay');
  scanLine    = document.getElementById('scan-line');

  // Initial state
  gsap.set(headline,    { y: 42, autoAlpha: 0, scale: 0.97 });
  gsap.set(subHeadline, { y: 30, autoAlpha: 0 });
  gsap.set(headlineRule, { y: 18, autoAlpha: 0 });

  _initialized = true;
}

// ─── Active timelines (killed before restarting) ────────────
let textAnim  = null;
let floatAnim = null;
let ringAnim  = null;
let glowAnim  = null;

export function killFloatAnim()  { if (floatAnim) { floatAnim.kill(); floatAnim = null; } }
export function killRingAnim()   { if (ringAnim)  { ringAnim.kill();  ringAnim = null; } }
export function killGlowAnim()   { if (glowAnim)  { glowAnim.kill();  glowAnim = null; } }

// ─── Cinematic Scene Transition (data scan effect) ──────────
export function playSceneTransition(callback, onComplete) {
  const tl = gsap.timeline();

  tl.to(dataOverlay, {
    autoAlpha: 1,
    backdropFilter: 'blur(8px)',
    duration: 0.2,
    ease: 'power2.inOut',
  })
  .fromTo(scanLine,
    { y: '-10vh' },
    { y: '110vh', duration: 0.6, ease: 'power2.inOut' },
    '<'
  )
  .call(callback)
  .to(dataOverlay, {
    autoAlpha: 0,
    backdropFilter: 'blur(0px)',
    duration: 0.4,
    ease: 'power2.inOut',
  }, '+=0.1');

  if (onComplete) {
    tl.call(onComplete);
  }
}

// ─── Dramatic Text Animation ────────────────────────────────
export function animateTextChange(newHeadline, newSub) {
  if (textAnim) textAnim.kill();
  textAnim = gsap.timeline();

  textAnim
    // Exit current text
    .to([headline, headlineRule, subHeadline], {
      y: -40,
      autoAlpha: 0,
      scale: 0.95,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power3.in',
    })
    // Update DOM
    .call(() => {
      headline.innerHTML    = newHeadline;
      subHeadline.innerHTML = newSub;
      gsap.set([headline, subHeadline], { y: 36, scale: 0.98 });
      gsap.set(headlineRule, { y: 18, autoAlpha: 0 });
    })
    // Enter new headline with powerful pop
    .to(headline, {
      y: 0,
      autoAlpha: 1,
      scale: 1,
      duration: 0.8,
      ease: 'power3.out',
    })
    .to(headlineRule, {
      y: 0,
      autoAlpha: 0.45,
      duration: 0.55,
      ease: 'power2.out',
    }, '-=0.55')
    // Enter sub-headline
    .to(subHeadline, {
      y: 0,
      autoAlpha: 1,
      duration: 0.8,
      ease: 'expo.out',
    }, '-=0.7');
}

// ─── Brand Logo Fly-in (Phase 2) ────────────────────────────
export function animateBrandsFlyIn() {
  const brandsContainer = document.getElementById('brands-container');
  gsap.set(brandsContainer, { autoAlpha: 1, y: 0, scale: 1 });

  gsap.fromTo('#logo-a',
    { x: -120, y: -60, rotation: -45, autoAlpha: 0 },
    { x: 0, y: 0, rotation: 0, autoAlpha: 1, duration: 1, ease: 'back.out(1.2)' }
  );
  gsap.fromTo('#logo-b',
    { y: -120, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 1, ease: 'back.out(1.5)', delay: 0.1 }
  );
  gsap.fromTo('#logo-c',
    { x: 120, y: -60, rotation: 45, autoAlpha: 0 },
    { x: 0, y: 0, rotation: 0, autoAlpha: 1, duration: 1, ease: 'back.out(1.2)', delay: 0.2 }
  );
}

// ─── Brand Logo Floating (Phase 2+) ─────────────────────────
export function startFloatingAnimation() {
  killFloatAnim();
  floatAnim = gsap.to('.brand-logo', {
    y: -15,
    rotationX: 10,
    rotationY: 5,
    duration: 2.5,
    stagger: { each: 0.4, repeat: -1, yoyo: true },
    ease: 'sine.inOut',
  });
}

// ─── Data Ring Pulse (Phase 3) ──────────────────────────────
export function startRingPulse() {
  killRingAnim();
  gsap.set('.data-ring', { opacity: 0.5, scale: 1 });
  ringAnim = gsap.to('.data-ring', {
    scale: 1.8,
    opacity: 0,
    duration: 1.5,
    stagger: 0.2,
    repeat: -1,
    ease: 'power2.out',
  });
}

// ─── Tech Glow on Logos (Phase 3) ───────────────────────────
export function startTechGlow() {
  killGlowAnim();
  glowAnim = gsap.to('.brand-logo', {
    boxShadow: '0 0 35px rgba(0,164,228,0.5), inset 0 0 15px rgba(0,164,228,0.15)',
    borderColor: 'rgba(0,164,228,0.8)',
    duration: 1,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
  });
}

// ─── Hide Brand Logos (Phase 1) ─────────────────────────────
export function hideBrands() {
  const brandsContainer = document.getElementById('brands-container');
  gsap.to(brandsContainer, { autoAlpha: 0, duration: 0.4, y: -30, scale: 0.9 });
  killFloatAnim();
  killRingAnim();
  killGlowAnim();
}

// ─── Harmony Flash + Selected Brand (Phase 4) ───────────────
export function animateHarmony(selectedBrandId = 'blue') {
  const brandContainers = document.querySelectorAll('.brand-logo-container');
  const theme = BRAND_THEME[selectedBrandId] || BRAND_THEME.blue;

  const tl = gsap.timeline();
  tl.to(dataOverlay, {
    autoAlpha: 1,
    backgroundColor: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(20px)',
    duration: 0.15,
  })
  .call(() => {
    killFloatAnim();
    killRingAnim();
    killGlowAnim();
    gsap.set('.data-ring', { opacity: 0 });

    brandContainers.forEach(container => {
      const logo = container.querySelector('.brand-logo');
      gsap.killTweensOf(logo);

      if (logo.dataset.brand === selectedBrandId) {
        // Selected brand — center of gravity
        gsap.to(logo, {
          scale: 1.5,
          boxShadow: `0 0 80px ${theme.glow}`,
          border: `2px solid ${theme.border}`,
          background: theme.background,
          duration: 1.5,
          ease: 'elastic.out(1, 0.4)',
        });

        // Giant data ring pulse
        const ring = container.querySelector('.data-ring');
        gsap.fromTo(ring,
          { scale: 1, opacity: 1, borderColor: theme.border },
          { scale: 3, opacity: 0, duration: 2, ease: 'power3.out' }
        );
      } else {
        // Competitors sucked away
        gsap.to(logo, {
          autoAlpha: 0,
          scale: 0,
          rotation: 90,
          duration: 0.5,
          ease: 'back.in(2)',
        });
      }
    });
  })
  .to(dataOverlay, {
    autoAlpha: 0,
    backgroundColor: 'rgba(0, 164, 228, 0.08)',
    backdropFilter: 'blur(0px)',
    duration: 0.8,
    ease: 'power2.out',
  }, '+=0.1');
}

// ─── Brand Header Entrance Animation ────────────────────────
export function animateBrandHeader() {
  const header = document.querySelector('.brand-header');
  if (!header) return;
  gsap.fromTo(header,
    { x: -30, autoAlpha: 0 },
    { x: 0, autoAlpha: 1, duration: 0.8, delay: 0.3, ease: 'power2.out' }
  );
}
