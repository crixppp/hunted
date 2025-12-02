// Hunted — spinner on notches; wall-clock catch-up; smooth panic; 3s floor; wake lock; MP3 chime

function wireUi(doc = document) {
  const body = doc.body;
  if (!body) {
    console.warn('wireUi: document.body not ready');
    return;
  }

  const qs = (selector, scope = doc) => scope.querySelector(selector);
  const qsa = (selector, scope = doc) => Array.from(scope.querySelectorAll(selector));

  const screens = {
    home: qs('#screen-home'),
    host: qs('#screen-host'),
    join: qs('#screen-join'),
    timer: qs('#screen-timer')
  };

  let activeScreen = screens.home;

  function show(name) {
    const target = screens[name];
    if (!target) return;
    if (activeScreen === screens.timer && name !== 'timer') endGame();
    if (activeScreen === target) return;

    activeScreen?.classList.remove('active');
    activeScreen = target;
    activeScreen.classList.add('active');

    body.classList.toggle('home-active', name === 'home');
    if (name !== 'timer') body.classList.remove('playing');
    body.classList.toggle('timer-active', name === 'timer');
    if (name !== 'timer') resetEliminateHold();
  }

  if (activeScreen) body.classList.add('home-active');

  qs('#logoBtn')?.addEventListener('click', () => show('home'));

  const modal = qs('#modal');
  qs('#btnQuickRules, #quickRules')?.addEventListener('click', () => modal?.classList.add('show'));
  qsa('[data-close], .modal-close').forEach(el => el.addEventListener('click', () => modal?.classList.remove('show')));

  let assignedSeconds = null;
  let rolledFinal = false;
  const slotMin = qs('#slotMin');
  const slotSecT = qs('#slotSecT');
  const slotSecO = qs('#slotSecO');
  const btnSlotSpin = qs('#btnSlotSpin');
  const btnSlotContinue = qs('#btnSlotContinue');
  const flashOverlay = qs('.flash-overlay', body);
  const eliminatedBtn = qs('#btnEliminated', body);
  let flashDurationMs = 700;

  flashOverlay?.addEventListener('animationend', () => {
    flashOverlay.classList.remove('flash-active');
  });

  const ELIMINATE_HOLD_MS = 1000;
  let eliminateHoldRaf = null;
  let eliminateHoldStart = 0;
  let eliminatedTriggered = false;
  let eliminateHoldTimer = null;
  let eliminateHolding = false;
  const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;

  function resetEliminateHold(fullReset = true) {
    if (!eliminatedBtn) return;
    if (eliminateHoldRaf) cancelAnimationFrame(eliminateHoldRaf);
    if (eliminateHoldTimer) clearTimeout(eliminateHoldTimer);
    eliminateHoldRaf = null;
    eliminateHoldTimer = null;
    eliminateHoldStart = 0;
    eliminateHolding = false;
    if (fullReset) eliminatedTriggered = false;
    eliminatedBtn.style.setProperty('--fill', '0%');
    eliminatedBtn.classList.remove('holding');
  }

  function completeElimination() {
    if (eliminatedTriggered) return;
    eliminatedTriggered = true;
    eliminatedBtn?.style.setProperty('--fill', '100%');
    show('home');
    resetEliminateHold(false);
  }

  function updateEliminateProgress(now = performance.now()) {
    if (!eliminateHolding || !eliminateHoldStart) return;
    const progress = Math.min(1, (now - eliminateHoldStart) / ELIMINATE_HOLD_MS);
    eliminatedBtn.style.setProperty('--fill', `${Math.round(progress * 100)}%`);
    if (progress < 1) {
      eliminateHoldRaf = requestAnimationFrame(updateEliminateProgress);
    }
  }

  function startEliminateHold(event) {
    if (!eliminatedBtn || eliminatedTriggered) return;
    if (event.touches && event.touches.length > 1) return;
    if (event.pointerId != null && eliminatedBtn.setPointerCapture) {
      try {
        eliminatedBtn.setPointerCapture(event.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
    eliminateHolding = true;
    eliminateHoldStart = performance.now();
    eliminatedBtn.classList.add('holding');
    eliminatedBtn.style.setProperty('--fill', '0%');
    if (eliminateHoldTimer) clearTimeout(eliminateHoldTimer);
    eliminateHoldTimer = setTimeout(completeElimination, ELIMINATE_HOLD_MS);
    eliminateHoldRaf = requestAnimationFrame(updateEliminateProgress);
  }

  function finishEliminateHold(event) {
    if (!eliminateHolding) return;
    eliminateHolding = false;
    if (event?.pointerId != null && eliminatedBtn?.releasePointerCapture) {
      try {
        eliminatedBtn.releasePointerCapture(event.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
    if (eliminateHoldTimer) {
      clearTimeout(eliminateHoldTimer);
      eliminateHoldTimer = null;
    }
    const elapsed = performance.now() - eliminateHoldStart;
    if (eliminatedTriggered) {
      resetEliminateHold(false);
      return;
    }
    if (elapsed >= ELIMINATE_HOLD_MS && event?.type !== 'pointerleave' && event?.type !== 'mouseleave') {
      completeElimination();
    } else {
      resetEliminateHold();
    }
  }

  function startEliminateFlow(event) {
    if (!eliminatedBtn) return;
    if (eliminatedTriggered) {
      event?.preventDefault();
      return;
    }
    startEliminateHold(event);
  }

  function endEliminateFlow(event) {
    finishEliminateHold(event);
  }

  if (eliminatedBtn) {
    const downEvents = supportsPointer ? ['pointerdown'] : ['touchstart', 'mousedown'];
    const upEvents = supportsPointer
      ? ['pointerup', 'pointercancel', 'pointerleave']
      : ['touchend', 'touchcancel', 'mouseup', 'mouseleave'];

    downEvents.forEach(evt => {
      eliminatedBtn.addEventListener(evt, startEliminateFlow, { passive: true });
    });
    upEvents.forEach(evt => {
      eliminatedBtn.addEventListener(evt, endEliminateFlow, { passive: true });
    });

    eliminatedBtn.addEventListener('click', event => {
      if (eliminateHolding) return;
      event.preventDefault();
      completeElimination();
    });
  }

  function resetGameState() {
    try {
      localStorage.clear();
    } catch (err) {
      console.warn('Unable to access storage; continuing without clearing state', err);
    }
    assignedSeconds = null;
    rolledFinal = false;
    if (slotMin) slotMin.textContent = '0';
    if (slotSecT) slotSecT.textContent = '0';
    if (slotSecO) slotSecO.textContent = '0';
    if (btnSlotSpin) btnSlotSpin.disabled = false;
    if (btnSlotContinue) btnSlotContinue.disabled = true;
  }

  qs('#host, #btnHost')?.addEventListener('click', () => {
    resetGameState();
    show('host');
  });
  qs('#join, #btnJoin')?.addEventListener('click', () => {
    resetGameState();
    show('join');
  });
  qs('#btnJoinBack')?.addEventListener('click', () => show('home'));
  qs('#btnHostBack')?.addEventListener('click', () => show('home'));

  const arrowRotor = qs('#arrowRotor');
  let spinning = false;
  let stepCount = 0;
  const STEP = 30;
  const SLOTS = 12;

  qs('#btnSpin')?.addEventListener('click', () => {
    if (!arrowRotor) return;
    if (spinning) return;
    spinning = true;
    stepCount = Math.round(stepCount);
    const turns = 3 + Math.floor(Math.random() * 4);
    const slot = Math.floor(Math.random() * SLOTS);
    stepCount += turns * SLOTS + slot;
    arrowRotor.style.transition = 'transform 3s cubic-bezier(.12,.72,.12,1)';
    arrowRotor.style.transform = `translate(-50%,-50%) rotate(${stepCount * STEP}deg)`;
    setTimeout(() => {
      arrowRotor.style.transition = 'none';
      spinning = false;
    }, 3100);
  });

  function cycle(el, vals, dur, target) {
    if (!el) return Promise.resolve();
    return new Promise(res => {
      const end = Date.now() + dur;
      let i = 0;
      (function tick() {
        if (Date.now() >= end) {
          el.textContent = target;
          res();
          return;
        }
        el.textContent = vals[i % vals.length];
        i++;
        setTimeout(tick, 50);
      })();
    });
  }

  qs('#btnSlotSpin')?.addEventListener('click', async () => {
    if (!slotMin || !slotSecT || !slotSecO || !btnSlotSpin || !btnSlotContinue) return;
    if (rolledFinal) return;
    btnSlotSpin.disabled = true;
    assignedSeconds = Math.floor(Math.random() * 121);
    const m = Math.floor(assignedSeconds / 60);
    const s = assignedSeconds % 60;
    await Promise.all([
      cycle(slotMin, [0, 1, 2], 1200, m),
      cycle(slotSecT, [0, 1, 2, 3, 4, 5], 1500, Math.floor(s / 10)),
      cycle(slotSecO, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 1800, s % 10)
    ]);
    rolledFinal = true;
    btnSlotContinue.disabled = false;
  });

  const chime = new Audio('chime.mp3');
  chime.preload = 'auto';
  chime.volume = 1;
  const chimeLayers = [chime.cloneNode(), chime.cloneNode(), chime];
  chimeLayers.forEach(layer => {
    layer.preload = 'auto';
    layer.volume = 1;
    if (!layer.src) layer.src = 'chime.mp3';
    layer.load();
  });

  function setFlashDuration() {
    if (!Number.isFinite(chime.duration) || chime.duration <= 0) return;

    const adjusted = chime.duration * 1000 - 180;
    flashDurationMs = Math.max(320, adjusted);
  }
  chime.addEventListener('loadedmetadata', setFlashDuration);
  setFlashDuration();

  let audioPrimed = false;
  function primeChime() {
    if (audioPrimed) return;
    const unlocks = chimeLayers.map(layer =>
      layer
        .play()
        .then(() => {
          layer.pause();
          layer.currentTime = 0;
          return true;
        })
        .catch(() => false)
    );

    Promise.all(unlocks).then(results => {
      if (results.some(Boolean)) {
        audioPrimed = true;
        doc.removeEventListener('pointerdown', unlockAudio);
      }
    });
  }

  function unlockAudio() {
    primeChime();
  }

  doc.addEventListener('pointerdown', unlockAudio);

  function flashForBeep() {
    if (!flashOverlay) return;
    setFlashDuration();
    const duration = Number.isFinite(flashDurationMs) && flashDurationMs > 0 ? flashDurationMs : 800;
    flashOverlay.style.setProperty('--flash-duration', `${duration}ms`);
    flashOverlay.classList.remove('flash-active');
    // force reflow so the animation restarts even if beeps are close together
    void flashOverlay.offsetWidth;
    flashOverlay.classList.add('flash-active');
  }

  function playChime() {
    chimeLayers.forEach(layer => {
      layer.currentTime = 0;
      layer.play().catch(() => {});
    });
    flashForBeep();
    if (navigator.vibrate) navigator.vibrate(50);
  }

  qs('#btnJoinTestBeep')?.addEventListener('click', () => {
    primeChime();
    playChime();
  });
  qs('#btnTimerTestBeep')?.addEventListener('click', () => {
    primeChime();
    playChime();
  });

  const domCountdown = qs('#countdown');
  let timerRunning = false;
  let nextAt = 0;
  let base = 30;
  let start = 0;
  let rafId = null;
  let panic = false;
  let panicStart = 0;
  const PANIC_AFTER = 5 * 60 * 1000;
  const DISPLAY_LEAD_MS = 220;
  const CHIME_LEAD_MS = 220;
  const prestartSelector = '#screen-timer .prestart';
  let wakeLock = null;
  let gameId = null;

  function fmt(s) {
    return (
      String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
    );
  }

  function adaptive(now) {
    if (panic) return Math.max(0.4, (1 - (now - panicStart) / 420000) * 0.6 + 0.4);
    const mins = Math.floor((now - start) / 60000);
    return Math.max(3, base - 2 * mins);
  }

  function schedule(now) {
    nextAt = now + adaptive(now) * 1000;
  }

  function update(id) {
    if (!timerRunning || id !== gameId) return;

    const now = performance.now();
    if (!panic && now - start >= PANIC_AFTER) {
      panic = true;
      panicStart = now;
      body.classList.add('panic');
    }

    const left = Math.max(0, nextAt - now);
    const displayLeft = Math.max(0, left - DISPLAY_LEAD_MS);
    const chimeLeft = Math.max(0, left - CHIME_LEAD_MS);
    const sec = Math.ceil(displayLeft / 1000);
    domCountdown.textContent = fmt(sec);
    if (sec <= 10) domCountdown.classList.add('red');
    else domCountdown.classList.remove('red');
    if (chimeLeft <= 0) {
      playChime();
      schedule(now);
    }
    rafId = requestAnimationFrame(() => update(id));
  }

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
        if (timerRunning) requestWakeLock();
      });
    } catch (err) {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  function startGame() {
    primeChime();
    gameId = Date.now();
    timerRunning = true;
    start = performance.now();
    schedule(start);
    requestWakeLock();
    update(gameId);
  }

  function endGame() {
    timerRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    domCountdown.classList.remove('red');
    body.classList.remove('panic');
    flashOverlay?.classList.remove('flash-active');
    releaseWakeLock();
  }

  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible' && timerRunning) requestWakeLock();
  });

  function clearPrestart() {
    const prestart = qsa(prestartSelector);
    if (prestart.length) prestart.forEach(el => el.remove());
  }

  qs('#btnSlotContinue')?.addEventListener('click', () => {
    if (!rolledFinal) return;
    base = assignedSeconds;
    domCountdown.textContent = fmt(base);
    show('timer');
    body.classList.add('playing');
    clearPrestart();
    startGame();
  });

  qs('#play, #btnStart')?.addEventListener('click', () => {
    body.classList.add('playing');
    clearPrestart();
    startGame();
  });
}

function startApp() {
  const body = document.body;
  if (!body) {
    console.warn('startApp: document.body not ready');
    return;
  }
  wireUi(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
