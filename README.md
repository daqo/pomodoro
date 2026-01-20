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
├── App.jsx      # Main component (UI, state, timer logic)
├── db.js        # Database layer (sql.js wrapper)
├── index.css    # Styles (neobrutalist design)
└── main.jsx     # React entry point
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
