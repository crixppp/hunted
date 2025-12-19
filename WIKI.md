# Hunted Wiki

Welcome to the Hunted project wiki. This document collects gameplay, setup, and maintenance notes in one place.

---

## Quick Start

1. Open the site on all players' phones.
2. Tap **Host New Game** on one device to pick the Hunter.
3. Everyone else taps **Join Game** to roll their personal interval.
4. Start the timers and begin the hunt.

---

## Gameplay Reference

### Host Flow
- Tap **Host New Game**.
- Tap **Spin** to select the Hunter.
- Optional: keep the host phone handy for quick rule checks.

### Join Flow
- Tap **Join Game**.
- Tap **Spin** to roll a random interval between `0:00`–`2:00`.
- Tap **Continue** to begin your timer.

### Timer Behaviors
- The timer repeats when it reaches zero.
- The final 10 seconds are highlighted red.
- After 5 minutes, the timer enters panic mode with faster beeps.
- Devices can vibrate if supported.

---

## UI Screens

- **Home**: entry point with Host, Join, and Quick Rules buttons.
- **Host**: spinner to select the Hunter.
- **Join**: slot-style roll for interval selection.
- **Timer**: countdown with test beep and start controls.

---

## Audio

- **Main chime**: `chime.MP3`
- **Host spinner stinger**: `horror-stinger.mp3`

---

## Hosting & Deployment

This project is a static site (HTML/CSS/JS). You can host it on:

- GitHub Pages
- Netlify
- Any static file host

Make sure the audio files (`chime.MP3` and `horror-stinger.mp3`) are served alongside `index.html`.

---

## Troubleshooting

**Buttons don’t respond**
- Confirm `app.es5.js` is loading in the browser.
- Check console for errors or blocked assets.

**No sound**
- Tap once on the page to allow audio playback.
- Ensure device volume is turned up.

---

## Roadmap Ideas

- Add a “Hunter Reveal” overlay animation.
- Add optional game modes (stealth, chaos, silent).
- Add sound pack selection.
