# Pomodoro Timer

A minimalist Pomodoro timer with automatic rest periods and productivity tracking. Built with React and client-side SQLite.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| Vite | Build tool and dev server |
| sql.js | SQLite compiled to WebAssembly |
| localStorage | Database persistence |

## Project Structure

```
src/
├── App.jsx          # Main component (UI, state, timer logic)
├── db.js            # Database layer (sql.js wrapper)
├── sounds.js        # Audio playback for timer completion
├── notifications.js # Browser Notification API wrapper
├── timerWorker.js   # Web Worker for background timing
├── index.css        # Styles (neobrutalist design)
└── main.jsx         # React entry point
```

## How It Works

### Timer Flow

```
Start Pomodoro (25/45/55 min)
        ↓
    Work Period
        ↓
    Timer hits 0
        ↓
  Auto-start Rest (5 min)
        ↓
    Rest Period
        ↓
    Timer hits 0
        ↓
      Done
```

### Views

**Day View** - Default view showing today's pomodoros and rest periods as a timeline. Start new pomodoros here.

**Month View** - Calendar showing pomodoro counts per day. Click a day to see its details.

**Timer View** - Fullscreen countdown display. Appears when a timer is active.

### Entry States

| State | Color | Badge |
|-------|-------|-------|
| Ongoing Work | Amber | LIVE |
| Completed Work | Green | Checkmark |
| Ongoing Rest | Blue | LIVE |
| Completed Rest | Gray | Checkmark |

## Key Files

### `src/App.jsx`

Main React component containing:

- **State management** - Timer state, view state, form state
- **Effects** - DB initialization, timer countdown, auto-completion
- **Event handlers** - Starting pomodoros, clicking entries, navigation

Key state variables:

```javascript
activeEntry   // Currently running pomodoro/rest (or null)
timeLeft      // Seconds remaining
isRunning     // Timer actively counting
showTimer     // Fullscreen timer vs list view
```

### `src/db.js`

Database layer wrapping sql.js:

```javascript
initDb()                      // Initialize database
addPomodoro(name, duration, date)   // Create work session
addRest(duration, date)       // Create rest period
completePomodoro(id)          // Mark entry done
getPomodorosForDate(date)     // Get day's entries
getOngoingEntry()             // Get active entry
getPomodorosForMonth(y, m)    // Get monthly stats
```

**Single source of truth**: After mutations, always fetch fresh data from DB using `getOngoingEntry()` rather than relying on stale UI state.

## Database

Uses SQLite in the browser via sql.js (WebAssembly). Data persists in localStorage indefinitely until cleared.

### Schema

```sql
CREATE TABLE pomodoros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL,      -- minutes
  date TEXT NOT NULL,             -- YYYY-MM-DD
  completed INTEGER DEFAULT 0,    -- 0 or 1
  started_at INTEGER,             -- Unix timestamp (ms)
  type TEXT DEFAULT 'pomodoro'    -- 'pomodoro' or 'rest'
)
```

### Clearing Data

```javascript
localStorage.removeItem('pomodoro_db')
```

## Configuration

Constants in `App.jsx`:

```javascript
DURATION_OPTIONS = [25, 45, 55]    // Work durations (minutes)
REST_DURATION_MINUTES = 5          // Rest duration (minutes)
```

## Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Implementation Notes

**Timer persistence** - On page load, checks for incomplete entries. If time remains, resumes automatically.

**Date handling** - Uses local timezone via `getFullYear()`/`getMonth()`/`getDate()`. Avoids `toISOString()` to prevent UTC issues.

## Background Tab Audio

Browsers throttle JavaScript timers in background tabs, which can delay or prevent timer completion sounds. Here's how this app ensures reliable audio playback even when the tab is in the background:

### The Problem

1. When a browser tab is in the background, `setInterval` can be throttled to run only once per second or less
2. Audio playback triggered by throttled JavaScript may be delayed until the user returns to the tab
3. The timer UI may show incorrect time when returning to a background tab

### The Solution: Web Workers + Notifications

#### Step 1: Web Worker for Accurate Timing

A Web Worker (`src/timerWorker.js`) runs in a separate thread that is not throttled by the browser:

```javascript
// Worker receives an endTime timestamp and checks every second
self.onmessage = (e) => {
  if (e.data.type === 'start') {
    intervalId = setInterval(() => {
      if (Date.now() >= e.data.endTime) {
        self.postMessage({ type: 'complete' })
        clearInterval(intervalId)
      }
    }, 1000)
  }
}
```

#### Step 2: Browser Notifications

The app requests notification permission when starting a timer. When the worker detects completion:

1. A browser notification is shown (works even in background tabs)
2. The notification includes the pomodoro name and completion message
3. Clicking the notification focuses the tab

#### Step 3: Dual Timer System

The app runs two timers in parallel:

| Timer | Purpose | Location |
|-------|---------|----------|
| `setInterval` in main thread | Updates UI countdown display | `App.jsx` |
| `setInterval` in Web Worker | Detects actual completion time | `timerWorker.js` |

#### Step 4: Visibility Change Handler

When the user returns to the tab, the app recalculates the remaining time from the database:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const remaining = calculateRemainingTime(activeEntry)
    setTimeLeft(remaining)
  }
})
```

### How It All Works Together

1. User starts a 25-minute pomodoro
2. Main thread starts `setInterval` for UI updates
3. Web Worker starts with `endTime = Date.now() + 25 * 60 * 1000`
4. User switches to another tab
5. Main thread timer gets throttled (UI updates pause)
6. Web Worker continues running accurately in background
7. After 25 minutes, Worker posts `{ type: 'complete' }`
8. Main thread receives message, triggers:
   - Browser notification (visible even in background)
   - Sound playback via `sounds.js`
   - State update to start rest period
9. User returns to tab, sees completed state and rest timer running

### Files Involved

| File | Role |
|------|------|
| `timerWorker.js` | Background timing (not throttled) |
| `notifications.js` | Browser notification API wrapper |
| `sounds.js` | Audio playback (work/rest complete sounds) |
| `App.jsx` | Orchestrates worker, notifications, and UI |
