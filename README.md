# Hunted

https://crixppp.github.io/hunted/

Hunted is a live-action hide-and-seek survival game played in a confined space. The site runs on each player's phone and handles the Hunter selection, Prey timer rolls, sound cues, warning state, and panic pacing.

The project is a static GitHub Pages app. It has no backend, framework, package install, or build step. It can also be installed to a phone home screen and played offline after the site has been opened once online.

## Offline Web App

- Open `https://crixppp.github.io/hunted/` once while online so the browser can cache the game.
- On iPhone, use Share -> Add to Home Screen. On Android or desktop Chrome, use Install app when prompted or from the browser menu.
- After the first online load, the app shell, icons, images, and sound cues are available offline from the installed app or the same browser.
- Open the app once online after future updates so the latest files can be cached.

## How to Play

### 1. Setup

- Use 4 or more players in a confined space, such as a house.
- Each player opens the Hunted site on their own phone.
- Set phone volume high and disable silent or do-not-disturb modes.

### 2. Choose the Hunter

- One player taps **Host New Game**.
- Everyone gathers around the host phone.
- Tap **Spin**. The arrow stops on a notch and the selected player becomes the Hunter.

### 3. Set Prey Timers

- Every non-Hunter taps **Join Game**.
- Each Prey taps **Spin** once to receive a random interval from `0:00` to `2:00`.
- The **30 sec** button is available as a quick fixed interval.
- The assigned interval is final until a new game is hosted.

### 4. Hunt

- The Hunter blindfolds and counts to 30 while Prey hide.
- Each Prey taps **Continue** to start their timer.
- When the timer reaches zero, the phone cues with sound, vibration, and a screen flash.
- The final 10 seconds show a red warning state.
- Prey must stay hidden and walk only.
- A player is out if they are caught, deliberately touch the Hunter, run, or speak.

## App Behavior

- Timers are unpausable once started.
- The app requests a screen wake lock while the timer is running.
- Timer state is stored under `hunted.timerState` so reloads can recover the current countdown without clearing unrelated browser storage.
- If a timer is overdue after a reload or tab restore, the app catches up and schedules from the current time instead of playing a backlog of missed cues.
- The interval decreases by 2 seconds each minute and never drops below 3 seconds before panic mode.
- Panic mode starts after 5 minutes and ramps cues from 1.0 seconds toward 0.4 seconds.
- Audio playback is best-effort on phones. The app primes audio on touch and falls back to vibration and visual cues if MP3 playback is blocked.

## Files

- `index.html` - static app markup.
- `style.css` - mobile-first cinematic UI.
- `app.js` - game flow, audio, timer recovery, wake lock, and controls.
- `manifest.webmanifest` - installable web app metadata.
- `service-worker.js` - offline cache for the app shell and game assets.
- `chime.MP3` and `horror-stinger.mp3` - game cue assets.
- `logo.png` and `favicon.png` - visual assets and install icon.
