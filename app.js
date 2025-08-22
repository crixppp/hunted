// Hunted Web App (vanilla JS) — UK English
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
  }

  // Theme toggle
  const themeBtn = qs('#themeToggle');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') document.body.classList.add('light');
  themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
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

  // Host spinner
  const spinner = qs('#spinner');
  let spinning = false, spinAngle = 0;
  function randomSpinAngle() {
    const fullTurns = 3 + Math.floor(Math.random() * 4);
    const extra = Math.random() * 360;
    return fullTurns * 360 + extra;
  }
  qs('#btnSpin').addEventListener('click', () => {
    if (spinning) return;
    spinning = true;
    const delta = randomSpinAngle();
    spinAngle += delta;
    spinner.style.transition = 'transform 2.4s cubic-bezier(.2,.8,.1,1)';
    spinner.style.transform = `rotate(${spinAngle}deg)`;
    setTimeout(() => { spinner.style.transition = 'none'; spinning = false; }, 2500);
  });
  qs('#btnHostBack').addEventListener('click', () => show('home'));

  // Join slot spinner
  const slotMin = qs('#slotMin');
  const slotSecT = qs('#slotSecT');
  const slotSecO = qs('#slotSecO');
  const btnSlotSpin = qs('#btnSlotSpin');
  const btnSlotContinue = qs('#btnSlotContinue');
  const btnJoinBack = qs('#btnJoinBack');
  let assignedSeconds = null;

  function cycle(el, values, durationMs, targetValue, fps=30) {
    return new Promise(resolve => {
      const interval = 1000 / fps;
      const end = Date.now() + durationMs;
      const len = values.length;
      let i = Math.floor(Math.random() * len);
      const tick = () => {
        if (Date.now() >= end) { el.textContent = String(targetValue); resolve(); return; }
        el.textContent = String(values[i % len]); i++; setTimeout(tick, interval);
      };
      tick();
    });
  }
  function pickRandom0to120(){ return Math.floor(Math.random()*121); }

  btnSlotSpin.addEventListener('click', async () => {
    btnSlotContinue.disabled = true;
    assignedSeconds = pickRandom0to120();
    const m = Math.floor(assignedSeconds/60);
    const s = assignedSeconds%60;
    const sT = Math.floor(s/10), sO = s%10;
    await Promise.all([
      cycle(slotMin,[0,1,2],1200+Math.random()*500,m),
      cycle(slotSecT,[0,1,2,3,4,5],1500+Math.random()*500,sT),
      cycle(slotSecO,[0,1,2,3,4,5,6,7,8,9],1800+Math.random()*500,sO)
    ]);
    btnSlotContinue.disabled = false;
    localStorage.setItem('assignedSeconds', String(assignedSeconds));
  });
  btnJoinBack.addEventListener('click', () => show('home'));

  // Timer
  const domCountdown = qs('#countdown');
  const btnEnableAudio = qs('#btnEnableAudio');
  const btnStart = qs('#btnStart');
  const btnPause = qs('#btnPause');
  const btnReset = qs('#btnReset');
  const btnTestBeep = qs('#btnTestBeep');
  const btnChangeInterval = qs('#btnChangeInterval');
  const awakeStatus = qs('#awakeStatus');

  let timerRunning=false, nextAt=0, intervalSeconds=30, rafId=null;
  let wakeLock = null;

  // Audio
  let audioCtx=null;
  function ensureAudio(){
    if(!audioCtx){
      try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
    }
    if(audioCtx && audioCtx.state==='suspended') return audioCtx.resume();
    return Promise.resolve();
  }
  function beep(durationMs=300, frequency=1200){
    if(!audioCtx) return;
    const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
    osc.type='square'; osc.frequency.value=frequency;
    osc.connect(gain); gain.connect(audioCtx.destination);
    const t=audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001,t);
    gain.gain.exponentialRampToValueAtTime(0.5,t+0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001,t+durationMs/1000);
    osc.start(t); osc.stop(t+durationMs/1000);
    if(navigator.vibrate) navigator.vibrate(50);
    domCountdown.classList.add('red'); setTimeout(()=>domCountdown.classList.remove('red'),250);
  }
  function fmt(sec){ const m=Math.floor(sec/60), s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
  function updateCountdown(){
    if(!timerRunning) return;
    const now=performance.now();
    const msLeft=Math.max(0,nextAt-now);
    const secLeft=Math.ceil(msLeft/1000);
    domCountdown.textContent=fmt(secLeft);
    if(secLeft<=10) domCountdown.classList.add('red'); else domCountdown.classList.remove('red');
    if(msLeft<=0){ beep(); scheduleNext(); }
    rafId=requestAnimationFrame(updateCountdown);
  }
  function scheduleNext(){ nextAt=performance.now()+intervalSeconds*1000; }

  // Wake Lock toggle
  const keepAwakeBtn = qs('#keepAwake');
  async function enableWakeLock(){
    try{
      if('wakeLock' in navigator){
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', ()=>{ keepAwakeBtn.setAttribute('aria-pressed','false'); awakeStatus.textContent='Screen wake: released'; });
        keepAwakeBtn.setAttribute('aria-pressed','true');
        awakeStatus.textContent='Screen wake: active';
      }else{
        awakeStatus.textContent='Screen wake: not supported. Suggest disabling Auto-Lock in settings.';
      }
    }catch(e){
      awakeStatus.textContent='Screen wake: denied by browser/OS. Try keeping the screen on manually.';
    }
  }
  async function disableWakeLock(){
    try{ if(wakeLock){ await wakeLock.release(); wakeLock=null; } }catch{}
    keepAwakeBtn.setAttribute('aria-pressed','false');
    awakeStatus.textContent='Screen wake: released';
  }
  keepAwakeBtn.addEventListener('click', async ()=>{
    if(keepAwakeBtn.getAttribute('aria-pressed')==='true'){ await disableWakeLock(); }
    else{ await enableWakeLock(); }
  });
  document.addEventListener('visibilitychange', async () => {
    // Re-acquire on visibility change (common behaviour on Android)
    if(document.visibilityState==='visible' && keepAwakeBtn.getAttribute('aria-pressed')==='true' && !wakeLock){
      await enableWakeLock();
    }
  });

  function startTimer(){
    if(timerRunning) return;
    scheduleNext(); timerRunning=true;
    btnStart.disabled=true; btnPause.disabled=false;
    rafId=requestAnimationFrame(updateCountdown);
  }
  function pauseTimer(){
    if(!timerRunning) return;
    timerRunning=false; btnStart.disabled=false; btnPause.disabled=true;
    if(rafId) cancelAnimationFrame(rafId);
  }
  function resetTimer(){ pauseTimer(); domCountdown.textContent=fmt(intervalSeconds); domCountdown.classList.remove('red'); }

  btnEnableAudio.addEventListener('click', async ()=>{ await ensureAudio(); beep(120,1000); btnEnableAudio.disabled=true; });
  btnStart.addEventListener('click', async ()=>{ await ensureAudio(); startTimer(); });
  btnPause.addEventListener('click', pauseTimer);
  btnReset.addEventListener('click', resetTimer);
  btnTestBeep.addEventListener('click', async ()=>{ await ensureAudio(); beep(); });
  btnChangeInterval.addEventListener('click', ()=>{ pauseTimer(); show('join'); });

  qs('#btnSlotContinue').addEventListener('click', ()=>{
    if(assignedSeconds==null){
      const fromStore=Number(localStorage.getItem('assignedSeconds'));
      assignedSeconds=Number.isFinite(fromStore)?fromStore:30;
    }
    intervalSeconds=assignedSeconds;
    domCountdown.textContent=fmt(intervalSeconds);
    show('timer');
  });

  const stored = Number(localStorage.getItem('assignedSeconds'));
  if(Number.isFinite(stored)){
    const m=Math.floor(stored/60), s=stored%60;
    slotMin.textContent=String(m);
    slotSecT.textContent=String(Math.floor(s/10));
    slotSecO.textContent=String(s%10);
    assignedSeconds=stored;
    qs('#btnSlotContinue').disabled=false;
  }
})();
