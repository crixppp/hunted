(() => {
  'use strict';

  const TIMER_STATE_KEY = 'hunted.timerState';
  const TIMER_STATE_VERSION = 2;
  const PANIC_AFTER_MS = 5 * 60 * 1000;
  const PANIC_RAMP_MS = 7 * 60 * 1000;
  const NORMAL_FLOOR_SECONDS = 3;
  const PANIC_START_SECONDS = 1;
  const PANIC_FLOOR_SECONDS = 0.4;
  const CHIME_LEAD_MS = 140;
  const DISPLAY_LEAD_MS = 160;
  const HOLD_TO_ELIMINATE_MS = 1600;
  const FALLBACK_QUERY = 'huntedFallbackAudio';
  const BROWSER_NOTICE_DISMISSED_KEY = 'hunted.browserNoticeDismissed';
  const IN_APP_BROWSER_PATTERN = /(FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|Bytedance|musical_ly|Snapchat|Twitter|LinkedInApp|Pinterest|Reddit|Discord|WhatsApp|; wv\)|\bwv\b)/i;

  const doc = document;
  const body = doc.body;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const qs = (selector, scope = doc) => scope.querySelector(selector);
  const qsa = (selector, scope = doc) => Array.from(scope.querySelectorAll(selector));
  const byId = id => doc.getElementById(id);
  const on = (target, eventName, handler, options) => {
    if (target) target.addEventListener(eventName, handler, options);
  };

  const els = {
    screens: {
      home: byId('screen-home'),
      host: byId('screen-host'),
      join: byId('screen-join'),
      timer: byId('screen-timer')
    },
    logoBtn: byId('logoBtn'),
    hostBtn: byId('host'),
    joinBtn: byId('join'),
    hostBackBtn: byId('btnHostBack'),
    joinBackBtn: byId('btnJoinBack'),
    quickRulesBtn: byId('quickRules'),
    modal: byId('modal'),
    spinBtn: byId('btnSpin'),
    arrowRotor: byId('arrowRotor'),
    spinner: qs('.spinner'),
    slotMin: byId('slotMin'),
    slotSecT: byId('slotSecT'),
    slotSecO: byId('slotSecO'),
    slotSpinBtn: byId('btnSlotSpin'),
    slotThirtyBtn: byId('btnSlotThirty'),
    slotContinueBtn: byId('btnSlotContinue'),
    joinTestBeepBtn: byId('btnJoinTestBeep'),
    timerTestBeepBtn: byId('btnTimerTestBeep'),
    startBtn: byId('play'),
    tensionMeter: byId('tensionMeter'),
    countdown: byId('countdown'),
    timerStatus: byId('timerStatus'),
    audioStatus: byId('audioStatus'),
    wakeStatus: byId('wakeStatus'),
    eliminatedBtn: byId('btnEliminated'),
    flashOverlay: qs('.flash-overlay'),
    browserNotice: byId('browserNotice'),
    browserNoticeText: byId('browserNoticeText'),
    browserOpenBtn: byId('browserOpenBtn'),
    browserCopyBtn: byId('browserCopyBtn'),
    browserCloseBtn: byId('browserCloseBtn')
  };

  const state = {
    activeScreen: 'home',
    assignedSeconds: null,
    rolledFinal: false,
    slotSpinning: false,
    spinnerSteps: 0,
    spinnerBusy: false,
    timer: null,
    timerRaf: null,
    restoredTimer: false,
    wakeLock: null,
    eliminateRaf: null,
    eliminateStartedAt: 0
  };

  function formatSeconds(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function setStatus(el, value, mode) {
    if (!el) return;
    el.textContent = value;
    if (mode) el.dataset.state = mode;
  }

  function readStoredTimer() {
    try {
      const raw = window.localStorage.getItem(TIMER_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== TIMER_STATE_VERSION) return null;
      if (!Number.isFinite(parsed.baseSeconds) || !Number.isFinite(parsed.startedAt)) return null;
      if (!Number.isFinite(parsed.nextBeepAt) || parsed.nextBeepAt <= 0) return null;
      return parsed;
    } catch (error) {
      console.warn('Unable to read timer state', error);
      return null;
    }
  }

  function saveTimerState() {
    if (!state.timer) return;
    try {
      window.localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state.timer));
    } catch (error) {
      console.warn('Unable to save timer state', error);
    }
  }

  function clearTimerState() {
    try {
      window.localStorage.removeItem(TIMER_STATE_KEY);
    } catch (error) {
      console.warn('Unable to clear timer state', error);
    }
  }

  function getSessionFlag(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function setSessionFlag(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (error) {
      // Session storage is optional; the notice can still work without it.
    }
  }

  function isStandaloneApp() {
    return Boolean(
      window.navigator.standalone ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  }

  function isLikelyInAppBrowser() {
    return !isStandaloneApp() && IN_APP_BROWSER_PATTERN.test(window.navigator.userAgent || '');
  }

  function buildAndroidIntentUrl() {
    const currentUrl = new URL(window.location.href);
    const scheme = currentUrl.protocol.replace(':', '');
    const destination = `${currentUrl.host}${currentUrl.pathname}${currentUrl.search}`;
    return `intent://${destination}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(currentUrl.href)};end`;
  }

  function isAndroid() {
    return /Android/i.test(window.navigator.userAgent || '');
  }

  function openPhoneBrowser(event) {
    event.preventDefault();

    if (isAndroid() && /^https?:$/.test(window.location.protocol)) {
      window.location.href = buildAndroidIntentUrl();
      return;
    }

    window.open(window.location.href, '_blank', 'noopener');
    if (els.browserNoticeText) {
      els.browserNoticeText.textContent = 'If this stays in-app, copy the link and open it in your browser.';
    }
  }

  async function copyBrowserLink() {
    const originalLabel = els.browserCopyBtn ? els.browserCopyBtn.textContent : '';

    try {
      await window.navigator.clipboard.writeText(window.location.href);
      if (els.browserCopyBtn) els.browserCopyBtn.textContent = 'Copied';
    } catch (error) {
      if (els.browserNoticeText) {
        els.browserNoticeText.textContent = 'Copy the address from the menu, then open it in your browser.';
      }
    }

    if (els.browserCopyBtn && originalLabel) {
      window.setTimeout(() => {
        els.browserCopyBtn.textContent = originalLabel;
      }, 1600);
    }
  }

  function dismissBrowserNotice() {
    if (els.browserNotice) els.browserNotice.hidden = true;
    body.classList.remove('in-app-browser');
    setSessionFlag(BROWSER_NOTICE_DISMISSED_KEY, '1');
  }

  function initBrowserNotice() {
    if (!els.browserNotice || getSessionFlag(BROWSER_NOTICE_DISMISSED_KEY) === '1') return;
    if (!isLikelyInAppBrowser()) return;

    body.classList.add('in-app-browser');
    els.browserNotice.hidden = false;
  }

  function showScreen(name) {
    const target = els.screens[name];
    if (!target || state.activeScreen === name) return;

    Object.entries(els.screens).forEach(([screenName, screen]) => {
      if (!screen) return;
      screen.classList.toggle('active', screenName === name);
    });

    state.activeScreen = name;
    body.dataset.screen = name;
    body.classList.toggle('home-active', name === 'home');
    body.classList.toggle('timer-active', name === 'timer');

    if (name !== 'timer') resetEliminationHold();
  }

  function openModal() {
    if (!els.modal) return;
    els.modal.classList.add('show');
    els.modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    if (!els.modal) return;
    els.modal.classList.remove('show');
    els.modal.setAttribute('aria-hidden', 'true');
  }

  function resetSlotState() {
    state.assignedSeconds = null;
    state.rolledFinal = false;
    state.slotSpinning = false;
    updateSlotDisplay(0);
    if (els.slotSpinBtn) els.slotSpinBtn.disabled = false;
    if (els.slotThirtyBtn) els.slotThirtyBtn.disabled = false;
    if (els.slotContinueBtn) els.slotContinueBtn.disabled = true;
  }

  function startFreshSetup(screenName) {
    stopTimer({ clear: true });
    resetSlotState();
    body.classList.remove('playing');
    showScreen(screenName);
  }

  function updateSlotDisplay(totalSeconds) {
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    if (els.slotMin) els.slotMin.textContent = String(Math.floor(seconds / 60));
    if (els.slotSecT) els.slotSecT.textContent = String(Math.floor((seconds % 60) / 10));
    if (els.slotSecO) els.slotSecO.textContent = String(seconds % 10);
  }

  function setAssignedInterval(totalSeconds) {
    state.assignedSeconds = Math.max(0, Math.min(120, Number(totalSeconds) || 0));
    state.rolledFinal = true;
    updateSlotDisplay(state.assignedSeconds);
    if (els.slotSpinBtn) els.slotSpinBtn.disabled = true;
    if (els.slotThirtyBtn) els.slotThirtyBtn.disabled = true;
    if (els.slotContinueBtn) els.slotContinueBtn.disabled = false;
  }

  function cycleDigit(el, values, durationMs, targetValue) {
    if (!el || prefersReducedMotion || durationMs <= 0) {
      if (el) el.textContent = String(targetValue);
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const startedAt = performance.now();
      let frame = 0;

      function tick(now) {
        if (now - startedAt >= durationMs) {
          el.textContent = String(targetValue);
          resolve();
          return;
        }

        el.textContent = String(values[frame % values.length]);
        frame += 1;
        window.setTimeout(() => window.requestAnimationFrame(tick), 44);
      }

      window.requestAnimationFrame(tick);
    });
  }

  async function spinSlot() {
    if (state.rolledFinal || state.slotSpinning) return;
    state.slotSpinning = true;
    if (els.slotSpinBtn) els.slotSpinBtn.disabled = true;
    if (els.slotThirtyBtn) els.slotThirtyBtn.disabled = true;

    const chosenSeconds = Math.floor(Math.random() * 121);
    const mins = Math.floor(chosenSeconds / 60);
    const secs = chosenSeconds % 60;

    await Promise.all([
      cycleDigit(els.slotMin, [0, 1, 2], 1050, mins),
      cycleDigit(els.slotSecT, [0, 1, 2, 3, 4, 5], 1300, Math.floor(secs / 10)),
      cycleDigit(els.slotSecO, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 1550, secs % 10)
    ]);

    state.slotSpinning = false;
    setAssignedInterval(chosenSeconds);
  }

  function createAudioController() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const forceFallback = new URLSearchParams(window.location.search).has(FALLBACK_QUERY);
    const chimeSource = forceFallback ? 'missing-chime.MP3' : 'chime.MP3';
    const stingerSource = forceFallback ? 'missing-stinger.mp3' : 'horror-stinger.mp3';
    const chimeLayers = [0, 1, 2].map(() => buildAudio(chimeSource, 0.92));
    const stinger = buildAudio(stingerSource, 0.9);
    let audioContext = null;
    let gainNode = null;
    let connectedElements = false;
    let chimeCursor = 0;
    let flashTimeout = null;
    let primed = false;
    let fallbackOnly = false;

    function buildAudio(src, volume) {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = volume;
      on(audio, 'error', () => {
        fallbackOnly = true;
        setStatus(els.audioStatus, 'Visual and vibration cue ready', 'warn');
      });
      return audio;
    }

    function settlePlayback(playPromise, timeoutMs = 600) {
      if (!playPromise || typeof playPromise.then !== 'function') return Promise.resolve(true);

      return Promise.race([
        playPromise.then(() => true).catch(() => false),
        new Promise(resolve => window.setTimeout(() => resolve(false), timeoutMs))
      ]);
    }

    function ensureAudioContext() {
      if (!AudioContextCtor) return null;
      if (!audioContext) {
        try {
          audioContext = new AudioContextCtor();
          gainNode = audioContext.createGain();
          gainNode.gain.value = 1.35;
          gainNode.connect(audioContext.destination);
        } catch (error) {
          audioContext = null;
          gainNode = null;
          return null;
        }
      }

      if (!connectedElements && gainNode) {
        try {
          chimeLayers.concat(stinger).forEach(audio => {
            const source = audioContext.createMediaElementSource(audio);
            source.connect(gainNode);
          });
          connectedElements = true;
        } catch (error) {
          connectedElements = false;
        }
      }

      return audioContext;
    }

    async function resumeContext() {
      const context = ensureAudioContext();
      if (!context) return false;
      if (context.state === 'suspended') {
        try {
          await context.resume();
        } catch (error) {
          return false;
        }
      }
      return context.state === 'running';
    }

    async function prime() {
      if (forceFallback) {
        fallbackOnly = true;
        setStatus(els.audioStatus, 'Visual and vibration cue ready', 'warn');
        return false;
      }

      if (primed && !fallbackOnly) return true;

      const contextReady = await resumeContext();
      const unlockResults = await Promise.all(
        chimeLayers.map(async audio => {
          const originalVolume = audio.volume;
          audio.volume = 0;
          try {
            const unlocked = await settlePlayback(audio.play(), 520);
            if (unlocked) {
              audio.pause();
              audio.currentTime = 0;
            }
            audio.volume = originalVolume;
            return unlocked;
          } catch (error) {
            audio.volume = originalVolume;
            return false;
          }
        })
      );

      primed = contextReady || unlockResults.some(Boolean);
      if (primed && !fallbackOnly) {
        setStatus(els.audioStatus, 'Audio cue ready', 'ok');
      } else {
        setStatus(els.audioStatus, 'Visual and vibration cue ready', 'warn');
      }
      return primed;
    }

    function flashAndVibrate(pattern = [60]) {
      body.classList.add('flash-active');
      window.clearTimeout(flashTimeout);
      flashTimeout = window.setTimeout(() => body.classList.remove('flash-active'), 420);

      if (navigator.vibrate) {
        try {
          navigator.vibrate(pattern);
        } catch (error) {
          // Vibration is best-effort on phones and usually unavailable on desktop.
        }
      }
    }

    function fallbackTone(kind) {
      const context = ensureAudioContext();
      if (!context || context.state !== 'running') return;

      try {
        const oscillator = context.createOscillator();
        const toneGain = context.createGain();
        const now = context.currentTime;
        oscillator.type = kind === 'stinger' ? 'sawtooth' : 'triangle';
        oscillator.frequency.setValueAtTime(kind === 'stinger' ? 120 : 880, now);
        oscillator.frequency.exponentialRampToValueAtTime(kind === 'stinger' ? 70 : 620, now + 0.22);
        toneGain.gain.setValueAtTime(0.0001, now);
        toneGain.gain.exponentialRampToValueAtTime(kind === 'stinger' ? 0.18 : 0.22, now + 0.02);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
        oscillator.connect(toneGain);
        toneGain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.28);
      } catch (error) {
        fallbackOnly = true;
      }
    }

    async function playAudio(audio, kind) {
      if (!primed) await prime();
      if (forceFallback || fallbackOnly) {
        fallbackOnly = true;
        fallbackTone(kind);
        setStatus(els.audioStatus, 'Visual and vibration cue ready', 'warn');
        return false;
      }

      try {
        audio.currentTime = 0;
        await audio.play();
        return true;
      } catch (error) {
        fallbackOnly = true;
        fallbackTone(kind);
        setStatus(els.audioStatus, 'Visual and vibration cue ready', 'warn');
        return false;
      }
    }

    function nextChimeLayer() {
      const startIndex = chimeCursor % chimeLayers.length;
      for (let offset = 0; offset < chimeLayers.length; offset += 1) {
        const candidate = chimeLayers[(startIndex + offset) % chimeLayers.length];
        if (candidate.paused) {
          chimeCursor = (startIndex + offset + 1) % chimeLayers.length;
          return candidate;
        }
      }
      chimeCursor = (startIndex + 1) % chimeLayers.length;
      return chimeLayers[startIndex];
    }

    async function playChime() {
      flashAndVibrate([70]);
      setStatus(els.audioStatus, 'Cue tested', 'ok');
      await playAudio(nextChimeLayer(), 'chime');
    }

    async function playStinger() {
      flashAndVibrate([30, 40, 80]);
      await playAudio(stinger, 'stinger');
    }

    return {
      prime,
      playChime,
      playStinger
    };
  }

  const audio = createAudioController();

  function currentIntervalSeconds(timer = state.timer, now = Date.now()) {
    if (!timer) return NORMAL_FLOOR_SECONDS;
    const elapsedMs = Math.max(0, now - timer.startedAt);

    if (elapsedMs >= PANIC_AFTER_MS) {
      const panicElapsed = Math.min(PANIC_RAMP_MS, elapsedMs - PANIC_AFTER_MS);
      const progress = panicElapsed / PANIC_RAMP_MS;
      return Math.max(PANIC_FLOOR_SECONDS, PANIC_START_SECONDS - progress * 0.6);
    }

    const minutesElapsed = Math.floor(elapsedMs / 60000);
    return Math.max(NORMAL_FLOOR_SECONDS, timer.baseSeconds - minutesElapsed * 2);
  }

  function ensureTimerCycle(timer, now = Date.now()) {
    if (!timer) return;
    if (Number.isFinite(timer.cycleStartedAt) && Number.isFinite(timer.cycleDurationMs)) return;

    const fallbackDurationMs = Math.max(100, currentIntervalSeconds(timer, now) * 1000);
    timer.cycleDurationMs = fallbackDurationMs;
    timer.cycleStartedAt = Math.max(timer.startedAt, timer.nextBeepAt - fallbackDurationMs);
  }

  function scheduleNextBeep(now = Date.now()) {
    if (!state.timer) return;
    const durationMs = currentIntervalSeconds(state.timer, now) * 1000;
    state.timer.cycleStartedAt = now;
    state.timer.cycleDurationMs = durationMs;
    state.timer.nextBeepAt = now + durationMs;
    saveTimerState();
  }

  function makeTimer(baseSeconds) {
    const now = Date.now();
    const timer = {
      version: TIMER_STATE_VERSION,
      id: `${now}-${Math.random().toString(16).slice(2)}`,
      running: true,
      baseSeconds: Math.max(0, Math.min(120, Number(baseSeconds) || 0)),
      startedAt: now,
      cycleStartedAt: now,
      cycleDurationMs: NORMAL_FLOOR_SECONDS * 1000,
      nextBeepAt: now + NORMAL_FLOOR_SECONDS * 1000
    };
    timer.cycleDurationMs = currentIntervalSeconds(timer, now) * 1000;
    timer.nextBeepAt = now + timer.cycleDurationMs;
    return timer;
  }

  function updateTensionMeter(leftMs, displayLeftSeconds, panicActive) {
    if (!els.tensionMeter || !state.timer) return;
    ensureTimerCycle(state.timer);

    const durationMs = Math.max(100, state.timer.cycleDurationMs || 0);
    const progress = Math.max(0, Math.min(1, 1 - Math.max(0, leftMs) / durationMs));
    els.tensionMeter.style.setProperty('--tension-scale', progress.toFixed(3));
    els.tensionMeter.classList.toggle('warning', displayLeftSeconds <= 10);
    els.tensionMeter.classList.toggle('panic', panicActive);
  }

  function resetTensionMeter() {
    if (!els.tensionMeter) return;
    els.tensionMeter.style.setProperty('--tension-scale', '0');
    els.tensionMeter.classList.remove('warning', 'panic');
  }

  function updateCountdown(leftMs) {
    if (!els.countdown || !state.timer) return;
    ensureTimerCycle(state.timer);

    const displayLeftSeconds = Math.ceil(Math.max(0, leftMs - DISPLAY_LEAD_MS) / 1000);
    const panicActive = Date.now() - state.timer.startedAt >= PANIC_AFTER_MS;
    els.countdown.textContent = formatSeconds(displayLeftSeconds);
    els.countdown.classList.toggle('red', displayLeftSeconds <= 10);
    body.classList.toggle('panic', panicActive);
    updateTensionMeter(leftMs, displayLeftSeconds, panicActive);

    const interval = currentIntervalSeconds();
    if (els.timerStatus) {
      const nextText = displayLeftSeconds <= 0 ? 'Cue now' : `Next cue ${formatSeconds(displayLeftSeconds)}`;
      const intervalText = interval < 1 ? `${interval.toFixed(1)}s interval` : `${formatSeconds(interval)} interval`;
      els.timerStatus.textContent = `${nextText} - ${intervalText}`;
    }
  }

  function tickTimer() {
    if (!state.timer || !state.timer.running) return;
    const now = Date.now();
    let leftMs = state.timer.nextBeepAt - now;

    if (leftMs <= CHIME_LEAD_MS) {
      if (state.restoredTimer && now - state.timer.nextBeepAt > 1200) {
        state.restoredTimer = false;
      } else {
        audio.playChime();
      }
      scheduleNextBeep(now);
      leftMs = state.timer.nextBeepAt - now;
    }

    updateCountdown(leftMs);
    state.timerRaf = window.requestAnimationFrame(tickTimer);
  }

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) {
      setStatus(els.wakeStatus, 'Wake lock unavailable', 'warn');
      return;
    }

    try {
      if (state.wakeLock) return;
      state.wakeLock = await navigator.wakeLock.request('screen');
      setStatus(els.wakeStatus, 'Screen held awake', 'ok');
      on(state.wakeLock, 'release', () => {
        state.wakeLock = null;
        if (state.timer && state.timer.running && doc.visibilityState === 'visible') {
          requestWakeLock();
        }
      });
    } catch (error) {
      state.wakeLock = null;
      setStatus(els.wakeStatus, 'Wake lock blocked', 'warn');
    }
  }

  function releaseWakeLock() {
    if (!state.wakeLock) return;
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
    setStatus(els.wakeStatus, 'Wake lock idle', 'idle');
  }

  function startTimer(baseSeconds, options = {}) {
    stopTimer({ clear: false, keepDisplay: true });
    state.timer = options.restoredTimer || makeTimer(baseSeconds);
    state.restoredTimer = Boolean(options.restored);
    state.timer.running = true;
    saveTimerState();

    body.classList.add('playing');
    showScreen('timer');
    updateCountdown(Math.max(0, state.timer.nextBeepAt - Date.now()));
    requestWakeLock();

    if (state.timerRaf) window.cancelAnimationFrame(state.timerRaf);
    state.timerRaf = window.requestAnimationFrame(tickTimer);
  }

  function stopTimer({ clear = false, keepDisplay = false } = {}) {
    if (state.timerRaf) window.cancelAnimationFrame(state.timerRaf);
    state.timerRaf = null;
    state.timer = null;
    state.restoredTimer = false;
    body.classList.remove('playing', 'panic', 'flash-active');
    if (els.countdown) {
      els.countdown.classList.remove('red');
      if (!keepDisplay) els.countdown.textContent = '00:30';
    }
    if (els.timerStatus) els.timerStatus.textContent = 'Ready';
    resetTensionMeter();
    releaseWakeLock();
    if (clear) clearTimerState();
  }

  function restoreTimerIfPresent() {
    const saved = readStoredTimer();
    if (!saved || !saved.running) return false;

    state.timer = saved;
    startTimer(saved.baseSeconds, { restored: true, restoredTimer: saved });
    return true;
  }

  function spinHunter() {
    if (!els.arrowRotor || state.spinnerBusy) return;
    state.spinnerBusy = true;
    if (els.spinBtn) els.spinBtn.disabled = true;
    if (els.spinner) els.spinner.classList.add('spinning');
    audio.prime();

    const stepDegrees = 30;
    const slotCount = 12;
    const duration = prefersReducedMotion ? 0 : 2600 + Math.random() * 900;
    const turns = prefersReducedMotion ? 1 : 4 + Math.floor(Math.random() * 3);
    const slot = Math.floor(Math.random() * slotCount);
    state.spinnerSteps = Math.round(state.spinnerSteps) + turns * slotCount + slot;

    const finish = () => {
      state.spinnerBusy = false;
      if (els.spinBtn) els.spinBtn.disabled = false;
      if (els.spinner) els.spinner.classList.remove('spinning');
      els.arrowRotor.style.transition = 'none';
      audio.playStinger();
    };

    if (duration === 0) {
      els.arrowRotor.style.transition = 'none';
      els.arrowRotor.style.transform = `translate(-50%, -50%) rotate(${state.spinnerSteps * stepDegrees}deg)`;
      finish();
      return;
    }

    els.arrowRotor.style.transition = `transform ${Math.round(duration)}ms cubic-bezier(.12,.76,.09,1)`;
    els.arrowRotor.style.transform = `translate(-50%, -50%) rotate(${state.spinnerSteps * stepDegrees}deg)`;
    window.setTimeout(finish, duration + 90);
  }

  function beginAssignedTimer() {
    if (!state.rolledFinal || state.assignedSeconds === null) return;
    audio.prime();
    startTimer(state.assignedSeconds);
  }

  function beginDefaultTimer() {
    audio.prime();
    startTimer(state.assignedSeconds === null ? 30 : state.assignedSeconds);
  }

  function resetEliminationHold() {
    if (state.eliminateRaf) window.cancelAnimationFrame(state.eliminateRaf);
    state.eliminateRaf = null;
    state.eliminateStartedAt = 0;
    if (els.eliminatedBtn) {
      els.eliminatedBtn.classList.remove('holding');
      els.eliminatedBtn.style.setProperty('--fill', '0%');
    }
  }

  function completeElimination() {
    resetEliminationHold();
    stopTimer({ clear: true });
    resetSlotState();
    showScreen('home');
  }

  function updateEliminationHold() {
    if (!state.eliminateStartedAt || !els.eliminatedBtn) return;
    const progress = Math.min(1, (performance.now() - state.eliminateStartedAt) / HOLD_TO_ELIMINATE_MS);
    els.eliminatedBtn.style.setProperty('--fill', `${Math.round(progress * 100)}%`);

    if (progress >= 1) {
      completeElimination();
      return;
    }

    state.eliminateRaf = window.requestAnimationFrame(updateEliminationHold);
  }

  function startEliminationHold(event) {
    event.preventDefault();
    if (!state.timer || !state.timer.running) return;
    resetEliminationHold();
    state.eliminateStartedAt = performance.now();
    els.eliminatedBtn.classList.add('holding');
    updateEliminationHold();
  }

  function wireEvents() {
    on(els.logoBtn, 'click', () => {
      stopTimer({ clear: true });
      resetSlotState();
      showScreen('home');
    });
    on(els.hostBtn, 'click', () => startFreshSetup('host'));
    on(els.joinBtn, 'click', () => startFreshSetup('join'));
    on(els.hostBackBtn, 'click', () => showScreen('home'));
    on(els.joinBackBtn, 'click', () => showScreen('home'));
    on(els.quickRulesBtn, 'click', openModal);
    on(els.browserOpenBtn, 'click', openPhoneBrowser);
    on(els.browserCopyBtn, 'click', copyBrowserLink);
    on(els.browserCloseBtn, 'click', dismissBrowserNotice);
    qsa('[data-close], .modal-close').forEach(button => on(button, 'click', closeModal));
    on(els.modal, 'click', event => {
      if (event.target && event.target.matches('[data-close]')) closeModal();
    });

    on(els.spinBtn, 'click', spinHunter);
    on(els.slotSpinBtn, 'click', spinSlot);
    on(els.slotThirtyBtn, 'click', () => {
      if (!state.rolledFinal && !state.slotSpinning) setAssignedInterval(30);
    });
    on(els.slotContinueBtn, 'click', beginAssignedTimer);
    on(els.startBtn, 'click', beginDefaultTimer);

    [els.joinTestBeepBtn, els.timerTestBeepBtn].forEach(button => {
      on(button, 'click', () => {
        audio.prime();
        audio.playChime();
      });
    });

    on(els.eliminatedBtn, 'pointerdown', startEliminationHold);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(eventName => {
      on(els.eliminatedBtn, eventName, resetEliminationHold);
    });
    on(els.eliminatedBtn, 'click', event => event.preventDefault());

    on(doc, 'pointerdown', () => {
      audio.prime();
    });

    on(doc, 'visibilitychange', () => {
      if (!state.timer || !state.timer.running) return;
      if (doc.visibilityState === 'visible') {
        requestWakeLock();
        saveTimerState();
      }
    });

    on(window, 'pagehide', saveTimerState);
  }

  function init() {
    if (!body) return;
    body.dataset.screen = 'home';
    body.classList.add('home-active');
    setStatus(els.audioStatus, 'Cue not tested', 'idle');
    setStatus(els.wakeStatus, 'Wake lock idle', 'idle');
    resetSlotState();
    initBrowserNotice();
    wireEvents();
    restoreTimerIfPresent();
  }

  if (doc.readyState === 'loading') {
    on(doc, 'DOMContentLoaded', init);
  } else {
    init();
  }
})();
