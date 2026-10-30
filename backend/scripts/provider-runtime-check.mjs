// Native workerd compatibility regression. All outbound traffic uses a synthetic local service.
import { strict as assert } from 'node:assert'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { Miniflare } from 'miniflare'

const backend = dirname(dirname(fileURLToPath(import.meta.url)))
const scratch = await mkdtemp(join(tmpdir(), 'adaptive-provider-check-'))
const destinations = []
let worker
try {
  const entry = join(scratch, 'entry.ts')
  await writeFile(
    entry,
    `
import { fetchProviderJson } from ${JSON.stringify(join(backend, 'src/services/providerSafety.ts'))}
export default { async fetch(request) {
  try {
    const data = await fetchProviderJson('https://synthetic-provider.example.invalid' + new URL(request.url).pathname, { method: 'POST' }, 1000)
    return Response.json(data)
  } catch { return Response.json({ error: 'unavailable' }, { status: 503 }) }
} }
`,
  )
  const bundle = join(scratch, 'worker.mjs')
  await build({
    entryPoints: [entry],
    outfile: bundle,
    bundle: true,
    format: 'esm',
    platform: 'browser',
  })
  worker = new Miniflare({
    rootPath: scratch,
    modulesRoot: scratch,
    modules: true,
    scriptPath: bundle,
    compatibilityDate: '2026-05-20',
    outboundService: (request) => {
      const url = new URL(request.url)
      destinations.push(url.origin)
      assert.equal(url.origin, 'https://synthetic-provider.example.invalid')
      if (url.pathname === '/redirect')
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://forbidden.example.invalid' },
        })
      return Response.json({ synthetic: true })
    },
  })
  const success = await worker.dispatchFetch('http://localhost/success')
  assert.equal(success.status, 200)
  assert.deepEqual(await success.json(), { synthetic: true })
  const redirect = await worker.dispatchFetch('http://localhost/redirect')
  assert.equal(redirect.status, 503)
  assert.deepEqual(await redirect.json(), { error: 'unavailable' })
  assert.equal(destinations.length, 2)
  console.log(
    'PASS: native workerd provider fetch succeeds; redirects rejected; no external egress',
  )
} finally {
  await worker?.dispose()
  await rm(scratch, { recursive: true, force: true })
}
