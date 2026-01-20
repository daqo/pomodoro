import { useState, useEffect, useRef } from 'react'
import { initDb, addPomodoro, addRest, completePomodoro, getPomodorosForDate, getPomodorosForMonth, getOngoingEntry } from './db'

const DURATION_OPTIONS = [0.1, 45, 55]
const REST_DURATION = 5

function App() {
  const [dbReady, setDbReady] = useState(false)
  const [view, setView] = useState('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [pomodoros, setPomodoros] = useState([])
  const [monthData, setMonthData] = useState({})

  // Timer state
  const [activeEntry, setActiveEntry] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const completedRef = useRef(null)

  // New pomodoro form
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDuration, setNewDuration] = useState(DURATION_OPTIONS[0])

  const formatDate = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const today = new Date()
  const todayStr = formatDate(today)
  const currentDateStr = formatDate(currentDate)
  const isPastDay = currentDateStr < todayStr
  const isFutureDay = currentDateStr > todayStr

  useEffect(() => {
    initDb().then(() => {
      setDbReady(true)
      const ongoing = getOngoingEntry()
      if (ongoing) {
        const elapsed = Math.floor((Date.now() - ongoing.startedAt) / 1000)
        const totalDuration = ongoing.duration * 60
        const remaining = totalDuration - elapsed
        if (remaining > 0) {
          setActiveEntry(ongoing)
          setTimeLeft(remaining)
          setIsRunning(true)
        } else {
          completePomodoro(ongoing.id)
        }
      }
    })
  }, [])

  useEffect(() => {
    if (!dbReady) return
    if (showTimer) return // Don't fetch when in timer view
    if (view === 'day') {
      setPomodoros(getPomodorosForDate(formatDate(currentDate)))
      // Sync activeEntry with database when returning to day view
      if (isRunning) {
        const ongoing = getOngoingEntry()
        if (ongoing) {
          setActiveEntry(ongoing)
        }
      }
    } else {
      setMonthData(getPomodorosForMonth(currentDate.getFullYear(), currentDate.getMonth() + 1))
    }
  }, [dbReady, view, currentDate, showTimer, isRunning])

  useEffect(() => {
    if (!isRunning || !activeEntry) return
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, activeEntry])

  useEffect(() => {
    if (!isRunning || !activeEntry || timeLeft > 0) return
    if (completedRef.current === activeEntry.id) return

    completedRef.current = activeEntry.id
    completePomodoro(activeEntry.id)

    if (activeEntry.type === 'pomodoro') {
      // Start a rest period
      addRest(REST_DURATION, formatDate(currentDate))
      const ongoing = getOngoingEntry()
      setActiveEntry(ongoing)
      setTimeLeft(REST_DURATION * 60)
      setPomodoros(getPomodorosForDate(formatDate(currentDate)))
    } else {
      // Rest finished
      setPomodoros(getPomodorosForDate(formatDate(currentDate)))
      setIsRunning(false)
      setActiveEntry(null)
      completedRef.current = null
    }
  }, [timeLeft, isRunning, activeEntry, currentDate])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartPomodoro = () => {
    if (!newName.trim()) return
    addPomodoro(newName.trim(), newDuration, formatDate(currentDate))
    const ongoing = getOngoingEntry()
    setActiveEntry(ongoing)
    setTimeLeft(newDuration * 60)
    setIsRunning(true)
    setShowTimer(true)
    setShowForm(false)
    setNewName('')
    setPomodoros(getPomodorosForDate(formatDate(currentDate)))
  }

  const handleEntryClick = (entry) => {
    if (entry.completed) return
    if (!entry.startedAt) return

    // Calculate remaining time
    const elapsed = Math.floor((Date.now() - entry.startedAt) / 1000)
    const totalDuration = entry.duration * 60
    const remaining = totalDuration - elapsed

    if (remaining > 0) {
      setActiveEntry(entry)
      setTimeLeft(remaining)
      setIsRunning(true)
      setShowTimer(true)
    } else {
      // Time expired, mark as complete
      completePomodoro(entry.id)
      setPomodoros(getPomodorosForDate(formatDate(currentDate)))
    }
  }


  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return { firstDay, daysInMonth }
  }

  const navigateMonth = (delta) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1))
  }

  const selectDay = (day) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
    setView('day')
  }

  if (!dbReady) return <div className="container"><h1>Loading...</h1></div>

  const handleManualComplete = () => {
    completePomodoro(activeEntry.id)
    setPomodoros(getPomodorosForDate(formatDate(currentDate)))
    setIsRunning(false)
    setActiveEntry(null)
    setShowTimer(false)
  }

  // Active timer view
  if (activeEntry && showTimer) {
    const isRest = activeEntry.type === 'rest'
    return (
      <div className="container">
        <button className="back-btn" onClick={() => setShowTimer(false)}>← Back</button>
        <div className="status-badge">{isRest ? 'Rest Time' : 'Work Time'}</div>
        <h2 className="pomodoro-name">{activeEntry.name}</h2>
        <div className="timer-display">{formatTime(timeLeft)}</div>
        <button className="control-btn complete-btn" onClick={handleManualComplete}>Mark Complete</button>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>Pomodoro</h1>

      <div className="view-toggle">
        <button className={`toggle-btn ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')}>Day</button>
        <button className={`toggle-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Month</button>
      </div>

      {view === 'day' ? (
        <div className="day-view">
          <h2 className="date-header">{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>

          {isPastDay || isFutureDay ? (
            <p className="past-day-notice">
              {isPastDay ? "You can't start a new timer on a previous day" : "You can't start a new timer on a future day"}
            </p>
          ) : showForm ? (
            <div className="new-pomodoro-form">
              <input
                type="text"
                placeholder="Pomodoro name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="name-input"
                autoFocus
              />
              <div className="duration-selector">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    className={`duration-btn ${newDuration === d ? 'active' : ''}`}
                    onClick={() => setNewDuration(d)}
                  >
                    {d}m
                  </button>
                ))}
              </div>
              <div className="form-actions">
                <button className="control-btn start" onClick={handleStartPomodoro}>Start</button>
                <button className="control-btn reset" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="new-pomodoro-btn" onClick={() => setShowForm(true)}>+ New Pomodoro</button>
          )}

          <div className="timeline">
            {pomodoros.map((entry) => {
              const isOngoing = isRunning && activeEntry != null && String(entry.id) === String(activeEntry.id)
              const isRest = entry.type === 'rest'
              return (
                <div key={entry.id} className="timeline-segment">
                  <div
                    className={`timeline-item ${isRest ? 'rest-item' : 'pomodoro-item'} ${entry.completed ? 'completed' : ''} ${isOngoing ? 'ongoing' : ''}`}
                    onClick={() => handleEntryClick(entry)}
                  >
                    <span>{entry.name}</span>
                    <span className="duration">
                      {isOngoing ? formatTime(timeLeft) : `${entry.duration}m`}
                      {entry.completed ? ' ✓' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
            {pomodoros.length === 0 && !isFutureDay && (
              <p className="empty">{isPastDay ? 'No pomodoros for this day' : 'No pomodoros yet today'}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="month-view">
          <div className="month-nav">
            <button className="nav-btn" onClick={() => navigateMonth(-1)}>←</button>
            <h2>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
            <button className="nav-btn" onClick={() => navigateMonth(1)}>→</button>
          </div>
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="calendar-header">{d}</div>
            ))}
            {Array.from({ length: getDaysInMonth(currentDate).firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="calendar-day empty"></div>
            ))}
            {Array.from({ length: getDaysInMonth(currentDate).daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const count = monthData[dateStr] || 0
              const isToday = dateStr === todayStr
              const isFuture = dateStr > todayStr
              return (
                <div key={day} className={`calendar-day ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}`} onClick={() => selectDay(day)}>
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
