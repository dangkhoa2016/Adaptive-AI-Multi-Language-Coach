import type { GenerateRequest } from './schemas'

/**
 * Builds a system prompt for the AI vocabulary generation model.
 * The prompt is dynamic based on source/target languages and mode.
 */
export function buildGeneratePrompt(req: GenerateRequest): string {
  const modeInstruction = (() => {
    switch (req.mode) {
      case 'word':
        return 'Generate ONLY single words (1-2 words maximum). Do NOT include phrases, collocations, or idioms.'
      case 'phrase':
        return 'Generate ONLY phrases, collocations, phrasal verbs, or common idioms. Do NOT include single words.'
      case 'mix':
        return 'Generate a mix of single words AND phrases/collocations/idioms (roughly 50/50).'
    }
  })()

  const ipaInstruction =
    req.source === 'en'
      ? 'Include IPA phonetic transcriptions for each word/phrase.'
      : 'Leave IPA empty (ipa: "") unless the language uses phonetic alphabets.'

  return `You are a professional language teacher and linguist. Generate exactly ${req.count} vocabulary items for a language learning app.

Parameters:
- Source language: ${req.source}
- Target language: ${req.target}
- Topic: ${req.topic}
- CEFR level: ${req.level}
- Mode: ${req.mode}

Instructions:
1. ${modeInstruction}
2. All vocabulary should be appropriate for CEFR level ${req.level}.
3. All vocabulary should relate to the topic "${req.topic}".
4. For each item, provide:
   - "source": the word/phrase in the source language (${req.source})
   - "target": the translation in the target language (${req.target})
   - "exampleSource": an example sentence using the word/phrase in the source language
   - "exampleTarget": the translation of that example sentence in the target language
   - "ipa": phonetic transcription (${ipaInstruction})
   - "pos": part of speech (e.g., "noun", "verb", "adjective", "noun phrase", "phrasal verb", "idiom")
   - "isPhrase": true if this is a phrase/collocation/idiom (more than 1 word that forms a unit), false for single words
5. Output ONLY valid JSON in this exact format:
{"pairs":[{"source":"","target":"","exampleSource":"","exampleTarget":"","ipa":"","pos":"","isPhrase":false}]}

Do NOT include any explanation text before or after the JSON.`
}
