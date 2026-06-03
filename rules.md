# How to Play Hunted

## 1. Setup

- Use at least four players in a confined area, such as a house or similar indoor space.
- Each player uses their own smartphone with the Hunted site open.
- Set phone volume high and disable silent or do-not-disturb modes.

## 2. Choosing the Hunter

- One player opens the site and selects **Host New Game**.
- All players gather around this phone.
- The host presses **Spin**. When the arrow stops, the player it points to is the Hunter for this game.

## 3. Prey Setup

- Every player who is not the Hunter opens the site and selects **Join Game**.
- Each Prey presses **Spin** once to receive a random timer interval between `0:00` and `2:00`.
- A Prey may use **30 sec** as a fixed quick interval.
- This interval is fixed for that player until a new game is hosted.

## 4. The Hunt

- The Hunter is blindfolded and counts to 30 while the Prey hide.
- Once hidden, each Prey presses **Continue** to begin their own timer.
- When a timer reaches zero, the phone cues with sound, vibration, and a screen flash.
- The countdown automatically restarts with that player's current interval.
- During the final 10 seconds before each cue, the screen shows a red warning.
- Prey must remain hidden and may only move at a walking pace.
- A player is out if they are caught by the Hunter, deliberately touch the Hunter, run, or speak.

## 5. Ending the Game

- The game continues until only one Prey remains.
- The last remaining Prey is considered the winner.
- The group may also stop the game early by agreement.
- A player who is out holds **Hold if Eliminated** to clear their timer and return home.

## 6. App Mechanics

- Timers cannot be paused once started.
- The screen wake lock is requested while a timer is running.
- If the page reloads, the app restores the timer from the saved wall-clock state.
- If the page was hidden long enough to miss cues, the app schedules from the current time instead of replaying a backlog.
- Over time, the interval between cues gradually shortens but does not go below three seconds before panic mode.
- After five minutes, panic mode begins and cue intervals ramp down from 1.0 seconds toward 0.4 seconds.
- If audio playback is blocked, visual flash and vibration cues still run where supported.
