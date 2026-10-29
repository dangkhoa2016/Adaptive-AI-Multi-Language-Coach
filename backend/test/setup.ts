/// <reference types="@cloudflare/vitest-plugin/types" />
import { beforeAll } from 'vitest'
import { env } from 'cloudflare:test'

interface SqlFile {
  name: string
  sql: string
}

interface TestEnv extends Record<string, unknown> {
  DB: D1Database
}

async function executeSqlFiles(sqlFiles: SqlFile[]) {
  for (const file of sqlFiles) {
    const statements = file.sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => {
        if (s.length === 0) return false
        const withoutComments = s.replace(/--.*$/gm, '').trim()
        return withoutComments.length > 0
      })

    for (const stmt of statements) {
      await (env as TestEnv).DB.prepare(stmt).run()
    }
  }
}

beforeAll(async () => {
  const bindings = env as Record<string, unknown>

  const migrations = bindings.TEST_MIGRATIONS as SqlFile[] | undefined
  if (!migrations) {
    throw new Error('TEST_MIGRATIONS binding not found. Check vitest.config.ts')
  }
  await executeSqlFiles(migrations)

  const seeds = bindings.TEST_SEEDS as SqlFile[] | undefined
  if (seeds) {
    await executeSqlFiles(seeds)
  }
})
