import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseStrictJson, parseNonGrantEnvelope } from '../wire/strict-json.mjs'
import { frameNonGrant } from '../wire/framing.mjs'
const raw = (s) => Buffer.from(s, 'utf8')

test('WIRE-01 positive closed non-grant paper objects parse without authority', () => {
  assert.deepEqual({ ...parseNonGrantEnvelope(raw('{}')) }, {})
  assert.deepEqual({ ...parseNonGrantEnvelope(raw('{"a":1,"b":2}')) }, { a: 1, b: 2 })
})

test('WIRE-02 paper framing has exact domain, NUL, U64BE byte count and payload', () => {
  const prefix = Buffer.from('ADAPTIVE_COACH_PHASE_C_S0_EXECUTION_V1\0', 'ascii')
  for (const [text, lengthHex] of [
    ['{}', '0000000000000002'],
    ['{"a":1,"b":2}', '000000000000000d'],
  ]) {
    const expected = Buffer.concat([prefix, Buffer.from(lengthHex, 'hex'), raw(text)])
    assert.deepEqual(frameNonGrant(raw(text)), expected)
  }
  assert.notDeepEqual(frameNonGrant(raw('{"a":1,"b":2}')), frameNonGrant(raw('{"a":1,"b":3}')))
})

test('WIRE-03 duplicate decoded keys rejected before canonicalization', () => {
  for (const text of [
    '{"a":1,"a":2}',
    '{"a":1,"\\u0061":2}',
    '{"x":{"a":0,"\\u0061":0}}',
    '{"__proto__":{},"__proto__":{}}',
  ]) {
    assert.throws(() => parseStrictJson(raw(text)), /DUPLICATE_KEY/)
  }
})

test('WIRE-04 canonical spelling, lexical strictness, unsafe integers and null fail closed', () => {
  const cases = JSON.parse(
    readFileSync(new URL('../fixtures/wire-cases.synthetic.json', import.meta.url)),
  )
  assert.equal(cases.kind, 'TEST_ONLY_NON_GRANT')
  for (const text of cases.rejectedSyntax)
    assert.throws(() => parseStrictJson(raw(text)), undefined, text)
})

test('WIRE-05 UTF8 is fatal; BOM and lone surrogates are rejected', () => {
  for (const b of [
    Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]),
    Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xc0, 0xaf, 0x22, 0x7d]),
    Buffer.from([0xff]),
    raw('{"a":"\\ud800"}'),
    raw('{"a":"\\udc00"}'),
  ]) {
    assert.throws(() => parseStrictJson(b))
  }
  assert.equal(parseStrictJson(raw('{"a":"😀"}')).a, '😀')
})

test('WIRE-06 string budget counts UTF8 bytes, including keys', () => {
  assert.equal(parseStrictJson(raw(JSON.stringify({ a: 'a'.repeat(4096) }))).a.length, 4096)
  assert.equal(parseStrictJson(raw(JSON.stringify({ a: '😀'.repeat(1024) }))).a.length, 2048)
  for (const s of ['a'.repeat(4097), '😀'.repeat(1025)])
    assert.throws(() => parseStrictJson(raw(JSON.stringify({ a: s }))), /STRING_LIMIT/)
  assert.throws(
    () => parseStrictJson(raw(JSON.stringify({ ['a'.repeat(4097)]: 0 }))),
    /STRING_LIMIT/,
  )
})

test('WIRE-07 maximum container depth is exactly sixteen', () => {
  const nested = (n) => raw('{"a":' + '['.repeat(n) + '0' + ']'.repeat(n) + '}')
  assert.ok(parseStrictJson(nested(15)))
  assert.throws(() => parseStrictJson(nested(16)), /DEPTH_LIMIT/)
})

test('WIRE-08 raw byte boundary is 65536 and input must be bytes', () => {
  const text = '{"a":[10,' + Array(32763).fill('0').join(',') + ']}'
  assert.equal(Buffer.byteLength(text), 65536)
  assert.equal(parseStrictJson(raw(text)).a.length, 32764)
  assert.throws(() => parseStrictJson(raw(text + ' ')), /BODY_LIMIT/)
  assert.throws(() => parseStrictJson('{}'), /BYTE_INPUT/)
})

test('WIRE-09 closed projection rejects unknown, missing, string and grant fields', () => {
  for (const text of [
    '{"a":1}',
    '{"a":1,"b":2,"c":3}',
    '{"a":"TEST_ONLY","b":2}',
    '{"payload":{},"signature_b64u":"TEST_ONLY_NOT_A_SIGNATURE"}',
    '{"__proto__":{}}',
    '{"constructor":{}}',
  ]) {
    assert.throws(() => parseNonGrantEnvelope(raw(text)), /NON_GRANT_SHAPE/)
    assert.throws(() => frameNonGrant(raw(text)))
  }
  const object = parseStrictJson(raw('{"__proto__":{"polluted":true}}'))
  assert.equal(Object.getPrototypeOf(object), null)
  assert.equal({}.polluted, undefined)
})

test('WIRE-10 numeric-key ordering uses JCS lexicographic UTF16 order', () => {
  const value = parseStrictJson(raw('{"10":0,"2":1}'))
  assert.equal(value['10'], 0)
  assert.throws(() => parseStrictJson(raw('{"2":1,"10":0}')), /NON_CANONICAL/)
  assert.equal(parseStrictJson(raw('{"a":2147483647}')).a, 2147483647)
})
