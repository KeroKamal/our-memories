/* =====================================================================
   Kero & Tota — animations + faster start (loaded with "defer")
   1. Soft hearts drifting up behind the app
   2. Tap anywhere = a few little hearts; tap a heart button = a bigger burst
   3. Cards rise in when you open a screen
   4. A live "we have been together for ..." clock on the together card
   5. Registers the service worker for everyone so the app opens fast / offline
   Nothing here touches your data. If anything fails, the app keeps working.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__fxLoaded) return;
  window.__fxLoaded = true;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 5. service worker (instant opens + offline) ----------
  try {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('firebase-messaging-sw.js').catch(function () {});
      });
    }
  } catch (e) {}

  if (reduce) { liveClock(); return; }   // no motion for people who turned it off

  // ---------- 1. drifting hearts ----------
  var canvas, ctx, W = 0, H = 0, dpr = 1, hearts = [], raf = 0, last = 0, rgb = '244 63 94', rgbAt = 0;

  function themeRgb() {
    var now = Date.now();
    if (now - rgbAt > 1500) {
      rgbAt = now;
      try {
        var v = getComputedStyle(document.documentElement).getPropertyValue('--c400-rgb').trim();
        if (v) rgb = v;
      } catch (e) {}
    }
    return rgb.replace(/\s+/g, ',');
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(initial) {
    var size = 7 + Math.random() * 15;
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : H + size + Math.random() * 60,
      s: size,
      v: 10 + Math.random() * 22,            // px per second upward
      sway: 8 + Math.random() * 18,
      ph: Math.random() * 6.28,
      a: .10 + Math.random() * .16           // how see-through
    };
  }

  function heartPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * .35);
    c.bezierCurveTo(x, y, x - s * .5, y, x - s * .5, y + s * .3);
    c.bezierCurveTo(x - s * .5, y + s * .6, x, y + s * .8, x, y + s);
    c.bezierCurveTo(x, y + s * .8, x + s * .5, y + s * .6, x + s * .5, y + s * .3);
    c.bezierCurveTo(x + s * .5, y, x, y, x, y + s * .35);
    c.closePath();
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 33) return;                // about 30 frames a second is plenty and saves battery
    var dt = Math.min(.1, (t - last) / 1000 || .033);
    last = t;
    ctx.clearRect(0, 0, W, H);
    var col = themeRgb();
    for (var i = 0; i < hearts.length; i++) {
      var h = hearts[i];
      h.y -= h.v * dt;
      var x = h.x + Math.sin(h.ph + t / 1800) * h.sway;
      if (h.y < -h.s * 2) hearts[i] = h = spawn(false);
      var fade = Math.min(1, (H - h.y) / 80, (h.y + h.s * 2) / 120);   // soft in / out
      ctx.fillStyle = 'rgba(' + col + ',' + (h.a * Math.max(0, fade)).toFixed(3) + ')';
      heartPath(ctx, x, h.y, h.s);
      ctx.fill();
    }
  }

  function start() {
    if (raf || !canvas) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  function initBackground() {
    canvas = document.createElement('canvas');
    canvas.id = 'fx-bg';
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    document.body.insertBefore(canvas, document.body.firstChild);
    resize();
    var count = W < 500 ? 12 : 22;
    for (var i = 0; i < count; i++) hearts.push(spawn(true));
    window.addEventListener('resize', function () { resize(); });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    start();
  }

  // ---------- 2. tap sparkles ----------
  var EMOJI = ['💗', '💕', '💖', '❤️', '💘', '✨'];
  var live = 0;

  function burst(x, y, n, spread) {
    for (var i = 0; i < n; i++) {
      if (live > 45) return;
      var el = document.createElement('span');
      el.className = 'fx-p';
      el.textContent = EMOJI[(Math.random() * EMOJI.length) | 0];
      var ang = Math.random() * Math.PI * 2;
      var dist = (.4 + Math.random() * .6) * spread;
      el.style.setProperty('--x', x + 'px');
      el.style.setProperty('--y', y + 'px');
      el.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      el.style.setProperty('--dy', (Math.sin(ang) * dist - spread * .5) + 'px');   // drift upward
      el.style.setProperty('--rot', ((Math.random() - .5) * 90) + 'deg');
      el.style.setProperty('--dur', (.7 + Math.random() * .5) + 's');
      el.style.fontSize = (12 + Math.random() * 12) + 'px';
      live++;
      el.addEventListener('animationend', function () { live--; this.remove(); }, { once: true });
      document.body.appendChild(el);
    }
  }

  function initTaps() {
    document.addEventListener('pointerdown', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('input, textarea, select, [contenteditable], #pass-overlay, #image-modal.open')) return;
      var heart = t.closest('.heart-btn');
      if (heart) burst(e.clientX, e.clientY, 9, 90);
      else burst(e.clientX, e.clientY, 3, 46);
    }, { passive: true });
  }

  // ---------- 3. cards rise in when a screen opens ----------
  function initStagger() {
    var timer = 0;
    var main = document.querySelector('main') || document.body;
    function play(screenId) {
      var el = document.getElementById(screenId);
      if (!el) return;
      el.classList.remove('fx-stagger');
      void el.offsetWidth;
      el.classList.add('fx-stagger');
      clearTimeout(timer);
      timer = setTimeout(function () { el.classList.remove('fx-stagger'); }, 1300);   // removed so later updates don't re-animate
    }
    play('screen-photos');
    var orig = window.switchScreen;
    if (typeof orig === 'function') {
      window.switchScreen = function (screen) {
        var r = orig.apply(this, arguments);
        try { play('screen-' + screen); } catch (e) {}
        return r;
      };
    }
  }

  // ---------- 4. live "together" clock ----------
  function liveClock() {
    var sub = document.getElementById('together-sub');
    if (!sub || typeof TOGETHER_START === 'undefined') return;
    var live = document.getElementById('together-live');
    if (!live) {
      live = document.createElement('p');
      live.id = 'together-live';
      sub.insertAdjacentElement('afterend', live);
    }
    var start = new Date(TOGETHER_START.y, TOGETHER_START.m, TOGETHER_START.d).getTime();
    function two(n) { return n < 10 ? '0' + n : '' + n; }
    function tick() {
      if (document.hidden || !live.offsetParent) return;   // not on screen: do nothing
      var s = Math.floor((Date.now() - start) / 1000);
      if (s < 0) { live.textContent = ''; return; }
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      live.innerHTML = '<span class="fx-pulse">💓</span> ' + d + 'd ' + two(h) + 'h ' + two(m) + 'm ' + two(sec) + 's of loving you';
    }
    tick();
    setInterval(tick, 1000);
  }

  function boot() {
    try { initBackground(); } catch (e) { console.warn('fx background', e); }
    try { initTaps(); } catch (e) { console.warn('fx taps', e); }
    try { initStagger(); } catch (e) { console.warn('fx stagger', e); }
    try { liveClock(); } catch (e) { console.warn('fx clock', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
