import initSqlJs from 'sql.js'

let db = null

export async function initDb() {
  const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  })

  const saved = localStorage.getItem('pomodoro_db')
  if (saved) {
    const data = Uint8Array.from(atob(saved), c => c.charCodeAt(0))
    db = new SQL.Database(data)
    // Migration: add type column if it doesn't exist
    const columns = db.exec("PRAGMA table_info(pomodoros)")
    const hasType = columns[0]?.values.some(col => col[1] === 'type')
    if (!hasType) {
      db.run("ALTER TABLE pomodoros ADD COLUMN type TEXT DEFAULT 'pomodoro'")
      saveDb()
    }
  } else {
    db = new SQL.Database()
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
  return db
}

function saveDb() {
  const data = db.export()
  const base64 = btoa(String.fromCharCode(...data))
  localStorage.setItem('pomodoro_db', base64)
}

export function addPomodoro(name, duration, date) {
  const startedAt = Date.now()
  db.run("INSERT INTO pomodoros (name, duration, date, started_at, type) VALUES (?, ?, ?, ?, 'pomodoro')", [name, duration, date, startedAt])
  saveDb()
  return { id: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0], startedAt }
}

export function addRest(duration, date) {
  const startedAt = Date.now()
  db.run("INSERT INTO pomodoros (name, duration, date, started_at, type) VALUES (?, ?, ?, ?, 'rest')", ['Rest', duration, date, startedAt])
  saveDb()
  return { id: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0], startedAt }
}

export function completePomodoro(id) {
  db.run('UPDATE pomodoros SET completed = 1 WHERE id = ?', [id])
  saveDb()
}

export function getPomodorosForDate(date) {
  const result = db.exec('SELECT id, name, duration, date, completed, started_at, type FROM pomodoros WHERE date = ? ORDER BY started_at ASC', [date])
  if (!result.length) return []
  return result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    duration: row[2],
    date: row[3],
    completed: row[4],
    startedAt: row[5],
    type: row[6] || 'pomodoro'
  }))
}

export function getOngoingEntry() {
  const result = db.exec('SELECT id, name, duration, date, completed, started_at, type FROM pomodoros WHERE completed = 0 AND started_at IS NOT NULL ORDER BY id DESC LIMIT 1')
  if (!result.length || !result[0].values.length) return null
  const row = result[0].values[0]
  return {
    id: row[0],
    name: row[1],
    duration: row[2],
    date: row[3],
    completed: row[4],
    startedAt: row[5],
    type: row[6] || 'pomodoro'
  }
}

export function getPomodorosForMonth(year, month) {
  const pattern = `${year}-${String(month).padStart(2, '0')}%`
  let sql_query = 'SELECT date, COUNT(*) as count FROM pomodoros WHERE date LIKE ? AND type="pomodoro" AND completed=1 GROUP BY date'
  const result = db.exec(sql_query, [pattern])
  if (!result.length) return {}
  return Object.fromEntries(result[0].values.map(row => [row[0], row[1]]))
}
