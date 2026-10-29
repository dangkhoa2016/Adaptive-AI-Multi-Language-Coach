import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface SqlFile {
  name: string
  sql: string
}

function readSqlFiles(dir: string): SqlFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      name: f,
      sql: readFileSync(join(dir, f), 'utf-8'),
    }))
}

/**
 * Parse a .dev.vars file into a record of key-value pairs.
 */
function parseDevVars(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, 'utf-8')
  const vars: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    vars[key] = value
  }

  return vars
}

const migrations = readSqlFiles(join(__dirname, 'migrations'))
const seeds = readSqlFiles(join(__dirname, 'seed'))

// Parse .dev.vars.test and inject all values as miniflare bindings.
// These override any values from .dev.vars (which wrangler always loads).
const testVars = parseDevVars(join(__dirname, '.dev.vars.test'))

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.test.toml' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
          TEST_SEEDS: seeds,
          ...testVars,
        },
      },
    }),
  ],
  test: {
    setupFiles: ['./test/setup.ts'],
    coverage: {
      enabled: true,
      provider: 'istanbul',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      include: ['src/**'],
    },
  },
})
