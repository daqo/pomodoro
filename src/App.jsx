import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  initDb,
  addPomodoro,
  addRest,
  completePomodoro,
  getPomodorosForDate,
  getPomodorosForMonth,
  getOngoingEntry
} from './db'
import { playWorkComplete, playRestComplete, unlockAudio, stopAllSounds } from './sounds'
import { requestPermission, showTimerComplete } from './notifications'
import TimerWorker from './timerWorker.js?worker'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DURATION = 25
const MIN_DURATION = 0.01
const MAX_DURATION = 60
const REST_DURATION_MINUTES = 5
const SECONDS_PER_MINUTE = 60
const TIMER_INTERVAL_MS = 1000

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ============================================================================
// Utility Functions (pure, outside component to avoid recreation)
// ============================================================================

/**
 * Formats a Date object to YYYY-MM-DD string.
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDateToString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formats seconds to MM:SS display format.
 * @param {number} totalSeconds - Total seconds to format
 * @returns {string} Formatted time string (MM:SS)
 */
function formatTimeDisplay(totalSeconds) {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Calculates calendar information for a given month.
 * @param {Date} date - A date within the target month
 * @returns {Object} Object containing firstDayOfWeek and totalDays
 */
function getMonthCalendarInfo(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  return {
    firstDayOfWeek: new Date(year, month, 1).getDay(),
    totalDays: new Date(year, month + 1, 0).getDate()
  }
}

/**
 * Calculates remaining time for an ongoing entry.
 * @param {Object} entry - The entry with startedAt and duration
 * @returns {number} Remaining seconds (0 if expired)
 */
function calculateRemainingTime(entry) {
  const elapsedSeconds = Math.floor((Date.now() - entry.startedAt) / 1000)
  const totalSeconds = entry.duration * SECONDS_PER_MINUTE
  return Math.max(0, totalSeconds - elapsedSeconds)
}

// ============================================================================
// Main Component
// ============================================================================

function App() {
  // ---------------------------------------------------------------------------
  // State: Database & View
  // ---------------------------------------------------------------------------
  const [dbReady, setDbReady] = useState(false)
  const [view, setView] = useState('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [pomodoros, setPomodoros] = useState([])
  const [monthData, setMonthData] = useState({})

  // ---------------------------------------------------------------------------
  // State: Timer
  // ---------------------------------------------------------------------------
  const [activeEntry, setActiveEntry] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const completedRef = useRef(null)
  const workerRef = useRef(null)

  // ---------------------------------------------------------------------------
  // State: New Pomodoro Form
  // ---------------------------------------------------------------------------
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDuration, setNewDuration] = useState(String(DEFAULT_DURATION))

  // ---------------------------------------------------------------------------
  // Derived Values (memoized to avoid recalculation on every render)
  // ---------------------------------------------------------------------------
  const todayStr = useMemo(() => formatDateToString(new Date()), [])
  const currentDateStr = useMemo(() => formatDateToString(currentDate), [currentDate])
  const isPastDay = currentDateStr < todayStr
  const isFutureDay = currentDateStr > todayStr

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Initialize database and restore any ongoing timer
  useEffect(() => {
    initDb().then(() => {
      setDbReady(true)
      const ongoing = getOngoingEntry()
      if (ongoing) {
        const remaining = calculateRemainingTime(ongoing)
        if (remaining > 0) {
          setActiveEntry(ongoing)
          setTimeLeft(remaining)
          setIsRunning(true)

          // Start worker for resumed timer (worker may not be ready yet, so delay slightly)
          setTimeout(() => {
            const endTime = Date.now() + remaining * 1000
            workerRef.current?.postMessage({ type: 'start', endTime })
          }, 100)
        } else {
          completePomodoro(ongoing.id)
        }
      }
    })
  }, [])

  // Initialize Web Worker for background timing
  useEffect(() => {
    workerRef.current = new TimerWorker()

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'complete') {
        // Worker detected timer completion - trigger completion logic
        setTimeLeft(0)
      }
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  // Fetch data when view or date changes
  useEffect(() => {
    if (!dbReady || showTimer) return

    if (view === 'day') {
      setPomodoros(getPomodorosForDate(currentDateStr))
    } else {
      setMonthData(getPomodorosForMonth(currentDate.getFullYear(), currentDate.getMonth() + 1))
    }
  }, [dbReady, view, currentDate, currentDateStr, showTimer])

  // Timer countdown interval
  useEffect(() => {
    if (!isRunning || !activeEntry) return

    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, TIMER_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [isRunning, activeEntry])

  // Recalculate time when tab becomes visible (fixes browser throttling)
  // Also stop any looping sounds when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        stopAllSounds()
        if (isRunning && activeEntry) {
          const remaining = calculateRemainingTime(activeEntry)
          setTimeLeft(remaining)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isRunning, activeEntry])

  // Handle timer completion (pomodoro -> rest transition, or rest -> done)
  useEffect(() => {
    if (!isRunning || !activeEntry || timeLeft > 0) return
    if (completedRef.current === activeEntry.id) return

    completedRef.current = activeEntry.id
    completePomodoro(activeEntry.id)

    if (activeEntry.type === 'pomodoro') {
      // Start a rest period after pomodoro completion
      showTimerComplete('pomodoro', activeEntry.name, stopAllSounds)
      playWorkComplete()
      addRest(REST_DURATION_MINUTES, currentDateStr)
      const ongoing = getOngoingEntry()
      setActiveEntry(ongoing)
      setTimeLeft(REST_DURATION_MINUTES * SECONDS_PER_MINUTE)
      setPomodoros(getPomodorosForDate(currentDateStr))

      // Start worker for rest period
      const endTime = Date.now() + REST_DURATION_MINUTES * SECONDS_PER_MINUTE * 1000
      workerRef.current?.postMessage({ type: 'start', endTime })
    } else {
      // Rest period finished - reset timer state
      showTimerComplete('rest', activeEntry.name, stopAllSounds)
      playRestComplete()
      workerRef.current?.postMessage({ type: 'stop' })
      setPomodoros(getPomodorosForDate(currentDateStr))
      setIsRunning(false)
      setActiveEntry(null)
      completedRef.current = null
    }
  }, [timeLeft, isRunning, activeEntry, currentDateStr])

  // ---------------------------------------------------------------------------
  // Event Handlers (memoized with useCallback to prevent unnecessary re-renders)
  // ---------------------------------------------------------------------------

  const handleStartPomodoro = useCallback(() => {
    const trimmedName = newName.trim()
    if (!trimmedName || trimmedName.length > 100) return

    const duration = parseFloat(newDuration)
    if (isNaN(duration) || duration < MIN_DURATION || duration > MAX_DURATION) return

    unlockAudio()
    requestPermission() // Request notification permission on first timer start
    addPomodoro(trimmedName, duration, currentDateStr)
    const ongoing = getOngoingEntry()
    setActiveEntry(ongoing)
    setTimeLeft(duration * SECONDS_PER_MINUTE)
    setIsRunning(true)
    setShowTimer(true)
    setShowForm(false)
    setNewName('')
    setNewDuration(String(DEFAULT_DURATION))
    setPomodoros(getPomodorosForDate(currentDateStr))

    // Start worker for background timing
    const endTime = Date.now() + duration * SECONDS_PER_MINUTE * 1000
    workerRef.current?.postMessage({ type: 'start', endTime })
  }, [newName, newDuration, currentDateStr])

  const handleEntryClick = useCallback((entry) => {
    // Ignore completed or not-yet-started entries
    if (entry.completed || !entry.startedAt) return

    const remaining = calculateRemainingTime(entry)

    if (remaining > 0) {
      // Resume the ongoing timer
      unlockAudio()
      requestPermission() // Request notification permission when resuming
      const ongoing = getOngoingEntry()
      if (ongoing) {
        setActiveEntry(ongoing)
        setTimeLeft(remaining)
        setIsRunning(true)
        setShowTimer(true)

        // Start worker for background timing
        const endTime = Date.now() + remaining * 1000
        workerRef.current?.postMessage({ type: 'start', endTime })
      }
    } else {
      // Time expired - mark as complete
      completePomodoro(entry.id)
      setPomodoros(getPomodorosForDate(currentDateStr))
    }
  }, [currentDateStr])

  const handleManualComplete = useCallback(() => {
    if (!activeEntry) return

    workerRef.current?.postMessage({ type: 'stop' })
    completePomodoro(activeEntry.id)
    setPomodoros(getPomodorosForDate(currentDateStr))
    setIsRunning(false)
    setActiveEntry(null)
    setShowTimer(false)
  }, [activeEntry, currentDateStr])

  const navigateMonth = useCallback((delta) => {
    setCurrentDate(prevDate =>
      new Date(prevDate.getFullYear(), prevDate.getMonth() + delta, 1)
    )
  }, [])

  const selectDay = useCallback((day) => {
    setCurrentDate(prevDate =>
      new Date(prevDate.getFullYear(), prevDate.getMonth(), day)
    )
    setView('day')
  }, [])

  const handleShowForm = useCallback(() => setShowForm(true), [])
  const handleHideForm = useCallback(() => setShowForm(false), [])
  const handleHideTimer = useCallback(() => setShowTimer(false), [])
  const handleNameChange = useCallback((e) => setNewName(e.target.value), [])
  const handleDurationChange = useCallback((e) => {
    const value = e.target.value
    // Only allow digits
    if (value === '' || /^\d+$/.test(value)) {
      setNewDuration(value)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Memoized Computed Values
  // ---------------------------------------------------------------------------

  const calendarInfo = useMemo(
    () => getMonthCalendarInfo(currentDate),
    [currentDate]
  )

  // ---------------------------------------------------------------------------
  // Render: Loading State
  // ---------------------------------------------------------------------------

  if (!dbReady) {
    return (
      <div className="container">
        <h1>Loading...</h1>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Active Timer View
  // ---------------------------------------------------------------------------

  if (activeEntry && showTimer) {
    const isRest = activeEntry.type === 'rest'
    return (
      <div className="container">
        <button className="back-btn" onClick={handleHideTimer}>
          ← Back
        </button>
        <div className="status-badge">
          {isRest ? 'Rest Time' : 'Work Time'}
        </div>
        <h2 className="pomodoro-name">{activeEntry.name}</h2>
        <div className="timer-display">{formatTimeDisplay(timeLeft)}</div>
        <button className="control-btn complete-btn" onClick={handleManualComplete}>
          Mark Complete
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Main View
  // ---------------------------------------------------------------------------

  return (
    <div className="container">
      <h1>Pomodoro</h1>

      {/* View Toggle */}
      <div className="view-toggle">
        <button
          className={`toggle-btn ${view === 'day' ? 'active' : ''}`}
          onClick={() => setView('day')}
        >
          Day
        </button>
        <button
          className={`toggle-btn ${view === 'month' ? 'active' : ''}`}
          onClick={() => setView('month')}
        >
          Month
        </button>
      </div>

      {view === 'day' ? (
        // ---------------------------------------------------------------------
        // Day View
        // ---------------------------------------------------------------------
        <div className="day-view">
          <h2 className="date-header">
            {currentDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </h2>

          {/* New Pomodoro Section */}
          {isPastDay || isFutureDay ? (
            <p className="past-day-notice">
              {isPastDay
                ? "You can't start a new timer on a previous day"
                : "You can't start a new timer on a future day"}
            </p>
          ) : showForm ? (
            <div className="new-pomodoro-form">
              <input
                type="text"
                placeholder="Pomodoro name..."
                value={newName}
                onChange={handleNameChange}
                className="name-input"
                maxLength={100}
                autoFocus
              />
              <div className="duration-input-wrapper">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="25"
                  value={newDuration}
                  onChange={handleDurationChange}
                  className="duration-input"
                  maxLength={2}
                />
                <span className="duration-label">minutes (1-60)</span>
              </div>
              <div className="form-actions">
                <button className="control-btn start" onClick={handleStartPomodoro}>
                  Start
                </button>
                <button className="control-btn reset" onClick={handleHideForm}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="new-pomodoro-btn" onClick={handleShowForm}>
              + New Pomodoro
            </button>
          )}

          {/* Timeline */}
          <div className="timeline">
            {pomodoros.map(entry => {
              const isOngoing = isRunning && activeEntry?.id === entry.id
              const isRest = entry.type === 'rest'
              const itemClasses = [
                'timeline-item',
                isRest ? 'rest-item' : 'pomodoro-item',
                entry.completed && 'completed',
                isOngoing && 'ongoing'
              ].filter(Boolean).join(' ')

              return (
                <div key={entry.id} className="timeline-segment">
                  <div className={itemClasses} onClick={() => handleEntryClick(entry)}>
                    <span>{entry.name}</span>
                    <span className="duration">
                      {isOngoing ? formatTimeDisplay(timeLeft) : `${entry.duration}m`}
                      {entry.completed ? ' ✓' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
            {pomodoros.length === 0 && !isFutureDay && (
              <p className="empty">
                {isPastDay ? 'No pomodoros for this day' : 'No pomodoros yet today'}
              </p>
            )}
          </div>
        </div>
      ) : (
        // ---------------------------------------------------------------------
        // Month View
        // ---------------------------------------------------------------------
        <div className="month-view">
          <div className="month-nav">
            <button className="nav-btn" onClick={() => navigateMonth(-1)}>
              ←
            </button>
            <h2>
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button className="nav-btn" onClick={() => navigateMonth(1)}>
              →
            </button>
          </div>

          <div className="calendar-grid">
            {/* Weekday Headers */}
            {WEEKDAY_LABELS.map(day => (
              <div key={day} className="calendar-header">{day}</div>
            ))}

            {/* Empty cells before first day of month */}
            {Array.from({ length: calendarInfo.firstDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="calendar-day empty" />
            ))}

            {/* Calendar days */}
            {Array.from({ length: calendarInfo.totalDays }).map((_, index) => {
              const day = index + 1
              const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const count = monthData[dateStr] || 0
              const isToday = dateStr === todayStr
              const isFuture = dateStr > todayStr
              const dayClasses = [
                'calendar-day',
                isToday && 'today',
                isFuture && 'future'
              ].filter(Boolean).join(' ')

              return (
                <div
                  key={day}
                  className={dayClasses}
                  onClick={() => selectDay(day)}
                >
                  <span className="day-number">{day}</span>
                  {count > 0 && <span className="day-count">{count}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
