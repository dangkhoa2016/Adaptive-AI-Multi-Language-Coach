import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
const modules = [
  'wire/strict-json.mjs',
  'wire/framing.mjs',
  'policy/deny.mjs',
  'money/micro-usd.mjs',
  'state/model.mjs',
]
const expected = [
  'README.md',
  ...modules,
  'fixtures/design-pins.reference.json',
  'fixtures/wire-cases.synthetic.json',
  'fixtures/accounting-cases.synthetic.json',
  'test/wire.test.mjs',
  'test/policy.test.mjs',
  'test/money.test.mjs',
  'test/state.test.mjs',
  'test/cache.test.mjs',
  'test/boundary.test.mjs',
].sort()
const base = new URL('../', import.meta.url)

test('BOUNDARY-01 exactly fifteen files and no links in B0 subtree', () => {
  const walk = (url, prefix = '') =>
    readdirSync(url, { withFileTypes: true }).flatMap((entry) => {
      assert.equal(entry.isSymbolicLink(), false)
      return entry.isDirectory()
        ? walk(new URL(entry.name + '/', url), prefix + entry.name + '/')
        : [prefix + entry.name]
    })
  assert.deepEqual(walk(base).sort(), expected)
})
test('BOUNDARY-02 production modules have only local or buffer imports and no ambient capability calls', () => {
  for (const path of modules) {
    const source = readFileSync(new URL(path, base), 'utf8')
    const imports = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
    for (const spec of imports)
      assert.ok(
        spec === 'node:buffer' || spec === './strict-json.mjs' || spec === '../money/micro-usd.mjs',
        path + ': ' + spec,
      )
    for (const pattern of [
      /\bimport\s*\(/,
      /\brequire\s*\(/,
      /\bfetch\s*\(/,
      /\b(?:eval|Function|WebSocket|XMLHttpRequest)\s*\(/,
      /\bprocess\s*[.[]/,
      /\b(?:Date|performance|crypto|globalThis|D1|KV|ASSETS)\s*[.[]/,
      /\b(?:setTimeout|setInterval)\s*\(/,
      /\b(?:http|https|net|tls|child_process|worker_threads|fs):/,
    ])
      assert.doesNotMatch(source, pattern, path)
  }
})
test('BOUNDARY-03 fixtures contain no key/signature material or operative authority', () => {
  const pins = JSON.parse(readFileSync(new URL('fixtures/design-pins.reference.json', base)))
  assert.equal(pins.authority, 'MASTER_HANDOFF_COPY_NOT_A_GRANT')
  assert.equal(pins.valid_execution_grants, 0)
  assert.equal(pins.live_attempts, 0)
  for (const file of ['wire-cases.synthetic.json', 'accounting-cases.synthetic.json']) {
    const text = readFileSync(new URL('fixtures/' + file, base), 'utf8')
    assert.match(JSON.parse(text).kind, /^TEST_ONLY_/)
    assert.doesNotMatch(text, /-----BEGIN|sk-[A-Za-z0-9]{12,}|https?:\/\//)
  }
})
