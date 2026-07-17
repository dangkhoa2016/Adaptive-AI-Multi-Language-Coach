import type { VocabPair } from './schemas'

/**
 * Generates a quiz question for a given vocab pair.
 * Returns the pair plus 3 distractor target values and the index of the correct answer.
 */
export interface QuizQuestion {
  pair: VocabPair
  options: string[]
  correctIndex: number
}

/**
 * Creates quiz questions from pairs, using a pool of distractors.
 * Distractors should ideally come from the same topic+level+target language pool.
 *
 * @param pairs - vocabulary pairs to quiz
 * @param distractorPool - additional target-language strings to use as wrong answers
 */
export function createQuizQuestions(
  pairs: VocabPair[],
  distractorPool: string[] = [],
): QuizQuestion[] {
  const shuffled = [...pairs].sort(() => Math.random() - 0.5)
  return shuffled.map((pair) => {
    const distractors = distractorPool.filter((d) => d !== pair.target).slice(0, 3)

    // If we don't have enough distractors, pad with generic options
    while (distractors.length < 3) {
      distractors.push('(unknown)')
    }

    // Shuffle distractors and pick exactly 3
    const shuffled = distractors.sort(() => Math.random() - 0.5).slice(0, 3)

    // Insert correct answer at random position
    const options = [...shuffled, pair.target]
    const correctIndex = Math.floor(Math.random() * 4)
    // Swap the last element (correct) to the random position
    ;[options[3], options[correctIndex]] = [options[correctIndex], options[3]]

    return { pair, options, correctIndex }
  })
}
