// Hunted Web App — dark mode only, improved spinner & centred logo on home
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

    // Toggle layout classes
    if (name === 'home') {
      document.body.classList.add('page-home');
      document.body.classList.remove('playing');
    } else {
      document.body.classList.remove('page-home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Logo → home
  qs('#logoBtn').addEventListener('click', () => show('home'));

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

  // ==== Host spinner (nicer dial) ====
  const spinner = qs('#spinner');
  const face = qs('#spinnerFace');

  // Build 24 ticks (every 15°), with majors every 90° (0,90,180,270) and mediums every 45°
  const TOTAL_TICKS = 24; // 360/15
  for (let i = 0; i < TOTAL_TICKS; i++) {
    const tick = document.createElement('div');
    tick.className = 'tick';
    const deg = i * 15;
    if (deg % 90 === 0) tick.classList.add('major');
    face.appendChild(tick);
    tick.style.transform = `translate(-1px,-126px) rotate(${deg}deg)`;
  }

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
    spinner.style.transition = 'transform 2.9s cubic-bezier(.12,.73,.13,1)';
    spinner.style.transform = `rotate(${spinAngle}deg)`;
    setTimeout(() => { spinner.style.transition = 'none'; spinning = false; }, 2950);
  });
  qs('#btnHostBack').addEventListener('click', () => show('home'));

  // ==== Join: one-time slot machine spinner (no rerolls) ====
  const slotMin = qs('#slotMin');
  const slotSecT = qs('#slotSecT');
  const slotSecO = qs('#slotSecO');
  const btnSlotSpin = qs('#btnSlotSpin');
  const btnSlotContinue = qs('#btnSlotContinue');
  const btnJoinBack = qs('#btnJoinBack');

  let assignedSeconds = null;            // rolled interval (0..120)
  let rolledFinal = false;               // prevents reroll

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
  const pickRandom0to120 = () => Math.floor(Math.random() * 121);

  btnSlotSpin.addEventListener('click', async () => {
    if (rolledFinal) return;
    btnSlotSpin.disabled = true;

    assignedSeconds = pickRandom0to120();
    const m = Math.floor(assignedSeconds/60), s = assignedSeconds%60;
    const sT = Math.floor(s/10), sO = s%10;

    await Promise.all([
      cycle(slotMin,[0,1,2],1200+Math.random()*500,m),
      cycle(slotSecT,[0,1,2,3,4,5],1500+Math.random()*500
