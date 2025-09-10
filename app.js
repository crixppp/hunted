// Hunted — spinner on notches; wall-clock catch-up; smooth panic; 3s floor; wake lock; MP3 chime (overlapping)
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const qs  = (s, p=document) => p.querySelector(s);
  const qsa = (s, p=document) => Array.prototype.slice.call(p.querySelectorAll(s));

  const screens = {
    home:  qs('#screen-home'),
    host:  qs('#screen-host'),
    join:  qs('#screen-join'),
    timer: qs('#screen-timer')
  };

  function show(name) {
    if (screens.timer && screens.timer.classList.contains('active') && name !== 'timer') endGame();
    Object.keys(screens).forEach(k => { if (screens[k]) screens[k].classList.remove('active'); });
    if (screens[name]) screens[name].classList.add('active');
    document.body.classList.toggle('home-active', name === 'home');
    if (name !== 'timer') document.body.classList.remove('playing');
  }
  document.body.classList.add('home-active');

  // Header logo → Home
  const logoBtn = qs('#logoBtn');
  if (logoBtn) logoBtn.addEventListener('click', function(){ show('home'); });

  // Quick Rules modal
  const modal = qs('#modal');
  const btnQuickRules = qs('#btnQuickRules');
  if (btnQuickRules && modal) {
    btnQuickRules.addEventListener('click', function () {
      modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
    });
    qsa('[data-close]').forEach(function(el){
      el.addEventListener('click', function(){
        modal.classList.remove('show'); modal.setAttribute('aria-hidden','true');
      });
    });
    window.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        modal.classList.remove('show'); modal.setAttribute('aria-hidden','true');
      }
    });
  }

  // New game reset
  let assignedSeconds = null, rolledFinal = false;
  const slotMin = qs('#slotMin'), slotSecT = qs('#slotSecT'), slotSecO = qs('#slotSecO');
  const btnSlotSpin = qs('#btnSlotSpin'), btnSlotContinue = qs('#btnSlotContinue');

  function resetGameState() {
    try {
      localStorage.removeItem('assignedSeconds_final');
      localStorage.removeItem('rolledFinal');
    } catch {}
    assignedSeconds = null; rolledFinal = false;
    if (slotMin) slotMin.textContent = '0';
    if (slotSecT) slotSecT.textContent = '0';
    if (slotSecO) slotSecO.textContent = '0';
    if (btnSlotSpin) btnSlotSpin.disabled = false;
    if (btnSlotContinue) btnSlotContinue.disabled = true;
  }

  const btnHost = qs('#btnHost');
  if (btnHost) btnHost.addEventListener('click', function(){ resetGameState(); show('host'); });

  const btnJoin = qs('#btnJoin');
  if (btnJoin) btnJoin.addEventListener('click', function(){ resetGameState(); show('join'); });

  // Host spinner
  const arrowRotor = qs('#arrowRotor');
  const btnSpin = qs('#btnSpin');
  const btnHostBack = qs('#btnHostBack');
  let spinning = false, stepCount = 0;
  var SLOTS = 12, STEP = 360 / SLOTS;

  if (btnSpin && arrowRotor) {
    btnSpin.addEventListener('click', function(){
      if (spinning) return;
      spinning = true;
      stepCount = Math.round(stepCount);
      var fullTurns = 3 + Math.floor(Math.random() * 4);
      var slotIndex = Math.floor(Math.random() * SLOTS);
      var deltaSteps = fullTurns * SLOTS + slotIndex;
      stepCount += deltaSteps;
      var angle = stepCount * STEP;

      arrowRotor.style.transition = 'transform 3.0s cubic-bezier(.12,.72,.12,1)';
      arrowRotor.style.transform  = 'translate(-50%, -50%) rotate(' + angle + 'deg)';

      setTimeout(function(){
        arrowRotor.style.transition = 'none';
        spinning = false;
      }, 3100);
    });
  }
  if (btnHostBack) btnHostBack.addEventListener('click', function(){ show('home'); });

  // Slot machine roll
  function cycle(el, values, durationMs, targetValue, fps){
    fps = fps || 30;
    return new Promise(function(resolve){
      var interval = 1000 / fps;
      var end = Date.now() + durationMs;
      var len = values.length;
      var i = Math.floor(Math.random() * len);
      (function tick(){
        if (Date.now() >= end) { el.textContent = String(targetValue); resolve(); return; }
        el.textContent = String(values[i % len]); i++; setTimeout(tick, interval);
      })();
    });
  }
  function pickRandom0to120(){ return Math.floor(Math.random() * 121); }

  if (btnSlotSpin) btnSlotSpin.addEventListener('click', async function(){
    if (rolledFinal) return;
    btnSlotSpin.disabled = true;

    assignedSeconds = pickRandom0to120();
    var m = Math.floor(assignedSeconds/60), s = assignedSeconds % 60, sT = Math.floor(s/10), sO = s % 10;

    await Promise.all([
      slotMin  ? cycle(slotMin,  [0,1,2],                 1200 + Math.random()*500, m)  : Promise.resolve(),
      slotSecT ? cycle(slotSecT, [0,1,2,3,4,5],           1500 + Math.random()*500, sT) : Promise.resolve(),
      slotSecO ? cycle(slotSecO, [0,1,2,3,4,5,6,7,8,9],   1800 + Math.random()*500, sO) : Promise.resolve()
    ]);

    rolledFinal = true;
    if (btnSlotContinue) btnSlotContinue.disabled = false;
    try {
      localStorage.setItem('assignedSeconds_final', String(assignedSeconds));
      localStorage.setItem('rolledFinal', '1');
    } catch {}
  });

  const btnJoinBack = qs('#btnJoinBack');
  if (btnJoinBack) btnJoinBack.addEventListener('click', function(){ show('home'); });

  // Restore same-session roll
  try {
    const storedFinal = Number(localStorage.getItem('assignedSeconds_final'));
    const storedLock  = localStorage.getItem('rolledFinal') === '1';
    if (storedLock && isFinite(storedFinal)) {
      assignedSeconds = storedFinal; rolledFinal = true;
      var m = Math.floor(assignedSeconds/60), s = assignedSeconds % 60;
      if (slotMin)  slotMin.textContent = String(m);
      if (slotSecT) slotSecT.textContent = String(Math.floor(s/10));
      if (slotSecO) slotSecO.textContent = String(s%10);
      if (btnSlotSpin) btnSlotSpin.disabled = true;
      if (btnSlotContinue) btnSlotContinue.disabled = false;
    }
  } catch {}

  // ---------- Audio / Chime (overlapping) ----------
  function playChime() {
    // New Audio object each time → allows overlapping chimes
    const audio = new Audio('chime.mp3?v=1'); // cache-bust
    audio.preload = 'auto';
    audio.volume = 1.0;
    audio.play().catch(function(err){
      console.warn('Audio playback failed:', err);
    });
    if (navigator.vibrate) navigator.vibrate(50);
  }

  // Force any legacy playBeep/ensureAudio calls to use MP3
  window.playBeep   = function(){ try { playChime(); } catch(e) { console.warn(e); } };
  window.ensureAudio = async function(){ /* no-op; HTMLAudio doesn't need it */ };

  const btnJoinTestBeep  = qs('#btnJoinTestBeep');
  const btnTimerTestBeep = qs('#btnTimerTestBeep');
  if (btnJoinTestBeep)  btnJoinTestBeep.addEventListener('click',  function(){ playChime(); });
  if (btnTimerTestBeep) btnTimerTestBeep.addEventListener('click', function(){ playChime(); });

  // Timer lifecycle
  const domCountdown = qs('#countdown');
  const btnStart     = qs('#btnStart');

  let timerRunning = false, nextAt = 0, baseIntervalSeconds = 30, currentIntervalSeconds = 30;
  let startEpochMs = 0, rafId = null, wakeLock = null, activeGameId = null;
  let lastBeepAtMs = 0, panicMode = false, panicStartMs = 0;
  const PANIC_AFTER_MS = 5 * 60 * 1000;

  function panicInterval(nowMs){
    const elapsedSec = (nowMs - panicStartMs) / 1000;
    const START = 1.0, END = 0.4, DURATION = 420; // 7 minutes
    const p = Math.min(1, elapsedSec / DURATION);
    const easeOutQuad = 1 - (1 - p) * (1 - p);
    return START + (END - START) * easeOutQuad;
  }
  function fmt(sec){ var m=Math.floor(sec/60), s=sec%60; return (String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0')); }
  function adaptiveInterval(nowMs){
    if (panicMode) return panicInterval(nowMs);
    const minutes = Math.floor((nowMs - startEpochMs)/60000);
    return Math.max(3, baseIntervalSeconds - 2*minutes);
  }
  function scheduleNext(referenceMs){
    currentIntervalSeconds = adaptiveInterval(referenceMs);
    nextAt = referenceMs + currentIntervalSeconds*1000;
  }
  function isGameActive(localId){
    return document.body.classList.contains('playing') && timerRunning && activeGameId === localId;
  }
  function updateCountdown(localId){
    if (!isGameActive(localId)) return;
    const now = performance.now();

    if (!panicMode && (now - startEpochMs) >= PANIC_AFTER_MS) {
      panicMode = true; panicStartMs = now; document.body.classList.add('panic');
      scheduleNext(now);
      // “panic kick” triplet using the MP3
      playChime(); setTimeout(playChime, 140); setTimeout(playChime, 280);
    }

    const msLeft = Math.max(0, nextAt - now);
    const secLeft = Math.ceil(msLeft/1000);
    if (domCountdown) {
      domCountdown.textContent = fmt(secLeft);
      if (secLeft <= 10) domCountdown.classList.add('red'); else domCountdown.classList.remove('red');
    }
    if (msLeft <= 0) {
      if (isGameActive(localId)) playChime();
      lastBeepAtMs = nextAt;
      scheduleNext(lastBeepAtMs);
    }
    rafId = requestAnimationFrame(function(){ updateCountdown(localId); });
  }
  async function requestWakeLock(){
    try{ if ('wakeLock' in navigator){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', function(){ wakeLock=null; }); } }catch{}
  }
  function releaseWakeLock(){ try{ if (wakeLock){ wakeLock.release(); wakeLock=null; } }catch{} }

  function startGame(){
    activeGameId = Date.now() + '-' + Math.random().toString(36).slice(2);
    timerRunning = true; startEpochMs = performance.now(); lastBeepAtMs = startEpochMs; panicMode = false;
    document.body.classList.remove('panic');
    scheduleNext(lastBeepAtMs);
    if (domCountdown) domCountdown.textContent = fmt(currentIntervalSeconds);
    requestWakeLock();
    updateCountdown(activeGameId);
  }
  function endGame(){
    timerRunning = false; activeGameId = null;
    if (rafId) cancelAnimationFrame(rafId);
    releaseWakeLock();
    if (domCountdown) domCountdown.classList.remove('red');
    panicMode = false; document.body.classList.remove('panic');
  }

  document.addEventListener('visibilitychange', function(){
    if (!timerRunning) return;
    if (document.visibilityState === 'hidden') return;
    const now = performance.now();
    var missed = 0;
    while (now >= nextAt) { missed++; lastBeepAtMs = nextAt; scheduleNext(lastBeepAtMs); }
    if (missed > 0) { playChime(); } // subtle catch-up cue
    if (!rafId) updateCountdown(activeGameId);
  });

  // Join → Timer (manual; switch to auto-start if you prefer)
  if (btnSlotContinue) btnSlotContinue.addEventListener('click', function(){
    if (!rolledFinal || assignedSeconds == null) return;
    baseIntervalSeconds = assignedSeconds;
    if (domCountdown) domCountdown.textContent = fmt(baseIntervalSeconds);
    show('timer');
  });

  // Start the game (manual start button)
  const btnStart = qs('#btnStart');
  if (btnStart) btnStart.addEventListener('click', function(){
    document.body.classList.add('playing');
    qsa('#screen-timer .prestart').forEach(function(el){ el.parentNode && el.parentNode.removeChild(el); });
    startGame();
  });
});
