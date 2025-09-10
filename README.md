# 🕵️‍♂️ Hunted  

https://crixppp.github.io/hunted/

A live-action hide-and-seek / survival game played in confined spaces using your phone as a timer.  
Built as a static site, deployable on **GitHub Pages**.  

---

## 🎮 How to Play  

### 1. Setup  
- 4+ players in a confined space (e.g. a house).  
- Each player needs a smartphone with the site open.  
- Volume must be set to maximum.  

### 2. Choose the Hunter  
- One player taps **Host New Game**.  
- Everyone gathers around the host’s phone.  
- Tap **Spin** → the arrow lands on a player → they become the Hunter.  

### 3. Prey Setup  
- All other players tap **Join Game**.  
- Tap **Spin** → you’re assigned a random timer interval between `0:00`–`2:00`.  
- Your roll is **final** until a new game is hosted.  

### 4. The Hunt  
- The Hunter blindfolds and counts to 30 while prey hide.  
- Each prey presses **Start** → their personal timer begins.  
- When the timer hits zero: the phone **beeps** and the timer repeats.  
- Final 10 seconds before each beep show a **red warning**.  
- Prey must stay hidden and walking only.  
- If caught / touch the Hunter / run / speak → you’re out.  

---

## ⚡ Features  

- 🎯 **Random Hunter Spinner** → arrow always lands exactly on a notch.  
- 🎲 **Slot-Machine Interval Roll** → dramatic spin animation, one roll per game.  
- 🔊 **Device Beeps** → square-wave beep + vibration cue.  
- 🟥 **Visual Countdown** → large red warning during last 10s.  
- 🔒 **Unpausable Timer** → once started, it runs until eliminated or game ends.  
- 🌙 **Wake Lock** → keeps screen awake while timer runs.  
- ⏱️ **Adaptive Interval** → every minute, beep interval decreases by 5s (never below 3s).  
- 🚨 **Panic Mode** → if the game lasts over 5 minutes, all timers flash red and beeps escalate rapidly (1.0s → 0.75s → 0.5s).  
- ⏳ **Catch-up Resume** → if you leave/lock your phone, on return your timer “jumps ahead” to where it should be.  
