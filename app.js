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
  let flashDurationMs = 500;

  flashOverlay?.addEventListener('animationend', () => {
    flashOverlay.classList.remove('flash-active');
  });

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

  function setFlashDuration() {
    if (Number.isFinite(chime.duration) && chime.duration > 0) {
      const adjusted = chime.duration * 1000 - 800;
      flashDurationMs = Math.max(200, adjusted);
    }
  }
  chime.addEventListener('loadedmetadata', setFlashDuration);
  setFlashDuration();

  let audioPrimed = false;
  function primeChime() {
    if (audioPrimed) return;
    chimeLayers.forEach(layer => {
      layer
        .play()
        .then(() => {
          layer.pause();
          layer.currentTime = 0;
          audioPrimed = true;
        })
        .catch(() => {});
    });
  }

  function unlockAudio() {
    chimeLayers.forEach(layer => {
      layer
        .play()
        .then(() => {
          layer.pause();
          layer.currentTime = 0;
        })
        .catch(() => {});
    });

    doc.removeEventListener('pointerdown', unlockAudio);
  }

  doc.addEventListener('pointerdown', unlockAudio);

  function flashForBeep() {
    if (!flashOverlay) return;
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
