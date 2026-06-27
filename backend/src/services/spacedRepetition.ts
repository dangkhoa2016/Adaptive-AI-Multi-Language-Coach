export interface SM2Input {
  ease: number
  interval: number
  repetitions: number
}

export interface SM2Result {
  ease: number
  interval: number
  repetitions: number
  nextReview: string
  status: 'learning' | 'mastered'
}

export function sm2(quality: number, previous: SM2Input): SM2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)))

  let newEase = previous.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  newEase = Math.max(1.3, newEase)

  let newInterval: number
  let newRepetitions: number

  if (q < 3) {
    newInterval = 0
    newRepetitions = 0
  } else {
    newRepetitions = previous.repetitions + 1
    if (newRepetitions === 1) {
      newInterval = 1
    } else if (newRepetitions === 2) {
      newInterval = 6
    } else {
      newInterval = Math.round(previous.interval * newEase)
    }
  }

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + (newInterval || 0))

  return {
    ease: Math.round(newEase * 100) / 100,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReview: nextDate.toISOString().split('T')[0],
    status: newInterval >= 365 ? 'mastered' : 'learning',
  }
}
