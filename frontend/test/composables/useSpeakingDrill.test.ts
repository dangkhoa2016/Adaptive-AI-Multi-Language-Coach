import { describe, expect, it, beforeEach, vi } from 'vitest'
import { submitSttAudio } from '../../src/api/client'
import { useSpeakingDrill } from '../../src/composables/useSpeakingDrill'

vi.mock('../../src/api/client', () => ({
  submitSttAudio: vi.fn(),
}))

function makeMockRecorder() {
  const recorder = {
    start: vi.fn(function (this: typeof recorder) {
      this.state = 'recording'
    }),
    stop: vi.fn(function (this: typeof recorder) {
      this.state = 'inactive'
      if (typeof this.onstop === 'function') this.onstop()
    }),
    state: 'inactive',
    ondataavailable: null as ((e: any) => void) | null,
    onstop: null as (() => void) | null,
  }
  return recorder
}

function mockMediaDevices() {
  navigator.mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
    }),
  } as unknown as MediaDevices
}

function mockMediaRecorder(recorder: ReturnType<typeof makeMockRecorder>) {
  window.MediaRecorder = vi
    .fn()
    .mockImplementation(() => recorder) as unknown as typeof MediaRecorder
}

describe('useSpeakingDrill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with default state', () => {
    const drill = useSpeakingDrill()
    expect(drill.isRecording.value).toBe(false)
    expect(drill.transcript.value).toBe('')
    expect(drill.similarity.value).toBeNull()
    expect(drill.error.value).toBeNull()
    expect(drill.isProcessing.value).toBe(false)
  })

  describe('startRecording', () => {
    it('starts recording when mic access granted', async () => {
      const recorder = makeMockRecorder()
      mockMediaDevices()
      mockMediaRecorder(recorder)

      const drill = useSpeakingDrill()
      await drill.startRecording()

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true })
      expect(recorder.start).toHaveBeenCalled()
      expect(drill.isRecording.value).toBe(true)
      expect(drill.error.value).toBeNull()
    })

    it('sets mic error when permission denied', async () => {
      navigator.mediaDevices = {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
      } as unknown as MediaDevices

      const drill = useSpeakingDrill()
      await drill.startRecording()

      expect(drill.error.value).toBe('drills.mic_error')
      expect(drill.isRecording.value).toBe(false)
    })
  })

  describe('stopRecording', () => {
    it('stops recording and submits STT', async () => {
      const recorder = makeMockRecorder()
      mockMediaDevices()
      mockMediaRecorder(recorder)
      vi.mocked(submitSttAudio).mockResolvedValueOnce({
        transcript: 'hello',
        similarity: 0.9,
      })

      const drill = useSpeakingDrill()
      await drill.startRecording()
      drill.stopRecording()

      expect(recorder.stop).toHaveBeenCalled()
      expect(drill.isRecording.value).toBe(false)

      await vi.waitFor(() => {
        expect(submitSttAudio).toHaveBeenCalled()
      })
      expect(drill.transcript.value).toBe('hello')
      expect(drill.similarity.value).toBe(0.9)
      expect(drill.isProcessing.value).toBe(false)
    })

    it('sets error when STT fails after stop', async () => {
      const recorder = makeMockRecorder()
      mockMediaDevices()
      mockMediaRecorder(recorder)
      vi.mocked(submitSttAudio).mockRejectedValueOnce(new Error('Network error'))

      const drill = useSpeakingDrill()
      await drill.startRecording()
      drill.stopRecording()

      await vi.waitFor(() => {
        expect(drill.error.value).toBe('errors.internal_error')
      })
      expect(drill.isProcessing.value).toBe(false)
    })

    it('does nothing if not recording', () => {
      const drill = useSpeakingDrill()
      expect(() => drill.stopRecording()).not.toThrow()
    })
  })

  describe('reset', () => {
    it('clears all state', () => {
      const drill = useSpeakingDrill()
      drill.transcript.value = 'hello'
      drill.similarity.value = 0.9
      drill.error.value = 'some error'
      drill.isProcessing.value = true
      drill.isRecording.value = true
      drill.reset()
      expect(drill.transcript.value).toBe('')
      expect(drill.similarity.value).toBeNull()
      expect(drill.error.value).toBeNull()
      expect(drill.isProcessing.value).toBe(false)
      expect(drill.isRecording.value).toBe(false)
    })
  })
})
