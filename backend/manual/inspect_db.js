import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')

const SAMPLE_LIMIT = parseInt(process.env.SAMPLE_LIMIT || '20', 10)
const DATABASE_NAME = process.env.DATABASE_NAME || process.argv[2] || 'DB'

function resolveStateDirectory() {
  return path.join(projectRoot, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject')
}

function resolveDatabasePath() {
  const explicitPath = process.env.DATABASE_PATH
  if (explicitPath) {
    return path.isAbsolute(explicitPath)
      ? explicitPath
      : path.resolve(projectRoot, explicitPath)
  }

  const stateDir = resolveStateDirectory()
  if (!fs.existsSync(stateDir)) {
    throw new Error(`D1 state directory not found at:\n  ${stateDir}\n\nRun migrations first:\n  pnpm --filter @vocab/backend db:migrate:local`)
  }

  const sqliteFiles = fs
    .readdirSync(stateDir)
    .filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
    .map((f) => path.join(stateDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)

  if (sqliteFiles.length === 0) {
    throw new Error(`No D1 data files found in ${stateDir}`)
  }

  if (sqliteFiles.length > 1) {
    console.warn(`  [!] ${sqliteFiles.length} SQLite files found; using most recent.`)
  }

  return sqliteFiles[0]
}

function runSqlite(dbPath, sql, options = {}) {
  const { mode = 'table', headers = mode === 'table' } = options
  const args = [dbPath]

  if (headers) args.push('-cmd', '.headers on')
  args.push('-cmd', `.mode ${mode}`)
  if (mode === 'table') args.push('-cmd', '.nullvalue NULL')
  args.push(sql)

  return execFileSync('sqlite3', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 200 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd()
}

function runSqliteList(dbPath, sql) {
  const out = runSqlite(dbPath, sql, { mode: 'list', headers: false })
  if (!out) return []
  return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
}

function printSection(title, sqlResult) {
  console.log(`\n━━━ ${title} ━━━`)
  console.log(sqlResult || '(empty)')
}

function printDivider() {
  console.log('─'.repeat(60))
}

function inspectTable(dbPath, tableName) {
  console.log(`\n┌─ Table: ${tableName}`)
  printDivider()

  // Schema
  const schema = runSqlite(dbPath, `PRAGMA table_info(${tableName});`)
  printSection('Schema', schema)

  // Row count
  const count = runSqlite(dbPath, `SELECT COUNT(*) AS row_count FROM ${tableName};`)
  printSection('Row count', count)

  // Foreign keys
  const fks = runSqlite(dbPath, `PRAGMA foreign_key_list(${tableName});`)
  if (fks) {
    printSection('Foreign keys', fks)

    // Check FK violations
    const fkRows = runSqliteList(dbPath, `PRAGMA foreign_key_list(${tableName});`)
    for (const row of fkRows) {
      const parts = row.split('|')
      if (parts.length >= 4) {
        const col = parts[3]
        const refTable = parts[2]
        const refCol = parts[4]
        if (col && col !== '(null)') {
          const violations = runSqlite(dbPath, `
            SELECT COUNT(*) AS orphans
            FROM ${tableName} t
            WHERE t.${col} IS NOT NULL
              AND t.${col} NOT IN (SELECT ${refCol} FROM ${refTable});
          `)
          const orphanCount = violations.replace(/\D/g, '')
          if (parseInt(orphanCount, 10) > 0) {
            console.log(`  ⚠  ${orphanCount} orphaned row(s) in ${tableName}.${col} (missing in ${refTable}.${refCol})`)
          }
        }
      }
    }
  }

  // Indexes on this table
  const tableIndexes = runSqlite(dbPath, `
    SELECT name FROM sqlite_master
    WHERE type = 'index' AND tbl_name = '${tableName}' AND name IS NOT NULL
    ORDER BY name;
  `)
  if (tableIndexes && !tableIndexes.includes('(empty)')) {
    printSection('Indexes', tableIndexes)
  }

  // Check for potential issues
  const nullChecks = runSqliteList(dbPath, `PRAGMA table_info(${tableName});`)
  for (const colInfo of nullChecks) {
    const parts = colInfo.split('|')
    const colName = parts[1]
    const isPK = parts[5] === '1'
    const notNull = parts[3] === '1'

    if (notNull && !isPK) {
      const nullCount = runSqlite(dbPath, `SELECT COUNT(*) AS null_count FROM ${tableName} WHERE ${colName} IS NULL;`)
      const n = nullCount.replace(/\D/g, '')
      if (parseInt(n, 10) > 0) {
        console.log(`  ⚠  ${n} NULL(s) in NOT NULL column ${tableName}.${colName}`)
      }
    }
  }

  // Sample data
  printSection(`Sample data (first ${SAMPLE_LIMIT} rows)`, runSqlite(dbPath, `SELECT * FROM ${tableName} LIMIT ${SAMPLE_LIMIT};`))

  console.log('└' + '─'.repeat(58))
}

function inspectDatabase(dbPath) {
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║            Database Inspection Report                      ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`  Database      : ${DATABASE_NAME}`)
  console.log(`  File          : ${dbPath}`)
  console.log(`  Size          : ${(fs.statSync(dbPath).size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Sample limit  : ${SAMPLE_LIMIT} rows per table`)

  // SQLite metadata
  const versionRaw = runSqliteList(dbPath, 'SELECT sqlite_version();')
  if (versionRaw.length > 0) {
    console.log(`  SQLite version: ${versionRaw[0]}`)
  }

  // All tables
  const tables = runSqliteList(dbPath, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
  console.log(`  Tables        : ${tables.length}`)
  console.log('')

  if (tables.length === 0) {
    console.log('No tables found in database.')
    return
  }

  // Inspect each table
  for (const tableName of tables) {
    inspectTable(dbPath, tableName)
  }

  // Summary
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║                    Table Summary                           ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  const summaryRows = tables.map((t) => {
    const count = runSqlite(dbPath, `SELECT COUNT(*) FROM ${t};`, { mode: 'list', headers: false })
    return { name: t, count: parseInt(count, 10) || 0 }
  })
  summaryRows.sort((a, b) => b.count - a.count)

  console.log('  Table                              Rows')
  console.log('  ───────────────────────────────────────')
  for (const { name, count } of summaryRows) {
    console.log(`  ${name.padEnd(36)} ${String(count).padStart(6)}`)
  }

  // All indexes
  console.log('\n')
  const allIndexes = runSqlite(dbPath, "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name IS NOT NULL ORDER BY tbl_name, name;")
  if (allIndexes) {
    printSection('All indexes', allIndexes)
  }
}

try {
  const dbPath = resolveDatabasePath()
  inspectDatabase(dbPath)
} catch (error) {
  console.error('Failed to inspect database.')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
