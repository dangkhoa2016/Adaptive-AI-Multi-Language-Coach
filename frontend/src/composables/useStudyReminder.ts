export function useStudyReminder() {
  async function checkAndNotify() {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      if (result !== 'granted') return
    }
    if (Notification.permission !== 'granted') return

    try {
      const { fetchReviewStats } = await import('../api/client')
      const stats = await fetchReviewStats()
      if (stats.dueCount > 0) {
        new Notification('AI Vocab Coach', {
          body: `You have ${stats.dueCount} card(s) due for review!`,
          icon: '/favicon.svg',
        })
      }
    } catch {
      /* silent */
    }
  }

  return { checkAndNotify }
}
