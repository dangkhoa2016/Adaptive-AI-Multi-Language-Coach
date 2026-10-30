const encoder = new TextEncoder()

function base64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function hex(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface JwtPayload {
  sub: string
  iat: number
  exp: number
}

export async function createJwt(userId: string, secret: string): Promise<string> {
  if (!secret?.trim() || !userId.trim()) throw new Error('Invalid session configuration')
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64url(
    encoder.encode(
      JSON.stringify({ sub: userId, iat: now, exp: now + 7 * 86400, jti: crypto.randomUUID() }),
    ),
  )
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${payload}`))
  return `${header}.${payload}.${base64url(sig)}`
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  if (!secret?.trim()) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts
  try {
    const parsedHeader = JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/')))
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') return null
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const sigBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
      c.charCodeAt(0),
    )
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(`${header}.${payload}`),
    )
    if (!valid) return null
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload
    const now = Math.floor(Date.now() / 1000)
    if (
      typeof data.sub !== 'string' ||
      !data.sub.trim() ||
      !Number.isSafeInteger(data.iat) ||
      !Number.isSafeInteger(data.exp) ||
      data.iat > now ||
      data.exp <= now ||
      data.exp <= data.iat ||
      data.exp - data.iat > 7 * 86400
    )
      return null
    return data
  } catch {
    return null
  }
}

export async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(raw))
  return hex(digest)
}

export function generateMagicToken(): string {
  return crypto.randomUUID()
}
