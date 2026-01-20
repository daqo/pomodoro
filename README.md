# Pomodoro Timer App

A neobrutalist-style Pomodoro timer web app built with React. Track work sessions with automatic rest periods and view your productivity history.

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **sql.js** - SQLite compiled to WebAssembly (client-side database)
- **localStorage** - Database persistence

## Project Structure

```
src/
├── App.jsx      # Main component with all UI and timer logic
├── db.js        # Database layer (sql.js + localStorage)
├── index.css    # All styles (neobrutalist design)
└── main.jsx     # React entry point
```

## Running the App

```bash
npm install
npm run dev      # Development server at localhost:5173
npm run build    # Production build
npm run preview  # Preview production build
```

## Database Schema

Single table `pomodoros` stores both work sessions and rest periods:

```sql
CREATE TABLE pomodoros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,           -- Display name ("Rest" for rest entries)
  duration INTEGER NOT NULL,    -- Duration in minutes
  date TEXT NOT NULL,           -- Date string "YYYY-MM-DD"
  completed INTEGER DEFAULT 0,  -- 0 = ongoing, 1 = completed
  started_at INTEGER,           -- Unix timestamp (milliseconds)
  type TEXT DEFAULT 'pomodoro'  -- "pomodoro" or "rest"
)
```

**Key DB functions in `db.js`:**
- `initDb()` - Initialize database, run migrations, load from localStorage
- `addPomodoro(name, duration, date)` - Create new work session
- `addRest(duration, date)` - Create new rest period
- `completePomodoro(id)` - Mark entry as completed
- `getPomodorosForDate(date)` - Get all entries for a day (sorted by started_at ASC)
- `getOngoingEntry()` - Get the current uncompleted entry (if any)
- `getPomodorosForMonth(year, month)` - Get entry counts per day for calendar

## Key State Variables (App.jsx)

| State | Type | Purpose |
|-------|------|---------|
| `dbReady` | boolean | Whether database is initialized |
| `view` | 'day' \| 'month' | Current calendar view |
| `currentDate` | Date | Selected date for viewing |
| `pomodoros` | array | Entries for current day view |
| `activeEntry` | object \| null | Currently running pomodoro/rest |
| `timeLeft` | number | Seconds remaining on timer |
| `isRunning` | boolean | Whether timer is actively counting |
| `showTimer` | boolean | Show fullscreen timer vs list view |

## Timer Flow

1. **Start Pomodoro**: User enters name, selects duration (25/45/55 min), clicks Start
2. **Work Period**: Timer counts down, entry saved to DB with `type: 'pomodoro'`
3. **Auto Rest**: When work timer hits 0, entry marked complete, new `type: 'rest'` entry created automatically (5 min)
4. **Rest Period**: Timer counts down the rest period
5. **Complete**: When rest ends, entry marked complete, timer stops

## Views

### Day View (default)
- Shows date header
- "New Pomodoro" button (only for today, not past/future days)
- Timeline of work and rest blocks
- Ongoing entry shows "LIVE" badge and countdown

### Month View
- Calendar grid with navigation
- Today highlighted in yellow
- Future days grayed out
- Shows count of entries per day
- Click day to switch to day view

### Timer View
- Fullscreen timer display
- Shows "Work Time" or "Rest Time" badge
- Back button to return to list
- Manual complete button

## Entry States & Colors

| State | Type | Color | Description |
|-------|------|-------|-------------|
| Completed Work | pomodoro | Green (#bbf7d0) | Finished work session |
| Ongoing Work | pomodoro | Amber (#fde68a) | Active work timer + LIVE badge |
| Completed Rest | rest | Gray (#e5e7eb) | Finished rest period |
| Ongoing Rest | rest | Blue (#bfdbfe) | Active rest timer + LIVE badge |

## Important Implementation Details

### Date Handling
Uses local timezone, NOT UTC. The `formatDate()` function uses `getFullYear()`, `getMonth()`, `getDate()` to avoid timezone issues with `toISOString()`.

### Timer Persistence
On page load, `getOngoingEntry()` checks for uncompleted entries. If found and time remains, the timer resumes automatically.

### Preventing Double Completion
`completedRef` (useRef) tracks the last completed entry ID to prevent the completion effect from running multiple times for the same entry.

### Identifying Ongoing Entry in List
```js
const isOngoing = isRunning && activeEntry != null && String(entry.id) === String(activeEntry.id)
```
Uses string comparison to handle potential type mismatches between IDs.

## Configuration Constants

```js
const DURATION_OPTIONS = [25, 45, 55]  // Work duration options in minutes
const REST_DURATION = 5                 // Rest period in minutes
```

## Clearing Data

To reset the app, clear localStorage:
```js
localStorage.removeItem('pomodoro_db')
```
