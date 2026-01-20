const basePath = import.meta.env.BASE_URL
const workCompleteSound = new Audio(basePath + 'work-complete.wav')
const restCompleteSound = new Audio(basePath + 'rest-complete.wav')

// Call this on user interaction (e.g., Start button) to unlock audio for later playback
export function unlockAudio() {
  const originalVolume = workCompleteSound.volume
  workCompleteSound.volume = 0
  restCompleteSound.volume = 0

  workCompleteSound.play().then(() => {
    workCompleteSound.pause()
    workCompleteSound.currentTime = 0
    workCompleteSound.volume = originalVolume
  }).catch(() => {})

  restCompleteSound.play().then(() => {
    restCompleteSound.pause()
    restCompleteSound.currentTime = 0
    restCompleteSound.volume = originalVolume
  }).catch(() => {})
}

export function playWorkComplete(loop = true) {
  workCompleteSound.currentTime = 0
  workCompleteSound.loop = loop
  workCompleteSound.play().catch((error) => {
    console.error('Failed to play work complete sound:', error.message)
  })
}

export function playRestComplete(loop = true) {
  restCompleteSound.currentTime = 0
  restCompleteSound.loop = loop
  restCompleteSound.play().catch((error) => {
    console.error('Failed to play rest complete sound:', error.message)
  })
}

export function stopAllSounds() {
  workCompleteSound.pause()
  workCompleteSound.currentTime = 0
  workCompleteSound.loop = false
  restCompleteSound.pause()
  restCompleteSound.currentTime = 0
  restCompleteSound.loop = false
}
