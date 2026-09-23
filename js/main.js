(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasEngine = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasEngine) gsap.registerPlugin(ScrollTrigger);

  /* ============================================================
     PORTAL HERO — panels part, wordmark grows & tightens & splits
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
    const wordmark = document.querySelector('[data-hero-wordmark]');
    if (!heroSection || !stage) return;

    if (video) video.play().catch(() => {});

    if (reduceMotion || !hasEngine) return;

    let stageRect = stage.getBoundingClientRect();
    window.addEventListener('resize', () => { stageRect = stage.getBoundingClientRect(); });

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
      onRefresh: () => { stageRect = stage.getBoundingClientRect(); },
      onUpdate: (self) => apply(self.progress),
    });
  }

  /* ============================================================
     SCROLL-SCRUBBED VIDEO SECTIONS — design (drawing) + build
     Pins via CSS sticky (no double-pin), maps scroll progress to
     video.currentTime with WebKit priming, seek gating and a lerp
     smoothing loop, per the scrub engineering standard.
     ============================================================ */
  function initScrubSection(section) {
    const video = section.querySelector('[data-scrub-video]');
    const hint = section.querySelector('[data-scrub-hint]');
    if (!video) return;

    if (reduceMotion) {
      // Gentle ambient loop instead of a scroll-locked scrub — motion stays,
      // the jarring scroll-position-driven pin does not.
      video.loop = true;
      video.play().catch(() => {});
      if (hint) hint.style.display = 'none';
      return;
    }

    const prefersNativeMedia = (navigator.vendor || '').includes('Apple');

    let seekBusy = false;
    let pendingTime = null;
    function requestSeek(t) {
      if (!video.duration || Number.isNaN(video.duration)) return;
      t = Math.max(0, Math.min(video.duration - 0.02, t));
      if (seekBusy) { pendingTime = t; return; }
      if (Math.abs(video.currentTime - t) < 0.008) return;
      seekBusy = true;
      video.currentTime = t;
    }
    video.addEventListener('seeked', () => {
      seekBusy = false;
      if (pendingTime !== null) {
        const t = pendingTime; pendingTime = null; requestSeek(t);
      }
    });
    video.addEventListener('error', () => { seekBusy = false; pendingTime = null; });

    // Direct scroll-to-seek (scrub: true, boolean — no added delay). A second
    // lerp/smoothing layer on top would be a second easing stage fighting
    // ScrollTrigger's own progress tracking (see the "one easing layer"
    // rule), and at 10s clips it isn't needed. Seek gating above still
    // coalesces to the latest wanted time if a seek is in flight.
    function setTarget(p) {
      requestSeek(p * video.duration);
    }

    function armWhenReady() {
      if (!hasEngine) return;
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          setTarget(self.progress);
          if (hint) hint.classList.toggle('is-hidden', self.progress > 0.06);
        },
      });
    }

    video.addEventListener('loadedmetadata', () => {
      // iOS will not paint a frame for a video that has never been told to
      // play — prime the decoder with a muted play/pause, then arm the scrub.
      video.play().then(() => video.pause()).catch(() => {}).finally(armWhenReady);
    }, { once: true });

    if (prefersNativeMedia) {
      video.preload = 'auto';
    }
    if (video.readyState >= 1) {
      video.play().then(() => video.pause()).catch(() => {}).finally(armWhenReady);
    }
  }

  function initScrubSections() {
    document.querySelectorAll('.scrub, .split').forEach(initScrubSection);
  }

  /* ============================================================
     THROWABLE CARD DECK — pointer-drag physics, per the original
     spec: capture the pointer, track the drag, throw past a
     distance threshold with a lift and a roll, re-stack the next
     card on top. Keyboard: arrow keys throw the current top card.
     ============================================================ */
  function initDeck() {
    const deck = document.querySelector('[data-deck]');
    if (!deck) return;
    const cards = Array.from(deck.querySelectorAll('[data-card]'));
    const dotsWrap = document.querySelector('[data-deck-dots]');
    if (!cards.length) return;

    let order = cards.map((_, i) => i);

    cards.forEach(() => dotsWrap.appendChild(document.createElement('span')));
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
      setTimeout(() => { el.style.transition = 'none'; }, THROW_MS + 40);
    }

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
      topEl.style.transform = `translate(${curX}px, ${curY}px) rotate(${rot}deg) scale(1.02)`;
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      const deckWidth = deck.getBoundingClientRect().width;
      const threshold = deckWidth * 0.1;
      if (Math.abs(curX) > threshold) throwTop(curX > 0 ? 1 : -1);
      else layout(true);
    }
    deck.addEventListener('pointerup', endDrag);
    deck.addEventListener('pointercancel', endDrag);

    deck.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); throwTop(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); throwTop(-1); }
    });
  }

  /* ============================================================
     SHOWCASE — pinned horizontal track. Track slides left as you
     scroll (new items arrive from the right); whichever card sits
     nearest the stage's center lifts and scales up, as if it were
     stepping out of the screen. No rotation — stays straight.
     ============================================================ */
  function initShowcase() {
    const section = document.querySelector('.showcase');
    const track = document.querySelector('[data-showcase-track]');
    if (!section || !track) return;
    const items = Array.from(track.querySelectorAll('[data-showcase-item]'));
    if (reduceMotion || !hasEngine) return; // CSS fallback: plain horizontal scroll strip

    function apply(progress) {
      const stageEl = section.querySelector('[data-showcase-stage]');
      const trackWidth = track.scrollWidth;
      const stageWidth = stageEl.getBoundingClientRect().width;
      const maxShift = Math.max(0, trackWidth - stageWidth * 0.7);
      const x = -progress * maxShift;
      track.style.transform = `translateX(${x}px)`;

      const stageRect = stageEl.getBoundingClientRect();
      const centerX = stageRect.left + stageRect.width / 2;
      items.forEach((item) => {
        const r = item.getBoundingClientRect();
        const itemCenter = r.left + r.width / 2;
        const delta = Math.abs(itemCenter - centerX);
        const proximity = Math.max(0, 1 - delta / (r.width * 1.15));
        const lift = -proximity * 34;
        const scale = 1 + proximity * 0.14;
        item.style.transform = `translateY(${lift}px) scale(${scale})`;
        item.style.boxShadow = `0 ${20 + proximity * 40}px ${40 + proximity * 40}px -20px rgba(0,0,0,${0.15 + proximity * 0.45})`;
        item.style.zIndex = String(Math.round(proximity * 100));
      });
    }

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onRefresh: () => apply(0),
      onUpdate: (self) => apply(self.progress),
    });
  }

  /* ============================================================
     REDUCED MOTION LIVE TOGGLE
     ============================================================ */
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    window.location.reload();
  });

  document.addEventListener('DOMContentLoaded', () => {
    initHero();
    initScrubSections();
    initDeck();
    initShowcase();
  });
})();
