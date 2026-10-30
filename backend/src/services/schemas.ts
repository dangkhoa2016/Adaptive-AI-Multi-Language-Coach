import { z } from 'zod'
import { SUPPORTED_LOCALES } from '@vocab/shared'
import { TOPIC_KEYS } from '../i18n/topics'

export const generateRequestSchema = z.object({
  source: z.enum(SUPPORTED_LOCALES),
  target: z.enum(SUPPORTED_LOCALES),
  topic: z.enum(TOPIC_KEYS),
  level: z.enum(['A1', 'A2', 'B1', 'B2']),
  count: z.number().int().min(1).max(50).default(10),
  uiLocale: z.enum(SUPPORTED_LOCALES).optional().default('en'),
  mode: z.enum(['word', 'phrase', 'mix']).default('mix'),
})

export const vocabPairSchema = z.object({
  source: z.string().min(1).max(2000),
  target: z.string().min(1).max(2000),
  exampleSource: z.string().max(2000).optional().default(''),
  exampleTarget: z.string().max(2000).optional().default(''),
  ipa: z.string().max(2000).optional().default(''),
  pos: z.string().max(2000).optional().default(''),
  isPhrase: z
    .union([z.boolean(), z.number()])
    .transform((v) => !!v)
    .default(false),
})

export const generateResponseSchema = z.object({
  pairs: z.array(vocabPairSchema).min(1).max(50),
})

export type GenerateRequest = z.infer<typeof generateRequestSchema>
export type VocabPair = z.infer<typeof vocabPairSchema>
export type GenerateResponse = z.infer<typeof generateResponseSchema>
