// Hunted — spinner on notches; wall-clock catch-up; smooth panic; 3s floor; wake lock; MP3 chime

function wireUi(doc = document) {
  const body = doc.body;
  if (!body) {
    console.warn('wireUi: document.body not ready');
    return;
  }

  const qs = (selector, scope = doc) => scope.querySelector(selector);
  const qsa = (selector, scope = doc) => Array.from(scope.querySelectorAll(selector));
  const onClickAll = (selector, handler) => {
    qsa(selector).forEach(el => el.addEventListener('click', handler));
  };

  const btnEliminated = qs('#btnEliminated');
  const slotMin = qs('#slotMin');
  const slotSecT = qs('#slotSecT');
  const slotSecO = qs('#slotSecO');
  const btnSlotSpin = qs('#btnSlotSpin');
  const btnSlotContinue = qs('#btnSlotContinue');
  const flashOverlay = qs('.flash-overlay', body);

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

    if (activeScreen) activeScreen.classList.remove('active');
    activeScreen = target;
    activeScreen.classList.add('active');

    body.classList.toggle('home-active', name === 'home');
    if (name !== 'timer') body.classList.remove('playing');
    body.classList.toggle('timer-active', name === 'timer');
    if (name !== 'timer') resetEliminationState();
  }

  if (activeScreen) body.classList.add('home-active');

  onClickAll('#logoBtn', () => show('home'));

  const modal = qs('#modal');
  onClickAll('#btnQuickRules, #quickRules', () => modal?.classList.add('show'));
  onClickAll('[data-close], .modal-close', () => modal?.classList.remove('show'));

  btnEliminated?.addEventListener('click', () => {
    if (activeScreen === screens.timer) endGame();
    show('home');
  });

  resetEliminationState();

  btnEliminated?.addEventListener('pointerdown', startEliminateHold);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(eventName =>
    btnEliminated?.addEventListener(eventName, cancelEliminateHold)
  );

  resetEliminateHold();

  let assignedSeconds = null;
  let rolledFinal = false;

  let flashTimeout = null;
  let flashDurationMs = 800;

  const ELIMINATE_HOLD_MS = 1600;
  let eliminateRaf = null;
  let eliminateStart = 0;

  function resetEliminateHold() {
    if (eliminateRaf) cancelAnimationFrame(eliminateRaf);
    eliminateRaf = null;
    eliminateStart = 0;
    if (btnEliminated) {
      btnEliminated.classList.remove('holding');
      btnEliminated.style.setProperty('--fill', '0%');
    }
  }

  function resetEliminationState() {
    resetEliminateHold();
  }

  function completeElimination() {
    resetEliminateHold();
    show('home');
  }

  function updateEliminateHold() {
    if (!eliminateStart || !btnEliminated) return;
    const progress = Math.min(1, (performance.now() - eliminateStart) / ELIMINATE_HOLD_MS);
    btnEliminated.style.setProperty('--fill', `${Math.round(progress * 100)}%`);
    if (progress >= 1) {
      completeElimination();
      return;
    }
    eliminateRaf = requestAnimationFrame(updateEliminateHold);
  }

  function startEliminateHold(event) {
    event.preventDefault();
    resetEliminateHold();
    eliminateStart = performance.now();
    if (btnEliminated) btnEliminated.classList.add('holding');
    updateEliminateHold();
  }

  function cancelEliminateHold() {
    resetEliminateHold();
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

  onClickAll('#host, #btnHost', () => {
    resetGameState();
    show('host');
  });
  onClickAll('#join, #btnJoin', () => {
    resetGameState();
    show('join');
  });
  onClickAll('#btnJoinBack', () => show('home'));
  onClickAll('#btnHostBack', () => show('home'));

  const arrowRotor = qs('#arrowRotor');
  let spinning = false;
  let stepCount = 0;
  const STEP = 30;
  const SLOTS = 12;
  const stinger = new Audio('horror-stinger.mp3');
  stinger.preload = 'auto';
  stinger.volume = 1;

  const btnSpin = qs('#btnSpin');
  if (btnSpin) btnSpin.addEventListener('click', () => {
    if (!arrowRotor) return;
    if (spinning) return;
    spinning = true;
    stepCount = Math.round(stepCount);
    const spinDurationMs = 2800 + Math.random() * 1200;
    const turns = Math.floor(spinDurationMs / 700) + Math.floor(Math.random() * 2);
    const slot = Math.floor(Math.random() * SLOTS);
    stepCount += turns * SLOTS + slot;
    arrowRotor.style.transition = `transform ${Math.round(spinDurationMs)}ms cubic-bezier(.12,.72,.12,1)`;
    arrowRotor.style.transform = `translate(-50%,-50%) rotate(${stepCount * STEP}deg)`;
    setTimeout(() => {
      arrowRotor.style.transition = 'none';
      spinning = false;
      stinger.currentTime = 0;
      stinger.play().catch(() => {});
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

  const btnSlotSpinEl = qs('#btnSlotSpin');
  if (btnSlotSpinEl) btnSlotSpinEl.addEventListener('click', async () => {
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

  const chime = new Audio('chime.MP3');
  chime.preload = 'auto';
  chime.volume = 1;
  const chimeLayers = [chime.cloneNode(), chime.cloneNode(), chime];
  let chimeCursor = 0;
  chimeLayers.forEach(layer => {
    layer.preload = 'auto';
    layer.volume = 1;
    if (!layer.src) layer.src = 'chime.MP3';
    layer.load();
  });
  stinger.load();

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
    const unlocks = chimeLayers.map(layer => {
      const originalVolume = layer.volume;
      layer.volume = 0;
      return layer
        .play()
        .then(() => {
          layer.pause();
          layer.currentTime = 0;
          layer.volume = originalVolume;
          return true;
        })
        .catch(() => {
          layer.volume = originalVolume;
          return false;
        });
    });

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


    body.classList.add('flash-active');
    clearTimeout(flashTimeout);
    const duration = Number.isFinite(flashDurationMs) && flashDurationMs > 0 ? flashDurationMs : 800;
    flashTimeout = setTimeout(() => body.classList.remove('flash-active'), duration);


  }

  function playChime() {
    let layer = null;
    const startIndex = chimeCursor % chimeLayers.length;
    for (let i = 0; i < chimeLayers.length; i += 1) {
      const candidate = chimeLayers[(startIndex + i) % chimeLayers.length];
      if (candidate.paused) {
        layer = candidate;
        chimeCursor = (startIndex + i + 1) % chimeLayers.length;
        break;
      }
    }
    if (!layer) {
      layer = chimeLayers[startIndex];
      chimeCursor = (startIndex + 1) % chimeLayers.length;
    }
    layer.currentTime = 0;
    layer.play().catch(() => {});
    flashForBeep();
    if (navigator.vibrate) navigator.vibrate(50);
  }

  const btnJoinTestBeep = qs('#btnJoinTestBeep');
  if (btnJoinTestBeep) {
    btnJoinTestBeep.addEventListener('click', () => {
      primeChime();
      playChime();
    });
  }
  const btnTimerTestBeep = qs('#btnTimerTestBeep');
  if (btnTimerTestBeep) {
    btnTimerTestBeep.addEventListener('click', () => {
      primeChime();
      playChime();
    });
  }

  const domCountdown = qs('#countdown');
  const countdownShell = qs('#countdownShell');
  let timerRunning = false;
  let nextAt = 0;
  let lastAt = 0;
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
    lastAt = now;
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
    const interval = Math.max(1, nextAt - lastAt);
    const progress = Math.min(1, Math.max(0, 1 - left / interval));
    domCountdown.textContent = fmt(sec);
    if (sec <= 10) domCountdown.classList.add('red');
    else domCountdown.classList.remove('red');
    if (countdownShell) {
      countdownShell.style.setProperty('--ring-progress', progress.toFixed(3));
      countdownShell.style.setProperty('--ring-scale', (1 + progress * 0.04).toFixed(3));
      countdownShell.classList.toggle('intense', sec <= 10);
    }
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
    if (countdownShell) {
      countdownShell.classList.remove('intense');
      countdownShell.style.setProperty('--ring-progress', '0');
      countdownShell.style.setProperty('--ring-scale', '1');
    }

    body.classList.remove('flash-active');



    releaseWakeLock();
  }

  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible' && timerRunning) requestWakeLock();
  });

  function clearPrestart() {
    const prestart = qsa(prestartSelector);
    if (prestart.length) prestart.forEach(el => el.remove());
  }

  onClickAll('#btnSlotContinue', () => {
    if (!rolledFinal) return;
    base = assignedSeconds;
    domCountdown.textContent = fmt(base);
    show('timer');
    body.classList.add('playing');
    clearPrestart();
    startGame();
  });

  onClickAll('#play, #btnStart', () => {
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
