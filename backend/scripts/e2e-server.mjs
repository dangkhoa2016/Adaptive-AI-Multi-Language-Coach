// Test driver only: real Worker routes + disposable D1/KV + native rate limits.
// External mail is captured in memory; every other outbound request is blocked.
import { build } from 'esbuild'
import { Miniflare } from 'miniflare'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'

const backend = dirname(dirname(fileURLToPath(import.meta.url)))
const scratch = await mkdtemp(join(tmpdir(), 'adaptive-e2e-'))
const events = { capturedMail: 0, blockedEgress: 0 }
let worker
let monitor
let pendingMagicLink

async function stop() {
  pendingMagicLink = undefined
  monitor?.close()
  await worker?.dispose()
  await rm(scratch, { recursive: true, force: true })
}
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => void stop().then(() => process.exit(0)))
}

try {
  const bundle = join(scratch, 'worker.mjs')
  await build({
    entryPoints: [join(backend, 'src/index.ts')],
    outfile: bundle,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
  })
  worker = new Miniflare({
    rootPath: scratch,
    modulesRoot: scratch,
    modules: true,
    scriptPath: bundle,
    host: '127.0.0.1',
    port: 8787,
    compatibilityDate: '2026-05-20',
    compatibilityFlags: ['nodejs_compat'],
    bindings: {
      PUBLIC_APP_ORIGIN: 'http://localhost:5173',
      ENVIRONMENT: 'local',
      JWT_SECRET: 'synthetic-e2e-jwt-never-deploy',
      ENCRYPTION_KEY: 'synthetic-e2e-encryption-never-deploy',
    },
    kvNamespaces: ['CACHE'],
    d1Databases: ['DB'],
    kvPersist: false,
    d1Persist: false,
    ratelimits: {
      RATE_LIMITER_API: { simple: { limit: 10, period: 60 } },
      RATE_LIMITER_AUTH: { simple: { limit: 3, period: 60 } },
    },
    outboundService: async (request) => {
      const url = new URL(request.url)
      if (url.origin === 'https://api.resend.com' && url.pathname === '/emails') {
        const message = await request.json()
        // Credential capture is one-use, memory-only, and served only by this private test driver.
        if (request.method === 'POST' && message.to?.[0] === 'synthetic@example.invalid') {
          const candidate = message.html?.match(/href="([^"]+)"/)?.[1]
          const link = candidate ? new URL(candidate) : null
          if (
            !link ||
            link.origin !== 'http://localhost:5173' ||
            link.pathname !== '/auth/verify' ||
            !link.searchParams.has('token')
          ) {
            return new Response('Invalid synthetic mail', { status: 502 })
          }
          pendingMagicLink = { url: link.href, expiresAt: Date.now() + 60_000 }
          events.capturedMail++
          return Response.json({ id: 'synthetic-capture' })
        }
      }
      events.blockedEgress++
      return new Response('External request blocked by local E2E driver', { status: 502 })
    },
  })
  const db = await worker.getD1Database('DB')
  async function apply(sql) {
    for (const statement of sql.split(';')) {
      if (statement.replace(/--.*$/gm, '').trim()) await db.prepare(statement).run()
    }
  }
  for (const file of (await readdir(join(backend, 'migrations')))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await apply(await readFile(join(backend, 'migrations', file), 'utf8'))
  }
  await apply(await readFile(join(backend, 'seed/0001_topics_and_fallback.sql'), 'utf8'))
  await db
    .prepare(
      'INSERT INTO email_providers_config (provider_id, provider_name, config_json) VALUES (?, ?, ?)',
    )
    .bind('resend', 'Synthetic local capture', JSON.stringify({ apiKey: 'synthetic-e2e-mail' }))
    .run()
  monitor = createServer((request, response) => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    // No CORS headers: browser pages cannot read this endpoint cross-origin.
    if (request.url === '/magic-link') {
      if (request.method !== 'POST' || request.headers.origin) {
        response.writeHead(403, headers)
        response.end(JSON.stringify({ error: 'forbidden' }))
        return
      }
      const captured = pendingMagicLink
      pendingMagicLink = undefined
      if (!captured || captured.expiresAt <= Date.now()) {
        response.writeHead(404, headers)
        response.end(JSON.stringify({ error: 'capture_empty' }))
        return
      }
      response.writeHead(200, headers)
      response.end(JSON.stringify({ url: captured.url }))
      return
    }
    response.writeHead(200, headers)
    response.end(JSON.stringify(events))
  })
  await new Promise((resolve, reject) => {
    monitor.once('error', reject)
    monitor.listen(8788, '127.0.0.1', resolve)
  })
  await worker.ready
  console.log(
    'E2E driver ready: local Worker/D1/KV, native quotas 10/3 per 60s, captured mail, no live AI',
  )
} catch (error) {
  await stop()
  throw error
}
