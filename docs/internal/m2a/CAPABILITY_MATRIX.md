# Eight-locale capability matrix

Internal M2-A evidence. UI availability is resource/route existence, not a linguistic review. No live provider/model/audio support has been validated. Backend source `services/tts.ts` still maps vi/fr/th/de to English; these rows are **incorrect for a corresponding language claim**, never supported Vietnamese/French/Thai/German audio.

| Locale | UI                    | Content validated | TTS validated | Configured TTS language / claim   | STT validated | Text similarity           | Human quality | Live provider |
| ------ | --------------------- | ----------------- | ------------- | --------------------------------- | ------------- | ------------------------- | ------------- | ------------- |
| en     | IMPLEMENTED resources | UNKNOWN           | NOT_RUN       | en / UNKNOWN_REAL_AUDIO           | NOT_RUN       | offline Unicode test only | NOT_EVALUATED | NOT_RUN       |
| vi     | IMPLEMENTED resources | UNKNOWN           | NOT_RUN       | en / INCORRECT_FOR_LANGUAGE_CLAIM | NOT_RUN       | offline Unicode test only | NOT_EVALUATED | NOT_RUN       |
| ja     | IMPLEMENTED resources | UNKNOWN           | NOT_RUN       | ja / UNKNOWN_REAL_AUDIO           | NOT_RUN       | offline Unicode test only | NOT_EVALUATED | NOT_RUN       |
| ko     | IMPLEMENTED resources | UNKNOWN           | NOT_RUN       | ko / UNKNOWN_REAL_AUDIO           | NOT_RUN       | offline Unicode test only | NOT_EVALUATED | NOT_RUN       |
| th     | IMPLEMENTED resources | UNKNOWN           | NOT_RUN       | en / INCORRECT_FOR_LANGUAGE_CLAIM | NOT_RUN       | offline Unicode test only | NOT_EVALUATED | NOT_RUN       |
| zh     | IMPLEMENTED resources | UNKNOWN           | NOT_RUN       | zh / UNKNOWN_REAL_AUDIO           | NOT_RUN       | offline Unicode test only | NOT_EVALUATED | NOT_RUN       |
| fr     | IMPLEMENTED resources | UNKNOWN           | NOT_RUN       | en / INCORRECT_FOR_LANGUAGE_CLAIM | NOT_RUN       | offline Unicode test only | NOT_EVALUATED | NOT_RUN       |
| de     | IMPLEMENTED resources | UNKNOWN           | NOT_RUN       | en / INCORRECT_FOR_LANGUAGE_CLAIM | NOT_RUN       | offline Unicode test only | NOT_EVALUATED | NOT_RUN       |

Evidence: `packages/shared/src/locales.ts`, `frontend/src/i18n/messages/{en,vi,ja,ko,th,zh,fr,de}.json`, `backend/src/services/{tts,stt}.ts`, `backend/test/services/{tts,m2-offline}.test.ts`. Existing TTS tests only capture arguments passed to a fake binding. A configured model/language or fake audio is not real audio evidence. The final native provider runtime gate uses a synthetic local outbound service, not an AI provider.

`computeSimilarity` now preserves NFC letters/marks/numbers, including Vietnamese tones. Counterexamples for en/vi/ja/ko/th/zh/fr/de-related scripts and café/cafe verify structural distinctions only. German-specific transcription and locale-specific tokenization have not been evaluated. The algorithm uses Levenshtein over UTF-16 code units, ignores punctuation/case/whitespace, and is not locale-aware segmentation, semantic correctness, accent scoring or pronunciation assessment. Unicode preservation does not validate STT. The recording composable still omits the reference sentence, normally returning similarity null; fix requires separately scoped frontend behavior work. No recording made.

IPA is unreviewed: prompt source-en IPA instructions and stored strings do not verify accent/dialect/transcription accuracy. There are zero completed lexical reviews and zero independent IPA/accent assessments. Lane B and C quality remain NOT_EVALUATED/NOT_RUN.
