// Hunted — spinner on notches; wall-clock catch-up; smooth panic; 3s floor; wake lock; MP3 chime
document.addEventListener('DOMContentLoaded', () => {
  const qs = (s, p=document) => p.querySelector(s);
  const qsa = (s, p=document) => [...p.querySelectorAll(s)];

  const screens = {
    home: qs('#screen-home'),
    host: qs('#screen-host'),
    join: qs('#screen-join'),
    timer: qs('#screen-timer')
  };

  let activeScreen = screens.home;

  function show(name) {
    if (activeScreen === screens.timer && name !== 'timer') endGame();
    if (activeScreen === screens[name]) return;
    activeScreen.classList.remove('active');
    activeScreen = screens[name];
    activeScreen.classList.add('active');
    document.body.classList.toggle('home-active', name === 'home');
    if (name !== 'timer') document.body.classList.remove('playing');
  }
  document.body.classList.add('home-active');

  // Header logo → home
  qs('#logoBtn').addEventListener('click', () => show('home'));

  // Quick Rules modal
  const modal = qs('#modal');
  qs('#btnQuickRules').addEventListener('click', () => { modal.classList.add('show'); });
  qsa('[data-close]').forEach(el => el.addEventListener('click', () => modal.classList.remove('show')));

  // Reset game state
  let assignedSeconds = null, rolledFinal = false;
  const slotMin = qs('#slotMin'), slotSecT = qs('#slotSecT'), slotSecO = qs('#slotSecO');
  const btnSlotSpin = qs('#btnSlotSpin'), btnSlotContinue = qs('#btnSlotContinue');

  function resetGameState() {
    try {
      localStorage.clear();
    } catch (err) {
      console.warn('Unable to access storage; continuing without clearing state', err);
    }
    assignedSeconds = null; rolledFinal = false;
    slotMin.textContent = '0'; slotSecT.textContent = '0'; slotSecO.textContent = '0';
    btnSlotSpin.disabled = false; btnSlotContinue.disabled = true;
  }

  qs('#btnHost').addEventListener('click', () => { resetGameState(); show('host'); });
  qs('#btnJoin').addEventListener('click', () => { resetGameState(); show('join'); });
  qs('#btnJoinBack').addEventListener('click', () => show('home'));
  qs('#btnHostBack').addEventListener('click', () => show('home'));

  // Spinner
  const arrowRotor = qs('#arrowRotor'); let spinning=false, stepCount=0;
  const STEP=30, SLOTS=12;
  qs('#btnSpin').addEventListener('click', () => {
    if (spinning) return; spinning=true;
    stepCount = Math.round(stepCount);
    const turns = 3+Math.floor(Math.random()*4), slot=Math.floor(Math.random()*SLOTS);
    stepCount += turns*SLOTS+slot;
    arrowRotor.style.transition='transform 3s cubic-bezier(.12,.72,.12,1)';
    arrowRotor.style.transform=`translate(-50%,-50%) rotate(${stepCount*STEP}deg)`;
    setTimeout(()=>{arrowRotor.style.transition='none';spinning=false;},3100);
  });

  // Slot spin
  function cycle(el, vals, dur, target) {
    return new Promise(res=>{
      const end=Date.now()+dur; let i=0;
      (function tick(){ if(Date.now()>=end){el.textContent=target;res();return;}
        el.textContent=vals[i%vals.length];i++;setTimeout(tick,50);})();});
  }
  qs('#btnSlotSpin').addEventListener('click', async ()=>{
    if(rolledFinal) return;
    btnSlotSpin.disabled=true;
    assignedSeconds=Math.floor(Math.random()*121);
    const m=Math.floor(assignedSeconds/60), s=assignedSeconds%60;
    await Promise.all([
      cycle(slotMin,[0,1,2],1200,m),
      cycle(slotSecT,[0,1,2,3,4,5],1500,Math.floor(s/10)),
      cycle(slotSecO,[0,1,2,3,4,5,6,7,8,9],1800,s%10)
    ]);
    rolledFinal=true; btnSlotContinue.disabled=false;
  });

  // Audio — MP3 chime (overlapping)
  const chimeLayers = [new Audio('chime.mp3'), new Audio('chime.mp3')];
  chimeLayers.forEach(layer => { layer.preload = 'auto'; layer.volume = 1; layer.crossOrigin = 'anonymous'; layer.playsInline = true; });

  // Unlock audio on first user gesture so timer-driven plays aren't blocked.
  let audioPrimed = false;
  function primeChime(){
    if(audioPrimed) return;
    chimeLayers.forEach(layer => {
      layer.play().then(()=>{ layer.pause(); layer.currentTime = 0; audioPrimed = true; }).catch(()=>{});
    });
  }

  function unlockAudio(){
    primeChime();
    document.removeEventListener('pointerdown', unlockAudio);
  }
  document.addEventListener('pointerdown', unlockAudio);

  function playChime(){
    primeChime();
    chimeLayers.forEach(layer => { layer.currentTime = 0; layer.play().catch(()=>{}); });
    if(navigator.vibrate)navigator.vibrate(50);
  }

  qs('#btnJoinTestBeep').addEventListener('click', ()=>{ primeChime(); playChime(); });
  qs('#btnTimerTestBeep').addEventListener('click', ()=>{ primeChime(); playChime(); });

  // Timer
  const domCountdown=qs('#countdown'); let timerRunning=false,nextAt=0,base=30,start=0,rafId=null,panic=false,panicStart=0;
  const PANIC_AFTER=5*60*1000;
  const DISPLAY_LEAD_MS = 220;
  const CHIME_LEAD_MS = 220;
  const prestartSelector = '#screen-timer .prestart';
  let wakeLock = null;
  let wakeFallback = null;
  let wakeFallbackResume = null;

  function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
  function adaptive(now){if(panic)return Math.max(0.4,(1-((now-panicStart)/420000))*0.6+0.4);const mins=Math.floor((now-start)/60000);return Math.max(3,base-2*mins);}
  function schedule(now){nextAt=now+adaptive(now)*1000;}
  function update(id){
    if(!timerRunning||id!==gameId)return;
    let now=performance.now();
    if(!panic&&now-start>=PANIC_AFTER){panic=true;panicStart=now;document.body.classList.add('panic');}

    let guard=0;
    while(nextAt-now<=CHIME_LEAD_MS&&guard<6){
      playChime();
      schedule(now);
      guard++;
      now=performance.now();
    }

    const left=Math.max(0,nextAt-now);
    const displayLeft=Math.max(0,left-DISPLAY_LEAD_MS);
    const sec=Math.ceil(displayLeft/1000);
    domCountdown.textContent=fmt(sec);
    if(sec<=10)domCountdown.classList.add('red'); else domCountdown.classList.remove('red');
    rafId=requestAnimationFrame(()=>update(id));
  }
  let gameId=null;
  async function requestWakeLock(){
    if(!('wakeLock' in navigator)) return false;
    try{
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release',()=>{wakeLock=null; if(timerRunning) keepScreenAwake();});
      return true;
    }catch(err){
      wakeLock=null;
      return false;
    }
  }
  function startWakeFallback(){
    if(wakeFallback) return;
    wakeFallback = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YQAAAAA=');
    wakeFallback.loop = true;
    wakeFallback.muted = true;
    wakeFallback.playsInline = true;
    wakeFallback.play().catch(()=>{
      wakeFallbackResume = () => {
        wakeFallback && wakeFallback.play().catch(()=>{});
        document.removeEventListener('pointerdown', wakeFallbackResume);
        wakeFallbackResume = null;
      };
      document.addEventListener('pointerdown', wakeFallbackResume, { once:true });
    });
  }
  function stopWakeFallback(){
    if(!wakeFallback) return;
    if(wakeFallbackResume){
      document.removeEventListener('pointerdown', wakeFallbackResume);
      wakeFallbackResume = null;
    }
    wakeFallback.pause();
    wakeFallback.currentTime = 0;
    wakeFallback = null;
  }
  function releaseWakeLock(){ if(wakeLock){ wakeLock.release().catch(()=>{}); wakeLock=null; } }
  async function keepScreenAwake(){ const locked = await requestWakeLock(); if(!locked) startWakeFallback(); }
  function relaxScreenAwake(){ releaseWakeLock(); stopWakeFallback(); }
  function startGame(){
    primeChime();
    panic=false;panicStart=0;
    gameId=Date.now();timerRunning=true;start=performance.now();
    schedule(start);
    keepScreenAwake();
    update(gameId);
  }
  function endGame(){
    timerRunning=false;
    panic=false;panicStart=0;
    if(rafId)cancelAnimationFrame(rafId);
    domCountdown.classList.remove('red');
    document.body.classList.remove('panic');
    relaxScreenAwake();
  }

  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && timerRunning) keepScreenAwake(); });

  function clearPrestart(){
    const prestart = qsa(prestartSelector);
    if(prestart.length) prestart.forEach(el=>el.remove());
  }

  qs('#btnSlotContinue').addEventListener('click',()=>{if(!rolledFinal)return;base=assignedSeconds;domCountdown.textContent=fmt(base);show('timer');document.body.classList.add('playing');clearPrestart();startGame();});
  qs('#btnStart').addEventListener('click',()=>{document.body.classList.add('playing');clearPrestart();startGame();});
});
