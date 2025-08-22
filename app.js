// Hunted Web App (vanilla JS) — dark mode only, UK English
(() => {
  const qs = (s, p=document) => p.querySelector(s);
  const qsa = (s, p=document) => [...p.querySelectorAll(s)];
  const screens = {
    home: qs('#screen-home'),
    host: qs('#screen-host'),
    join: qs('#screen-join'),
    timer: qs('#screen-timer')
  };

  function show(name) {
    Object.values(screens).forEach(sc => sc.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name !== 'timer') document.body.classList.remove('playing');
  }

  // Logo → home
  qs('#logoBtn').addEventListener('click', () => {
    // Soft reset of view state; interval remains stored but no reroll allowed
    show('home');
  });

  // Home buttons
  qs('#btnHost').addEventListener('click', () => show('host'));
  qs('#btnJoin').addEventListener('click', () => show('join'));

  // Quick Rules modal
  const modal = qs('#modal');
  const btnQuickRules = qs('#btnQuickRules');
  btnQuickRules.addEventListener('click', () => {
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  });
  qsa('[data-close]').forEach(el => el.addEventListener('click', () => {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  // Host spinner (visual only, upgraded easing)
  const spinner = qs('#spinner');
  let spinning = false, spinAngle = 0;
  function randomSpinAngle() {
    const fullTurns = 4 + Math.floor(Math.random() * 4);   // 4–7 turns
    const extra = Math.random() * 360;                      // random stop
    return fullTurns * 360 + extra;
  }
  qs('#btnSpin').addEventListener('click', () => {
    if (spinning) return;
    spinning = true;
    const delta = randomSpinAngle();
    spinAngle += delta;
    spinner.style.transition = 'transform 2.8s cubic-bezier(.12,.73,.13,1)';
    spinner.style.transform = `rotate(${spinAngle}deg)`;
    setTimeout(() => {
      spinner.style.transition = 'none';
      spinning = false;
    }, 2900);
  });
  qs('#btnHostBack').addEventListener('click', () => show('home'));

  // Join: one-time slot machine spinner (no rerolls)
  const slotMin = qs('#slotMin');
  const slotSecT = qs('#slotSecT');
  const slotSecO = qs('#slotSecO');
  const btnSlotSpin = qs('#btnSlotSpin');
  const btnSlotContinue = qs('#btnSlotContinue');
  const btnJoinBack = qs('#btnJoinBack');

  let assignedSeconds = null;            // the rolled interval (0..120)
  let rolledFinal = false;               // prevents reroll within the session

  function cycle(el, values, durationMs, targetValue, fps=30) {
    return new Promise(resolve => {
      const interval = 1000 / fps;
      const end = Date.now() + durationMs;
      const len = values.length;
      let i = Math.floor(Math.random() * len);
      const tick = () => {
        if (Date.now() >= end) {
          el.textContent = String(targetValue);
          resolve(); return;
        }
        el.textContent = String(values[i % len]);
        i++;
        setTimeout(tick, interval);
      };
      tick();
    });
  }
  function pickRandom0to120() { return Math.floor(Math.random() * 121); } // inclusive

  btnSlotSpin.addEventListener('click', async () => {
    if (rolledFinal) return; // locked
    btnSlotSpin.disabled = true;

    assignedSeconds = pickRandom0to120();
    const m = Math.floor(assignedSeconds / 60);
    const s = assignedSeconds % 60;
    const sT = Math.floor(s / 10);
    const sO = s % 10;

    await Promise.all([
      cycle(slotMin, [0,1,2], 1200 + Math.random()*500, m),
      cycle(slotSecT, [0,1,2,3,4,5], 1500 + Math.random()*500, sT),
      cycle(slotSecO, [0,1,2,3,4,5,6,7,8,9], 1800 + Math.random()*500, sO)
    ]);

    rolledFinal = true;
    btnSlotContinue.disabled = false;

    // Persist so returning to Join cannot re-roll
    localStorage.setItem('assignedSeconds_final', String(assignedSeconds));
    localStorage.setItem('rolledFinal', '1');
  });

  btnJoinBack.addEventListener('click', () => show('home'));

  // If a previous final roll exists this session, lock controls
  const storedFinal = Number(localStorage.getItem('assignedSeconds_final'));
  const storedLock = localStorage.getItem('rolledFinal') === '1';
  if (storedLock && Number.isFinite(storedFinal)) {
    assignedSeconds = storedFinal;
    rolledFinal = true;
    const m = Math.floor(assignedSeconds/60), s = assignedSeconds % 60;
    slotMin.textContent = String(m);
    slotSecT.textContent = String(Math.floor(s/10));
    slotSecO.textContent = String(s%10);
    btnSlotSpin.disabled = true;
    btnSlotContinue.disabled = false;
  }

  // Timer (no pause/reset; after Start -> timer-only view)
  const domCountdown = qs('#countdown');
  const btnEnableAudio = qs('#btnEnableAudio');
  const btnStart = qs('#btnStart');

  let timerRunning = false;
  let nextAt = 0;
  let baseIntervalSeconds = 30;  // from roll
  let currentIntervalSeconds = 30;
  let startEpochMs = 0;
  let rafId = null;
  let wakeLock = null;
  let audioCtx = null;

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    if (audioCtx && audioCtx.state === 'suspended') return audioCtx.resume();
    return Promise.resolve();
  }

  function beep(durationMs=300, frequency=1200) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationMs/1000);
    osc.start(t);
    osc.stop(t + durationMs/1000);
    if (navigator.vibrate) navigator.vibrate(50);
    domCountdown.classList.add('red');
    setTimeout(() => domCountdown.classList.remove('red'), 250);
  }

  // Adaptive interval: every full minute since Start, -2s, floored at 20s
  function computeAdaptiveIntervalSeconds(nowMs) {
    const minutesPassed = Math.floor((nowMs - startEpochMs) / 60000);
    const reduced = baseIntervalSeconds - (2 * minutesPassed);
    return Math.max(20, reduced);
  }

  function scheduleNext(nowMs) {
    currentIntervalSeconds = computeAdaptiveIntervalSeconds(nowMs);
    nextAt = nowMs + currentIntervalSeconds * 1000;
  }

  function updateCountdown() {
    if (!timerRunning) return;
    const now = performance.now();
    const msLeft = Math.max(0, nextAt - now);
    const secLeft = Math.ceil(msLeft / 1000);
    domCountdown.textContent = fmt(secLeft);
    if (secLeft <= 10) domCountdown.classList.add('red'); else domCountdown.classList.remove('red');
    if (msLeft <= 0) {
      beep();
      // Recompute interval (in case another minute boundary has passed)
      scheduleNext(performance.now());
    }
    rafId = requestAnimationFrame(updateCountdown);
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch {}
  }

  // Move from Join -> Timer (one-way)
  qs('#btnSlotContinue').addEventListener('click', () => {
    if (!rolledFinal || assignedSeconds == null) return;
    baseIntervalSeconds = assignedSeconds;
    domCountdown.textContent = fmt(baseIntervalSeconds);
    show('timer');
  });

  // Pre-start controls
  btnEnableAudio.addEventListener('click', async () => {
    await ensureAudio();
    beep(120, 1000);
    btnEnableAudio.disabled = true;
  });

  btnStart.addEventListener('click', async () => {
    await ensureAudio();
    // Enter focused timer-only view
    document.body.classList.add('playing');

    // Hide prestart controls permanently
    qsa('#screen-timer .prestart').forEach(el => el.remove());

    // Start timing
    timerRunning = true;
    startEpochMs = performance.now();
    scheduleNext(startEpochMs);
    domCountdown.textContent = fmt(currentIntervalSeconds);
    rafId = requestAnimationFrame(updateCountdown);

    // Keep screen awake automatically
    requestWakeLock();
  });
})();
