const workCompleteSound = new Audio('/work-complete.wav')
const restCompleteSound = new Audio('/rest-complete.wav')

export function playWorkComplete() {
  workCompleteSound.currentTime = 0
  workCompleteSound.play().catch(() => {})
}

export function playRestComplete() {
  restCompleteSound.currentTime = 0
  restCompleteSound.play().catch(() => {})
}
