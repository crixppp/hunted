// Hunted — spinner lands exactly on notches; wall-clock catch-up; panic escalation; 3s floor; wake lock
(() => {
  const qs = (s, p=document) => p.querySelector(s);
  const qsa = (s, p=document) => [...p.querySelectorAll(s)];
  const screens = {
    home: qs('#screen-home'),
    host: qs('#screen-host'),
    join: qs('#screen-join'),
    timer: qs('#screen-timer')
  };

  // ---------- Navigation ----------
  function show(name) {
    const leavingTimer = screens.timer.classList.contains('active') && name !== 'timer';
    if (leavingTimer) endGame();

    Object.values(screens).forEach(sc => sc.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.body.classList.toggle('home-active', name === 'home');
    if (name !== 'timer') document.body.classList.remove('playing');
  }
  document.body.classList.add('home-active');

  // Header logo → Home
  qs('#logoBtn').addEventListener('click', () => show('home'));

  // ---------- Quick Rules modal ----------
  const modal = qs('#modal');
  qs('#btnQuickRules').addEventListener('click', () => {
    modal.classList.add('show'); modal.setAttribute('aria-hidden', 'false');
  });
  qsa('[data-close]').forEach(el => el.addEventListener('click', () => {
    modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true');
  }));
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true');
    }
  });

  // ---------- New game reset ----------
  function resetGameState() {
    localStorage.removeItem('assignedSeconds_final');
    localStorage.removeItem('rolledFinal');
    assignedSeconds = null;
    rolledFinal = false;
    if (slotMin) slotMin.textContent = '0';
    if (slotSecT) slotSecT.textContent = '0';
    if (slotSecO) slotSecO.textContent = '0';
    if (btnSlotSpin) btnSlotSpin.disabled = false;
    if (btnSlotContinue) btnSlotContinue.disabled = true;
  }

  // Home → start a NEW game flow
  qs('#btnHost').addEventListener('click', () => { resetGameState(); show('host'); });
  qs('#btnJoin').addEventListener('click', () => { resetGameState(); show('join'); });

  // ---------- Host spinner (arrow rotates; lands centred on a notch) ----------
  const arrowRotor = qs('#arrowRotor');
  let spinning = false;
  const SLOTS = 12;
  const STEP = 360 / SLOTS; // 30°
  let stepCount = 0;        // integer step index (ensures perfect notch alignment & clockwise motion)

  qs('#btnSpin').addEventListener('click', () => {
    if (spinning) return;
    spinning = true;

    // Ensure we start exactly on a notch (snap to integer steps)
    stepCount = Math.round(stepCount);

    // At least 3 full turns (3–6) + exact random notch (0..11)
    const fullTurns = 3 + Math.floor(Math.random() * 4); // 3,4,5,6
    const slotIndex = Math.floor(Math.random() * SLOTS); // end notch
    const deltaSteps = fullTurns * SLOTS + slotIndex;

    stepCount += deltaSteps; // strictly increasing → always clockwise
    const angle = stepCount * STEP;

    arrowRotor.style.transition = 'transform 3.0s cubic-bezier(.12,.72,.12,1)';
    arrowRotor.style.transform  = `translate(-50%, -50%) rotate(${angle}deg)`;

    setTimeout(() => {
      arrowRotor.style.transition = 'none';
      spinning = false;
    }, 3100);
  });

  qs('#btnHostBack').addEventListener('click', () => show('home'));

  // ---------- Join: one-time roll per game, reset on Home ----------
  const slotMin = qs('#slotMin');
  const slotSecT = qs('#slotSecT');
  const slotSecO = qs('#slotSecO');
  const btnSlotSpin = qs('#btnSlotSpin');
  const btnSlotContinue = qs('#btnSlotContinue');

  let assignedSeconds = null;
  let rolledFinal = false;

  function cycle(el, values, durationMs, targetValue, fps=30) {
    return new Promise(resolve => {
      const interval = 1000 / fps;
      const end = Date.now() + durationMs;
      const len = values.length;
      let i = Math.floor(Math.random() * len);
      (function tick(){
        if (Date.now() >= end) { el.textContent = String(targetValue); resolve(); return; }
        el.textContent = String(values[i % len]); i++; setTimeout(tick, interval);
      })();
    });
  }
  const pickRandom0to120 = () => Math.floor(Math.random() * 121);

  btnSlotSpin.addEventListener('click', async () => {
    if (rolledFinal) return;
    btnSlotSpin.disabled = true;

    assignedSeconds = pickRandom0to120();
    const m = Math.floor(assignedSeconds / 60);
    const s = assignedSeconds % 60;
    const sT = Math.floor(s / 10), sO = s % 10;

    await Promise.all([
      cycle(slotMin, [0,1,2], 1200 + Math.random()*500, m),
      cycle(slotSecT, [0,1,2,3,4,5], 1500 + Math.random()*500, sT),
      cycle(slotSecO, [0,1,2,3,4,5,6,7,8,9], 1800 + Math.random()*500, sO)
    ]);

    rolledFinal = true;
    btnSlotContinue.disabled = false;

    localStorage.setItem('assignedSeconds_final', String(assignedSeconds));
    localStorage.setItem('rolledFinal', '1');
  });

  qs('#btnJoinBack')?.addEventListener('click', () => show('home'));

  // Restore within the same game session (same page load)
  const storedFinal = Number(localStorage.getItem('assignedSeconds_final'));
  const storedLock  = localStorage.getItem('rolledFinal') === '1';
  if (storedLock && Number.isFinite(storedFinal)) {
    assignedSeconds = storedFinal; rolledFinal = true;
    const m = Math.floor(assignedSeconds/60), s = assignedSeconds % 60;
    slotMin.textContent = String(m);
    slotSecT.textContent = String(Math.floor(s/10));
    slotSecO.textContent = String(s%10);
    btnSlotSpin.disabled = true; btnSlotContinue.disabled = false;
  }

  // ---------- Audio / Beep ----------
  let audioCtx = null;
  async function ensureAudio() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
  }
  function playBeep(durationMs=300, frequency=1200) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type='square'; osc.frequency.value=frequency;
    osc.connect(gain); gain.connect(audioCtx.destination);
    const t=audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001,t);
    gain.gain.exponentialRampToValueAtTime(0.5,t+0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001,t+durationMs/1000);
    osc.start(t); osc.stop(t+durationMs/1000);
    if (navigator.vibrate) navigator.vibrate(50);
  }
  // Test beeps
  qs('#btnJoinTestBeep')?.addEventListener('click', async () => { await ensureAudio(); playBeep(200, 1000); });
  qs('#btnTimerTestBeep')?.addEventListener('click', async () => { await ensureAudio(); playBeep(200, 1000); });

  // ---------- Timer & Game lifecycle ----------
  const domCountdown = qs('#countdown');
  const btnStart = qs('#btnStart');

  let timerRunning = false;
  let nextAt = 0;
  let baseIntervalSeconds = 30;
  let currentIntervalSeconds = 30;
  let startEpochMs = 0;
  let rafId = null;
  let wakeLock = null;
  let activeGameId = null;

  // Wall-clock support
  let lastBeepAtMs = 0;   // last beep time (perf.now)
  let panicMode = false;
  const PANIC_AFTER_MS = 5 * 60 * 1000;
  let panicStartMs = 0;

  // Panic escalation thresholds (seconds between beeps)
  const PANIC_PHASES = [
    { t: 0,    interval: 1.0 },  // first 30s of panic → 1.0s
    { t: 30e3, interval: 0.75 }, // 30–60s → 0.75s
    { t: 60e3, interval: 0.5 }   // 60s+ → 0.5s
  ];

  const fmt = (sec) => {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  function panicInterval(nowMs){
    const elapsed = nowMs - panicStartMs;
    // find the last phase where elapsed >= t
    let phase = PANIC_PHASES[0].interval;
    for (let i=0;i<PANIC_PHASES.length;i++){
      if (elapsed >= PANIC_PHASES[i].t) phase = PANIC_PHASES[i].interval;
    }
    return phase;
  }

  function adaptiveInterval(nowMs){
    if (panicMode) return panicInterval(nowMs);
    const minutes = Math.floor((nowMs - startEpochMs) / 60000);
    return Math.max(3, baseIntervalSeconds - 2*minutes);
  }

  function scheduleNext(referenceMs){
    currentIntervalSeconds = adaptiveInterval(referenceMs);
    nextAt = referenceMs + currentIntervalSeconds * 1000;
  }

  function isGameActive(localId) {
    return document.body.classList.contains('playing') && timerRunning && activeGameId === localId;
  }

  function updateCountdown(localId){
    if (!isGameActive(localId)) return;
    const now = performance.now();

    // Enter panic mode after 5 minutes (once)
    if (!panicMode && (now - startEpochMs) >= PANIC_AFTER_MS) {
      panicMode = true;
      panicStartMs = now;
      document.body.classList.add('panic');
      scheduleNext(now); // reschedule immediately at faster rate
      (async () => {
        await ensureAudio();
        playBeep(120, 1200);
        setTimeout(() => playBeep(120, 1100), 140);
        setTimeout(() => playBeep(120, 1000), 280);
      })();
    }

    const msLeft = Math.max(0, nextAt - now);
    const secLeft = Math.ceil(msLeft / 1000);
    domCountdown.textContent = fmt(secLeft);
    if (secLeft <= 10) domCountdown.classList.add('red'); else domCountdown.classList.remove('red');

    if (msLeft <= 0) {
      if (isGameActive(localId)) playBeep();
      lastBeepAtMs = nextAt;
      scheduleNext(lastBeepAtMs);
    }
    rafId = requestAnimationFrame(() => updateCountdown(localId));
  }

  async function requestWakeLock(){
    try{
      if('wakeLock' in navigator){
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release',()=>{wakeLock=null;});
      }
    }catch{}
  }
  function releaseWakeLock(){ try{ if(wakeLock){ wakeLock.release(); wakeLock=null; } }catch{} }

  function startGame() {
    activeGameId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    timerRunning = true;
    startEpochMs = performance.now();
    lastBeepAtMs = startEpochMs;
    panicMode = false;
    document.body.classList.remove('panic');

    scheduleNext(lastBeepAtMs);
    domCountdown.textContent = fmt(currentIntervalSeconds);
    requestWakeLock();
    updateCountdown(activeGameId);
  }

  function endGame() {
    timerRunning = false;
    activeGameId = null;
    if (rafId) cancelAnimationFrame(rafId);
    releaseWakeLock();
    domCountdown.classList.remove('red');
    panicMode = false;
    document.body.classList.remove('panic');
  }

  // Stop beeping when tab hidden, but catch up on return
  document.addEventListener('visibilitychange', async () => {
    if (!timerRunning) return;

    if (document.visibilityState === 'hidden') {
      // Just note the time; animation frame will stop naturally
      return;
    }

    // We became visible again – catch up using wall-clock time
    const now = performance.now();

    // Walk forward through any missed beeps; recompute interval each step
    let missed = 0;
    while (now >= nextAt) {
      missed++;
      lastBeepAtMs = nextAt;
      scheduleNext(lastBeepAtMs);
    }

    if (missed > 0) {
      await ensureAudio();
      playBeep(180, 1100); // subtle catch-up cue
    }

    if (!rafId) updateCountdown(activeGameId);
  });

  // Join → Timer
  qs('#btnSlotContinue').addEventListener('click', () => {
    if (!rolledFinal || assignedSeconds == null) return;
    baseIntervalSeconds = assignedSeconds;
    domCountdown.textContent = fmt(baseIntervalSeconds);
    show('timer');
  });

  // Start the game: hide extras, keep only countdown
  const btnStart = qs('#btnStart');
  btnStart.addEventListener('click', async ()=>{
    await ensureAudio();
    document.body.classList.add('playing');
    qsa('#screen-timer .prestart').forEach(el => el.remove());
    startGame();
  });
})();
