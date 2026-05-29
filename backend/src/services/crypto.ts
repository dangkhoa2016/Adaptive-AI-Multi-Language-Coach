/**
 * Encryption utilities for sensitive environment variables stored in D1.
 * Uses SubtleCrypto AES-GCM for secure encryption and decryption.
 * Optimized for edge runtime (Cloudflare Workers) by replacing heavy PBKDF2 with SHA-256 hashing.
 */

const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12
const TAG_LENGTH = 128

/**
 * Safely converts a Uint8Array buffer to a Base64 string without risking call stack overflow.
 */
function bufferToBase64(buffer: Uint8Array): string {
  return btoa(Array.from(buffer, (byte) => String.fromCharCode(byte)).join(''))
}

/**
 * Converts a Base64 string back into a Uint8Array buffer.
 */
function base64ToBuffer(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

/**
 * Derives a secure CryptoKey from the system's raw key string using SHA-256.
 * Provides a 256-bit key optimized for sub-millisecond execution on the edge.
 */
async function getCryptoKey(keyString: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const rawKey = encoder.encode(keyString)

  // Hash the raw string to get a deterministic 32-byte key for AES-256
  const keyBuffer = await crypto.subtle.digest('SHA-256', rawKey)

  return crypto.subtle.importKey('raw', keyBuffer, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ])
}

/**
 * Encrypts a plaintext string.
 * @returns A single Base64 string containing the concatenated [IV + Ciphertext].
 */
export async function encrypt(plaintext: string, keyString: string): Promise<string> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const cryptoKey = await getCryptoKey(keyString)

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    cryptoKey,
    encoder.encode(plaintext),
  )

  const encryptedBytes = new Uint8Array(encrypted)
  const combined = new Uint8Array(iv.length + encryptedBytes.length)

  // Pack IV and Ciphertext together into a single byte array
  combined.set(iv, 0)
  combined.set(encryptedBytes, iv.length)

  return bufferToBase64(combined)
}

/**
 * Decrypts a Base64-encoded string containing concatenated [IV + Ciphertext].
 * @returns The original plaintext string.
 */
export async function decrypt(cipherText: string, keyString: string): Promise<string> {
  const combined = base64ToBuffer(cipherText)

  // Extract IV and Ciphertext from the unified byte array
  const iv = combined.slice(0, IV_LENGTH)
  const encrypted = combined.slice(IV_LENGTH)

  const cryptoKey = await getCryptoKey(keyString)

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    cryptoKey,
    encrypted,
  )

  return new TextDecoder().decode(decrypted)
}

/**
 * Validates whether a given string matches the expected base64 format and minimum length.
 */
export function isEncrypted(value: string): boolean {
  if (value.length < 32) return false
  return /^[A-Za-z0-9+/=]+$/.test(value)
}
