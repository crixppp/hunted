// ES5-compatible build of Hunted app
// Includes minimal polyfills for older browsers.

(function() {
  // Polyfills
  if (typeof String.prototype.padStart !== 'function') {
    String.prototype.padStart = function padStart(targetLength, padString) {
      var str = String(this);
      var pad = String(padString || ' ');
      while (str.length < targetLength) {
        str = pad + str;
      }
      return str.length > targetLength ? str.slice(str.length - targetLength) : str;
    };
  }

  if (typeof Number.isFinite !== 'function') {
    Number.isFinite = function(value) {
      return typeof value === 'number' && isFinite(value);
    };
  }

  if (!Array.from) {
    Array.from = function(arrayLike) {
      return Array.prototype.slice.call(arrayLike);
    };
  }

  if (typeof Element !== 'undefined' && !Element.prototype.matches) {
    Element.prototype.matches =
      Element.prototype.msMatchesSelector ||
      Element.prototype.webkitMatchesSelector ||
      function(selector) {
        var matches = (this.document || this.ownerDocument).querySelectorAll(selector);
        var i = matches.length;
        while (--i >= 0 && matches.item(i) !== this) {}
        return i > -1;
      };
  }

  if (typeof Element !== 'undefined' && !Element.prototype.closest) {
    Element.prototype.closest = function(selector) {
      var el = this;
      while (el) {
        if (el.matches && el.matches(selector)) return el;
        el = el.parentElement;
      }
      return null;
    };
  }

  // Minimal Promise polyfill (enough for Promise.all and basic usage)
  if (typeof Promise !== 'function') {
    var PENDING = 'pending';
    var FULFILLED = 'fulfilled';
    var REJECTED = 'rejected';

    var SimplePromise = function(executor) {
      var state = PENDING;
      var value = null;
      var handlers = [];

      function fulfill(result) {
        state = FULFILLED;
        value = result;
        handlers.forEach(handle);
        handlers = null;
      }

      function reject(error) {
        state = REJECTED;
        value = error;
        handlers.forEach(handle);
        handlers = null;
      }

      function resolve(result) {
        try {
          if (result === this) {
            throw new TypeError('Promise cannot resolve itself');
          }
          if (result && (typeof result === 'object' || typeof result === 'function')) {
            var then = result.then;
            if (typeof then === 'function') {
              then.call(result, resolve, reject);
              return;
            }
          }
          fulfill(result);
        } catch (err) {
          reject(err);
        }
      }

      function handle(handler) {
        if (state === PENDING) {
          handlers.push(handler);
          return;
        }

        var cb = state === FULFILLED ? handler.onFulfilled : handler.onRejected;
        if (!cb) {
          (state === FULFILLED ? handler.resolve : handler.reject)(value);
          return;
        }
        try {
          var ret = cb(value);
          handler.resolve(ret);
        } catch (err) {
          handler.reject(err);
        }
      }

      this.then = function(onFulfilled, onRejected) {
        return new SimplePromise(function(resolve, reject) {
          handle({
            onFulfilled: typeof onFulfilled === 'function' ? onFulfilled : null,
            onRejected: typeof onRejected === 'function' ? onRejected : null,
            resolve: resolve,
            reject: reject
          });
        });
      };

      this.catch = function(onRejected) {
        return this.then(null, onRejected);
      };

      try {
        executor(resolve, reject);
      } catch (err) {
        reject(err);
      }
    };

    SimplePromise.all = function(iterable) {
      return new SimplePromise(function(resolve, reject) {
        if (!iterable || typeof iterable.length === 'undefined') {
          reject(new TypeError('Promise.all expects an array-like')); // eslint-disable-line prefer-promise-reject-errors
          return;
        }
        var results = [];
        var remaining = iterable.length;
        if (remaining === 0) {
          resolve([]);
          return;
        }
        function resolver(i) {
          return function(value) {
            results[i] = value;
            remaining -= 1;
            if (remaining === 0) {
              resolve(results);
            }
          };
        }
        for (var i = 0; i < iterable.length; i += 1) {
          SimplePromise.resolve(iterable[i]).then(resolver(i), reject);
        }
      });
    };

    SimplePromise.resolve = function(value) {
      return new SimplePromise(function(resolve) {
        resolve(value);
      });
    };

    SimplePromise.reject = function(reason) {
      return new SimplePromise(function(resolve, reject) {
        reject(reason);
      });
    };

    Promise = SimplePromise;
  }

  function toggleClass(el, className, force) {
    if (!el || !el.classList) return;
    if (typeof force === 'undefined') {
      if (el.classList.toggle) {
        el.classList.toggle(className);
      } else if (el.classList.contains(className)) {
        el.classList.remove(className);
      } else {
        el.classList.add(className);
      }
    } else if (force) {
      el.classList.add(className);
    } else {
      el.classList.remove(className);
    }
  }

  function wireUi(doc) {
    doc = doc || document;
    var body = doc.body;
    if (!body) {
      console.warn('wireUi: document.body not ready');
      return;
    }

    var qs = function(selector, scope) {
      return (scope || doc).querySelector(selector);
    };
    var qsa = function(selector, scope) {
      return Array.from((scope || doc).querySelectorAll(selector));
    };
    var onClickAll = function(selector, handler) {
      qsa(selector).forEach(function(el) {
        el.addEventListener('click', handler);
      });
    };

    var btnEliminated = qs('#btnEliminated');
    var slotMin = qs('#slotMin');
    var slotSecT = qs('#slotSecT');
    var slotSecO = qs('#slotSecO');
    var btnSlotSpin = qs('#btnSlotSpin');
    var btnSlotContinue = qs('#btnSlotContinue');
    var flashOverlay = qs('.flash-overlay', body);

    var screens = {
      home: qs('#screen-home'),
      host: qs('#screen-host'),
      join: qs('#screen-join'),
      timer: qs('#screen-timer')
    };

    var activeScreen = screens.home;

    function show(name) {
      var target = screens[name];
      if (!target) return;
      if (activeScreen === screens.timer && name !== 'timer') endGame();
      if (activeScreen === target) return;

      if (activeScreen) activeScreen.classList.remove('active');
      activeScreen = target;
      activeScreen.classList.add('active');

      toggleClass(body, 'home-active', name === 'home');
      if (name !== 'timer') body.classList.remove('playing');
      toggleClass(body, 'timer-active', name === 'timer');
      if (name !== 'timer') resetEliminationState();
    }

    if (activeScreen) body.classList.add('home-active');

    onClickAll('#logoBtn', function() {
      show('home');
    });

    var modal = qs('#modal');
    onClickAll('#btnQuickRules, #quickRules', function() {
      if (modal) modal.classList.add('show');
    });
    onClickAll('[data-close], .modal-close', function() {
      if (modal) modal.classList.remove('show');
    });

    if (btnEliminated) {
      btnEliminated.addEventListener('click', function() {
        if (activeScreen === screens.timer) endGame();
        show('home');
      });
    }

    resetEliminationState();

    if (btnEliminated) {
      btnEliminated.addEventListener('pointerdown', startEliminateHold);
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(eventName) {
        btnEliminated.addEventListener(eventName, cancelEliminateHold);
      });
    }

    resetEliminateHold();

    var assignedSeconds = null;
    var rolledFinal = false;

    var flashTimeout = null;
    var flashDurationMs = 800;

    var ELIMINATE_HOLD_MS = 1600;
    var eliminateRaf = null;
    var eliminateStart = 0;

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
      var progress = Math.min(1, (performance.now() - eliminateStart) / ELIMINATE_HOLD_MS);
      btnEliminated.style.setProperty('--fill', Math.round(progress * 100) + '%');
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

    onClickAll('#host, #btnHost', function() {
      resetGameState();
      show('host');
    });
    onClickAll('#join, #btnJoin', function() {
      resetGameState();
      show('join');
    });
    onClickAll('#btnJoinBack', function() {
      show('home');
    });
    onClickAll('#btnHostBack', function() {
      show('home');
    });

    var arrowRotor = qs('#arrowRotor');
    var spinning = false;
    var stepCount = 0;
    var STEP = 30;
    var SLOTS = 12;
    var stinger = new Audio('horror-stinger.mp3');
    stinger.preload = 'auto';
    stinger.volume = 1;

    var btnSpin = qs('#btnSpin');
    if (btnSpin) {
      btnSpin.addEventListener('click', function() {
        if (!arrowRotor) return;
        if (spinning) return;
        spinning = true;
        stepCount = Math.round(stepCount);
        var spinDurationMs = 2800 + Math.random() * 1200;
        var turns = Math.floor(spinDurationMs / 600) + Math.floor(Math.random() * 2);
        var slot = Math.floor(Math.random() * SLOTS);
        stepCount += turns * SLOTS + slot;
        arrowRotor.style.transition =
          'transform ' + Math.round(spinDurationMs) + 'ms cubic-bezier(.12,.72,.12,1)';
        arrowRotor.style.transform = 'translate(-50%,-50%) rotate(' + stepCount * STEP + 'deg)';
        setTimeout(function() {
          arrowRotor.style.transition = 'none';
          spinning = false;
          stinger.currentTime = 0;
          stinger.play().catch(function() {});
        }, Math.round(spinDurationMs) + 100);
      });
    }

    function cycle(el, vals, dur, target) {
      if (!el) return Promise.resolve();
      return new Promise(function(res) {
        var end = Date.now() + dur;
        var i = 0;
        (function tick() {
          if (Date.now() >= end) {
            el.textContent = target;
            res();
            return;
          }
          el.textContent = vals[i % vals.length];
          i += 1;
          setTimeout(tick, 50);
        })();
      });
    }

    var btnSlotSpinEl = qs('#btnSlotSpin');
    if (btnSlotSpinEl) {
      btnSlotSpinEl.addEventListener('click', function() {
        if (!slotMin || !slotSecT || !slotSecO || !btnSlotSpin || !btnSlotContinue) return;
        if (rolledFinal) return;
        btnSlotSpin.disabled = true;
        assignedSeconds = Math.floor(Math.random() * 121);
        var m = Math.floor(assignedSeconds / 60);
        var s = assignedSeconds % 60;
        Promise.all([
          cycle(slotMin, [0, 1, 2], 1200, m),
          cycle(slotSecT, [0, 1, 2, 3, 4, 5], 1500, Math.floor(s / 10)),
          cycle(slotSecO, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 1800, s % 10)
        ]).then(function() {
          rolledFinal = true;
          btnSlotContinue.disabled = false;
        });
      });
    }

    var chime = new Audio('chime.MP3');
    chime.preload = 'auto';
    chime.volume = 1;
    var chimeLayers = [chime.cloneNode(), chime.cloneNode(), chime];
    chimeLayers.forEach(function(layer) {
      layer.preload = 'auto';
      layer.volume = 1;
      if (!layer.src) layer.src = 'chime.MP3';
      if (layer.load) layer.load();
    });
    if (stinger.load) stinger.load();

    function setFlashDuration() {
      if (!Number.isFinite(chime.duration) || chime.duration <= 0) return;

      var adjusted = chime.duration * 1000 - 180;
      flashDurationMs = Math.max(320, adjusted);
    }
    chime.addEventListener('loadedmetadata', setFlashDuration);
    setFlashDuration();

    var audioPrimed = false;
    function primeChime() {
      if (audioPrimed) return;
      var unlocks = chimeLayers.map(function(layer) {
        return layer
          .play()
          .then(function() {
            layer.pause();
            layer.currentTime = 0;
            return true;
          })
          .catch(function() {
            return false;
          });
      });

      Promise.all(unlocks).then(function(results) {
        var any = false;
        for (var i = 0; i < results.length; i += 1) {
          if (results[i]) {
            any = true;
            break;
          }
        }
        if (any) {
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
      var duration = Number.isFinite(flashDurationMs) && flashDurationMs > 0 ? flashDurationMs : 800;
      flashTimeout = setTimeout(function() {
        body.classList.remove('flash-active');
      }, duration);
    }

    function playChime() {
      chimeLayers.forEach(function(layer) {
        layer.currentTime = 0;
        layer.play().catch(function() {});
      });
      flashForBeep();
      if (navigator.vibrate) navigator.vibrate(50);
    }

    var btnJoinTestBeep = qs('#btnJoinTestBeep');
    if (btnJoinTestBeep) {
      btnJoinTestBeep.addEventListener('click', function() {
        primeChime();
        playChime();
      });
    }
    var btnTimerTestBeep = qs('#btnTimerTestBeep');
    if (btnTimerTestBeep) {
      btnTimerTestBeep.addEventListener('click', function() {
        primeChime();
        playChime();
      });
    }

    var domCountdown = qs('#countdown');
    var timerRunning = false;
    var nextAt = 0;
    var base = 30;
    var start = 0;
    var rafId = null;
    var panic = false;
    var panicStart = 0;
    var PANIC_AFTER = 5 * 60 * 1000;
    var DISPLAY_LEAD_MS = 220;
    var CHIME_LEAD_MS = 220;
    var prestartSelector = '#screen-timer .prestart';
    var wakeLock = null;
    var gameId = null;

    function fmt(s) {
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    function adaptive(now) {
      if (panic) return Math.max(0.4, (1 - (now - panicStart) / 420000) * 0.6 + 0.4);
      var mins = Math.floor((now - start) / 60000);
      return Math.max(3, base - 2 * mins);
    }

    function schedule(now) {
      nextAt = now + adaptive(now) * 1000;
    }

    function update(id) {
      if (!timerRunning || id !== gameId) return;

      var now = performance.now();
      if (!panic && now - start >= PANIC_AFTER) {
        panic = true;
        panicStart = now;
        body.classList.add('panic');
      }

      var left = Math.max(0, nextAt - now);
      var displayLeft = Math.max(0, left - DISPLAY_LEAD_MS);
      var chimeLeft = Math.max(0, left - CHIME_LEAD_MS);
      var sec = Math.ceil(displayLeft / 1000);
      domCountdown.textContent = fmt(sec);
      if (sec <= 10) domCountdown.classList.add('red');
      else domCountdown.classList.remove('red');
      if (chimeLeft <= 0) {
        playChime();
        schedule(now);
      }
      rafId = requestAnimationFrame(function() {
        update(id);
      });
    }

    function requestWakeLock() {
      if (!('wakeLock' in navigator)) return Promise.resolve();
      return navigator.wakeLock
        .request('screen')
        .then(function(lock) {
          wakeLock = lock;
          wakeLock.addEventListener('release', function() {
            wakeLock = null;
            if (timerRunning) requestWakeLock();
          });
        })
        .catch(function() {
          wakeLock = null;
        });
    }

    function releaseWakeLock() {
      if (wakeLock) {
        wakeLock.release().catch(function() {});
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
      body.classList.remove('flash-active');
      releaseWakeLock();
    }

    doc.addEventListener('visibilitychange', function() {
      if (doc.visibilityState === 'visible' && timerRunning) requestWakeLock();
    });

    function clearPrestart() {
      var prestart = qsa(prestartSelector);
      if (prestart.length) {
        prestart.forEach(function(el) {
          el.parentNode.removeChild(el);
        });
      }
    }

    onClickAll('#btnSlotContinue', function() {
      if (!rolledFinal) return;
      base = assignedSeconds;
      domCountdown.textContent = fmt(base);
      show('timer');
      body.classList.add('playing');
      clearPrestart();
      startGame();
    });

    onClickAll('#play, #btnStart', function() {
      body.classList.add('playing');
      clearPrestart();
      startGame();
    });
  }

  function startApp() {
    var body = document.body;
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
})();
