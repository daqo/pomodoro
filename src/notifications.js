// Notification API wrapper for timer completion alerts

/**
 * Requests permission to show notifications.
 * @returns {Promise<boolean>} True if permission granted
 */
export async function requestPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

/**
 * Shows a notification for timer completion.
 * @param {'pomodoro' | 'rest'} type - The type of timer that completed
 * @param {string} name - The name of the pomodoro
 */
export function showTimerComplete(type, name) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return
  }

  const isWork = type === 'pomodoro'
  const title = isWork ? 'Work Complete!' : 'Rest Complete!'
  const body = isWork
    ? `"${name}" finished. Time for a break!`
    : 'Break is over. Ready to work?'

  const notification = new Notification(title, {
    body,
    icon: '/pomodoro/favicon.svg',
    tag: 'pomodoro-timer',
    requireInteraction: true
  })

  // Close notification after 10 seconds
  setTimeout(() => notification.close(), 10000)

  // Focus the tab when notification is clicked
  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}
