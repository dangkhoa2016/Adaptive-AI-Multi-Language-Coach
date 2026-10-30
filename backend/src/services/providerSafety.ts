const DEFAULT_AI_ORIGIN = 'https://api.openai.com'
export const PROVIDER_RESPONSE_MAX_BYTES = 262144
export const PROVIDER_ATTEMPT_TIMEOUT_MS = 5000
export const PROVIDER_TOTAL_TIMEOUT_MS = 15000
export const PROVIDER_MAX_ATTEMPTS = 3

/** Only explicit credential/quota rejections establish that inference was not accepted. */
export class ProviderRejectionError extends Error {
  constructor(readonly status: number) {
    super('Provider rejected request')
  }
}

/** Trust comes from deployment configuration, never from editable D1 settings. */
export function requireTrustedAiEndpoint(endpoint: string, configuredOrigins?: string): void {
  const origins = (configuredOrigins ?? DEFAULT_AI_ORIGIN).split(',').map((value) => value.trim())
  if (!origins.length || origins.length > 10) throw new Error('Invalid provider configuration')
  for (const origin of origins) {
    const parsed = new URL(origin)
    if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
      throw new Error('Invalid provider configuration')
    }
  }
  const url = new URL(endpoint)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !origins.includes(url.origin)
  ) {
    throw new Error('Untrusted provider endpoint')
  }
}

/** One deadline covers connection, headers and the entire bounded response stream. */
export async function fetchProviderJson(
  endpoint: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController()
  const expiresAt = Date.now() + timeoutMs
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Provider deadline exceeded'))
        controller.abort()
        void reader?.cancel().catch(() => {})
      }, timeoutMs)
    })
    const response = (async () => {
      const res = await fetch(endpoint, { ...init, signal: controller.signal, redirect: 'manual' })
      if (controller.signal.aborted) {
        void res.body?.cancel().catch(() => {})
        throw new Error('Provider deadline exceeded')
      }
      if (!res.ok || res.redirected) {
        void res.body?.cancel().catch(() => {})
        if (!res.redirected && [401, 403, 429].includes(res.status))
          throw new ProviderRejectionError(res.status)
        throw new Error('Provider unavailable')
      }
      const declaredSize = res.headers.get('content-length')
      if (
        declaredSize !== null &&
        (!/^\d+$/.test(declaredSize) || Number(declaredSize) > PROVIDER_RESPONSE_MAX_BYTES)
      ) {
        void res.body?.cancel().catch(() => {})
        throw new Error('Provider response too large')
      }
      if (!res.body) throw new Error('Provider response unavailable')
      reader = res.body.getReader()
      const bytes = new Uint8Array(PROVIDER_RESPONSE_MAX_BYTES)
      let totalBytes = 0
      while (true) {
        const chunk = await reader.read()
        if (controller.signal.aborted || Date.now() >= expiresAt)
          throw new Error('Provider deadline exceeded')
        if (chunk.done) break
        totalBytes += chunk.value.byteLength
        if (totalBytes > PROVIDER_RESPONSE_MAX_BYTES) {
          void reader.cancel().catch(() => {})
          throw new Error('Provider response too large')
        }
        bytes.set(chunk.value, totalBytes - chunk.value.byteLength)
      }
      return JSON.parse(new TextDecoder().decode(bytes.subarray(0, totalBytes))) as unknown
    })()
    return await Promise.race([response, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    controller.abort()
  }
}
