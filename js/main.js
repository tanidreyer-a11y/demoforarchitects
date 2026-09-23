(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     PORTAL HERO — panels part, wordmark grows & tightens & splits
     Single scroll engine: GSAP ScrollTrigger reads progress only,
     CSS position:sticky does the actual pinning (no double-pin).
     ============================================================ */
  function initHero() {
    const heroSection = document.querySelector('.hero');
    const stage = document.querySelector('[data-hero-stage]');
    const video = document.querySelector('[data-hero-video]');
    const duotone = document.querySelector('[data-hero-duotone]');
    const panelL = document.querySelector('[data-hero-panel-left]');
    const panelR = document.querySelector('[data-hero-panel-right]');
    const dotA = document.querySelector('[data-hero-dot-a]');
    const dotB = document.querySelector('[data-hero-dot-b]');
    const wordA = document.querySelector('[data-word-a]');
    const wordB = document.querySelector('[data-word-b]');
    if (!heroSection || !stage) return;

    if (video) {
      video.play().catch(() => {});
    }

    if (reduceMotion || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      // Static, fully-open resting state — page is complete without motion.
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    let stageRect = stage.getBoundingClientRect();
    const measure = () => { stageRect = stage.getBoundingClientRect(); };
    window.addEventListener('resize', measure);

    function apply(p) {
      const openP = Math.min(1, p / 0.6);
      const wordP = p;

      panelL.style.transform = `translateX(${-openP * 105}%)`;
      panelR.style.transform = `translateX(${openP * 105}%)`;
      video.style.transform = `scale(${1.15 - openP * 0.15})`;
      duotone.style.opacity = String(openP * 0.35);

      const travelX = stageRect.width * 0.42;
      const travelY = stageRect.height * 0.38;
      dotA.style.transform = `translate(${-14 - openP * travelX}px, calc(-50% - ${openP * travelY}px))`;
      dotB.style.transform = `translate(${6 + openP * travelX}px, calc(-50% + ${openP * travelY}px))`;

      const scale = 1 + wordP * 0.35;
      const tracking = -0.02 - wordP * 0.04;
      const wordmark = document.querySelector('[data-hero-wordmark]');
      wordmark.style.transform = `translate(-50%, -50%) scale(${scale})`;
      wordmark.style.letterSpacing = `${tracking}em`;

      const shiftA = wordA.offsetWidth * 0.5 * wordP;
      const shiftB = wordB.offsetWidth * 0.5 * wordP;
      wordA.style.transform = `translateX(${-shiftA}px)`;
      wordB.style.transform = `translateX(${shiftB}px)`;
    }

    ScrollTrigger.create({
      trigger: heroSection,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onRefresh: measure,
      onUpdate: (self) => apply(self.progress),
    });
  }

  /* ============================================================
     STATEMENT FOLD — the circular figure drifts and rotates
     ============================================================ */
  function initStatementDrift() {
    const fig = document.querySelector('[data-drift]');
    const section = document.querySelector('.statement');
    if (!fig || !section) return;

    const media = fig.querySelector('video');
    if (media) media.play().catch(() => {});

    if (reduceMotion || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        const rotate = p * 14;
        const drift = Math.sin(p * Math.PI) * 22;
        fig.style.transform = `translateY(calc(-50% - ${drift}px)) rotate(${rotate}deg)`;
      },
    });
  }

  /* ============================================================
     BUILD SECTION — ensure the looping video actually plays
     ============================================================ */
  function initBuildVideo() {
    const v = document.querySelector('.build__video');
    if (v) v.play().catch(() => {});
  }

  /* ============================================================
     THROWABLE CARD DECK
     ============================================================ */
  function initDeck() {
    const deck = document.querySelector('[data-deck]');
    if (!deck) return;
    const cards = Array.from(deck.querySelectorAll('[data-card]'));
    const dotsWrap = document.querySelector('[data-deck-dots]');
    if (!cards.length) return;

    // order[0] is the current top card
    let order = cards.map((_, i) => i);

    cards.forEach(() => {
      const d = document.createElement('span');
      dotsWrap.appendChild(d);
    });
    const dots = Array.from(dotsWrap.children);

    const THROW_MS = reduceMotion ? 1 : 420;
    const SPRING_MS = reduceMotion ? 1 : 320;

    function layout(animate) {
      order.forEach((cardIdx, stackPos) => {
        const el = cards[cardIdx];
        el.style.zIndex = String(cards.length - stackPos);
        if (stackPos === 0) {
          el.style.transition = animate ? `transform ${SPRING_MS}ms var(--ease-out, ease-out)` : 'none';
          el.style.transform = 'translate(0px, 0px) rotate(0deg) scale(1)';
          el.style.opacity = '1';
        } else {
          const x = stackPos * 6;
          const y = stackPos * 8;
          const rot = stackPos % 2 === 0 ? stackPos * 1.5 : -stackPos * 1.5;
          const scale = 1 - stackPos * 0.035;
          el.style.transition = animate ? `transform ${SPRING_MS}ms var(--ease-out, ease-out)` : 'none';
          el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
          el.style.opacity = stackPos < 4 ? '1' : '0';
        }
      });
      dots.forEach((d, i) => d.classList.toggle('is-active', i === order[0] % dots.length));
    }
    layout(false);

    function throwTop(direction) {
      const topIdx = order[0];
      const el = cards[topIdx];
      const deckWidth = deck.getBoundingClientRect().width;
      el.style.transition = `transform ${THROW_MS}ms var(--ease-out, ease-out), opacity ${THROW_MS}ms var(--ease-out, ease-out)`;
      el.style.transform = `translate(${direction * deckWidth * 1.2}px, ${-30}px) rotate(${direction * 22}deg)`;
      el.style.opacity = '0';
      order.push(order.shift());
      setTimeout(() => layout(true), reduceMotion ? 0 : 20);
      setTimeout(() => {
        el.style.transition = 'none';
      }, THROW_MS + 40);
    }

    // Pointer drag on the current top card
    let dragging = false;
    let startX = 0, startY = 0, curX = 0, curY = 0;

    deck.addEventListener('pointerdown', (e) => {
      const topEl = cards[order[0]];
      if (!topEl.contains(e.target) && e.target !== topEl) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      curX = 0; curY = 0;
      topEl.setPointerCapture(e.pointerId);
      topEl.style.transition = 'none';
    });

    deck.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const topEl = cards[order[0]];
      curX = e.clientX - startX;
      curY = e.clientY - startY;
      const rot = curX * 0.05;
      const scale = 1.02;
      topEl.style.transform = `translate(${curX}px, ${curY}px) rotate(${rot}deg) scale(${scale})`;
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      const deckWidth = deck.getBoundingClientRect().width;
      const threshold = deckWidth * 0.1;
      if (Math.abs(curX) > threshold) {
        throwTop(curX > 0 ? 1 : -1);
      } else {
        layout(true);
      }
    }
    deck.addEventListener('pointerup', endDrag);
    deck.addEventListener('pointercancel', endDrag);

    deck.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); throwTop(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); throwTop(-1); }
    });
  }

  /* ============================================================
     REDUCED MOTION LIVE TOGGLE — re-run static state if it flips
     while the page is already open.
     ============================================================ */
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    window.location.reload();
  });

  document.addEventListener('DOMContentLoaded', () => {
    initHero();
    initStatementDrift();
    initBuildVideo();
    initDeck();
  });
})();
