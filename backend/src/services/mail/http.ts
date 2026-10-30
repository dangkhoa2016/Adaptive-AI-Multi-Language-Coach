const ATTEMPT_TIMEOUT_MS = 5000

/** Mail delivery is ambiguous after timeout: callers must not retry another provider. */
export async function fetchMail(
  endpoint: string,
  init: RequestInit,
  remainingMs = ATTEMPT_TIMEOUT_MS,
): Promise<boolean> {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0)
    throw new Error('Mail delivery unavailable')
  const attemptMs = Math.min(ATTEMPT_TIMEOUT_MS, remainingMs)
  const expiresAt = Date.now() + attemptMs
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => {
          controller.abort()
          reject(new Error('Mail delivery unavailable'))
        },
        Math.min(ATTEMPT_TIMEOUT_MS, remainingMs),
      )
    })
    const delivery = (async () => {
      const response = await fetch(endpoint, {
        ...init,
        signal: controller.signal,
        redirect: 'manual',
      })
      // Neither provider needs the response payload; discard it without an unbounded read.
      void response.body?.cancel().catch(() => {})
      if (controller.signal.aborted || Date.now() >= expiresAt)
        throw new Error('Mail delivery unavailable')
      if (response.redirected) throw new Error('Mail delivery unavailable')
      if (response.ok) return true
      if ([401, 403, 429].includes(response.status)) return false
      throw new Error('Mail delivery unavailable')
    })()
    return await Promise.race([delivery, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    controller.abort()
  }
}
