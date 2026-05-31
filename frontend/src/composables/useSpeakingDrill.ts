import { ref } from 'vue'
import { submitSttAudio } from '../api/client'

export function useSpeakingDrill() {
  const isRecording = ref(false)
  const transcript = ref('')
  const similarity = ref<number | null>(null)
  const error = ref<string | null>(null)
  const isProcessing = ref(false)

  let mediaRecorder: MediaRecorder | null = null
  const chunks: BlobPart[] = []

  async function startRecording() {
    error.value = null
    transcript.value = ''
    similarity.value = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder = new MediaRecorder(stream)
      chunks.length = 0

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        await sendToStt(blob)
      }

      mediaRecorder.start()
      isRecording.value = true
    } catch {
      error.value = 'drills.mic_error'
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      isRecording.value = false
    }
  }

  async function sendToStt(blob: Blob, referenceText?: string) {
    isProcessing.value = true
    error.value = null
    try {
      const result = await submitSttAudio(blob, referenceText ?? '')
      transcript.value = result.transcript
      similarity.value = result.similarity
    } catch {
      error.value = 'errors.internal_error'
    } finally {
      isProcessing.value = false
    }
  }

  function reset() {
    transcript.value = ''
    similarity.value = null
    error.value = null
    isProcessing.value = false
    isRecording.value = false
  }

  return {
    isRecording,
    transcript,
    similarity,
    error,
    isProcessing,
    startRecording,
    stopRecording,
    reset,
  }
}
