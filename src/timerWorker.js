// Timer Web Worker - runs in background even when tab is inactive
// Receives: { type: 'start', endTime: timestamp } or { type: 'stop' }
// Posts: { type: 'complete' } when timer finishes

let intervalId = null

self.onmessage = (e) => {
  if (e.data.type === 'start') {
    clearInterval(intervalId)
    intervalId = setInterval(() => {
      if (Date.now() >= e.data.endTime) {
        self.postMessage({ type: 'complete' })
        clearInterval(intervalId)
        intervalId = null
      }
    }, 1000)
  } else if (e.data.type === 'stop') {
    clearInterval(intervalId)
    intervalId = null
  }
}
