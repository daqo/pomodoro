import initSqlJs from 'sql.js'

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'pomodoro_db'
const SQL_JS_CDN = 'https://sql.js.org/dist/'

const ENTRY_TYPE = {
  POMODORO: 'pomodoro',
  REST: 'rest'
}

// Column indices for row mapping (matches SELECT order)
const COL = {
  ID: 0,
  NAME: 1,
  DURATION: 2,
  DATE: 3,
  COMPLETED: 4,
  STARTED_AT: 5,
  TYPE: 6
}

// ============================================================================
// Database Instance
// ============================================================================

let db = null

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Maps a database row array to a structured entry object.
 * @param {Array} row - Raw database row
 * @returns {Object} Structured entry object
 */
function mapRowToEntry(row) {
  return {
    id: row[COL.ID],
    name: row[COL.NAME],
    duration: row[COL.DURATION],
    date: row[COL.DATE],
    completed: row[COL.COMPLETED],
    startedAt: row[COL.STARTED_AT],
    type: row[COL.TYPE] || ENTRY_TYPE.POMODORO
  }
}

/**
 * Persists the current database state to localStorage.
 */
function saveDb() {
  const data = db.export()
  const base64 = btoa(String.fromCharCode(...data))
  localStorage.setItem(STORAGE_KEY, base64)
}

/**
 * Retrieves the ID of the last inserted row.
 * @returns {number} The last inserted row ID
 */
function getLastInsertId() {
  return db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]
}

/**
 * Inserts a new entry (pomodoro or rest) into the database.
 * @param {string} name - Entry name
 * @param {number} duration - Duration in minutes
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} type - Entry type (ENTRY_TYPE.POMODORO or ENTRY_TYPE.REST)
 * @returns {Object} Object containing id and startedAt timestamp
 */
function insertEntry(name, duration, date, type) {
  const startedAt = Date.now()
  db.run(
    'INSERT INTO pomodoros (name, duration, date, started_at, type) VALUES (?, ?, ?, ?, ?)',
    [name, duration, date, startedAt, type]
  )
  saveDb()
  return { id: getLastInsertId(), startedAt }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initializes the SQLite database, loading from localStorage if available.
 * Handles schema migrations for existing databases.
 * @returns {Promise<Object>} The initialized database instance
 */
export async function initDb() {
  const SQL = await initSqlJs({
    locateFile: file => `${SQL_JS_CDN}${file}`
  })

  const saved = localStorage.getItem(STORAGE_KEY)

  if (saved) {
    const data = Uint8Array.from(atob(saved), c => c.charCodeAt(0))
    db = new SQL.Database(data)
    runMigrations()
  } else {
    db = new SQL.Database()
    createSchema()
  }

  return db
}

/**
 * Creates the initial database schema.
 */
function createSchema() {
  db.run(`
    CREATE TABLE pomodoros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      started_at INTEGER,
      type TEXT DEFAULT 'pomodoro'
    )
  `)
}

/**
 * Runs any necessary database migrations.
 */
function runMigrations() {
  // Migration: add type column if it doesn't exist
  const columns = db.exec('PRAGMA table_info(pomodoros)')
  const hasTypeColumn = columns[0]?.values.some(col => col[1] === 'type')

  if (!hasTypeColumn) {
    db.run("ALTER TABLE pomodoros ADD COLUMN type TEXT DEFAULT 'pomodoro'")
    saveDb()
  }
}

/**
 * Adds a new pomodoro entry and starts it immediately.
 * @param {string} name - Name/description of the pomodoro
 * @param {number} duration - Duration in minutes
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Object} Object containing id and startedAt timestamp
 */
export function addPomodoro(name, duration, date) {
  return insertEntry(name, duration, date, ENTRY_TYPE.POMODORO)
}

/**
 * Adds a new rest entry and starts it immediately.
 * @param {number} duration - Duration in minutes
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Object} Object containing id and startedAt timestamp
 */
export function addRest(duration, date) {
  return insertEntry('Rest', duration, date, ENTRY_TYPE.REST)
}

/**
 * Marks an entry as completed.
 * @param {number} id - The entry ID to mark as complete
 */
export function completePomodoro(id) {
  db.run('UPDATE pomodoros SET completed = 1 WHERE id = ?', [id])
  saveDb()
}

/**
 * Retrieves all entries for a specific date.
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Array<Object>} Array of entry objects, sorted by start time
 */
export function getPomodorosForDate(date) {
  const result = db.exec(
    'SELECT id, name, duration, date, completed, started_at, type FROM pomodoros WHERE date = ? ORDER BY started_at ASC',
    [date]
  )

  if (!result.length) return []
  return result[0].values.map(mapRowToEntry)
}

/**
 * Retrieves the currently active (ongoing) entry, if any.
 * @returns {Object|null} The ongoing entry or null if none exists
 */
export function getOngoingEntry() {
  const result = db.exec(
    'SELECT id, name, duration, date, completed, started_at, type FROM pomodoros WHERE completed = 0 AND started_at IS NOT NULL ORDER BY id DESC LIMIT 1'
  )

  if (!result.length || !result[0].values.length) return null
  return mapRowToEntry(result[0].values[0])
}

/**
 * Retrieves completed pomodoro counts grouped by date for a given month.
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {Object} Object mapping date strings to pomodoro counts
 */
export function getPomodorosForMonth(year, month) {
  const pattern = `${year}-${String(month).padStart(2, '0')}%`
  const query = `
    SELECT date, COUNT(*) as count
    FROM pomodoros
    WHERE date LIKE ? AND type = ? AND completed = 1
    GROUP BY date
  `
  const result = db.exec(query, [pattern, ENTRY_TYPE.POMODORO])

  if (!result.length) return {}
  return Object.fromEntries(result[0].values)
}
