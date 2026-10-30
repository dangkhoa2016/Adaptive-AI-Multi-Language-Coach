import { Buffer } from 'node:buffer'

// Bounded syntax only. The separate paper projection below is closed and non-operative.
export function parseStrictJson(raw) {
  if (!(raw instanceof Uint8Array)) throw new TypeError('BYTE_INPUT')
  if (raw.byteLength > 65536) throw new RangeError('BODY_LIMIT')
  const bytes = Buffer.from(raw)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new SyntaxError('BOM')
  }
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  let index = 0
  const fail = (reason) => {
    throw new SyntaxError(reason)
  }
  const whitespace = () => {
    while (index < text.length && /[ \t\n\r]/.test(text[index])) index++
  }
  function string() {
    if (text[index] !== '"') fail('STRING_EXPECTED')
    const start = index++
    let closed = false
    while (index < text.length) {
      const char = text[index++]
      if (char === '"') {
        closed = true
        break
      }
      if (char.charCodeAt(0) < 32) fail('CONTROL_CHARACTER')
      if (char === '\\') {
        if (index >= text.length) fail('STRING_ESCAPE')
        index++
      }
    }
    if (!closed) fail('UNTERMINATED_STRING')
    // JSON.parse is used for ONE string token, never an object with duplicate keys.
    const value = JSON.parse(text.slice(start, index))
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i)
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(++i)
        if (!(next >= 0xdc00 && next <= 0xdfff)) fail('LONE_SURROGATE')
      } else if (code >= 0xdc00 && code <= 0xdfff) fail('LONE_SURROGATE')
    }
    if (Buffer.byteLength(value, 'utf8') > 4096) throw new RangeError('STRING_LIMIT')
    return value
  }
  function value(depth) {
    whitespace()
    const char = text[index]
    if (char === '{' || char === '[') {
      if (depth >= 16) throw new RangeError('DEPTH_LIMIT')
      index++
      const object = char === '{'
      const result = object ? Object.create(null) : []
      const end = object ? '}' : ']'
      whitespace()
      if (text[index] === end) {
        index++
        return result
      }
      for (;;) {
        whitespace()
        if (object) {
          const key = string()
          if (Object.hasOwn(result, key)) fail('DUPLICATE_KEY')
          whitespace()
          if (text[index++] !== ':') fail('COLON_EXPECTED')
          result[key] = value(depth + 1)
        } else result.push(value(depth + 1))
        whitespace()
        if (text[index] === end) {
          index++
          return result
        }
        if (text[index++] !== ',') fail('COMMA_EXPECTED')
      }
    }
    if (char === '"') return string()
    if (text.startsWith('true', index)) {
      index += 4
      return true
    }
    if (text.startsWith('false', index)) {
      index += 5
      return false
    }
    const match = /^(?:0|[1-9][0-9]*)/.exec(text.slice(index))
    if (!match) fail('INVALID_TOKEN')
    if (match[0].length > 10) fail('INTEGER_RANGE')
    const number = Number(match[0])
    if (number > 2147483647) fail('INTEGER_RANGE')
    index += match[0].length
    return number
  }
  const parsed = value(0)
  if (index !== text.length) fail('TRAILING_DATA')
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') fail('ROOT_OBJECT')
  function canonical(item) {
    if (Array.isArray(item)) return '[' + item.map(canonical).join(',') + ']'
    if (typeof item === 'object') {
      return (
        '{' +
        Object.keys(item)
          .sort()
          .map((key) => JSON.stringify(key) + ':' + canonical(item[key]))
          .join(',') +
        '}'
      )
    }
    return JSON.stringify(item)
  }
  if (!Buffer.from(canonical(parsed), 'utf8').equals(bytes)) fail('NON_CANONICAL')
  return parsed
}

// These two paper-vector shapes have no execution-envelope or signature fields.
export function parseNonGrantEnvelope(raw) {
  const parsed = parseStrictJson(raw)
  const keys = Object.keys(parsed)
  if (keys.length === 0) return parsed
  if (
    keys.length !== 2 ||
    !Object.hasOwn(parsed, 'a') ||
    !Object.hasOwn(parsed, 'b') ||
    !Number.isInteger(parsed.a) ||
    !Number.isInteger(parsed.b)
  ) {
    throw new SyntaxError('NON_GRANT_SHAPE')
  }
  return parsed
}
