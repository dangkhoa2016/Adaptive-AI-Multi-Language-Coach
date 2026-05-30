import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'

const DEFAULT_SETTINGS = [
  {
    key: 'env.AI_ENDPOINT_URL',
    value: 'https://api.openai.com/v1/responses',
    description: 'AI API endpoint URL for generating vocabulary',
  },
  {
    key: 'env.AI_MODEL_NAME',
    value: 'gpt-5.4-mini',
    description: 'AI model identifier',
  },
  {
    key: 'env.AI_MODEL_OPTIONS',
    value: '{"max_output_tokens":4096,"temperature":0.7}',
    description: 'AI model options as JSON (varies by provider/model)',
  },
]

const args = process.argv.slice(2)
const isRemote = args.includes('--remote') || args.includes('remote')
const fileFlag = args.indexOf('--file')
const customFile = fileFlag !== -1 ? args[fileFlag + 1] : null

let overrides = {}
if (customFile) {
  const filePath = resolve(customFile)
  console.log(`Loading custom settings from: ${filePath}`)
  overrides = JSON.parse(readFileSync(filePath, 'utf-8'))

  if (overrides.aiEndpointUrl) overrides['env.AI_ENDPOINT_URL'] = overrides.aiEndpointUrl
  if (overrides.aiModelName) overrides['env.AI_MODEL_NAME'] = overrides.aiModelName
  if (overrides.aiModelOptions)
    overrides['env.AI_MODEL_OPTIONS'] = JSON.stringify(overrides.aiModelOptions)
}

const settings = DEFAULT_SETTINGS.map((s) => ({
  ...s,
  value: overrides[s.key] ?? s.value,
}))

function buildSql(settings) {
  const values = settings
    .map(
      (s) =>
        `('${s.key.replace(/'/g, "''")}', '${s.value.replace(/'/g, "''")}', '${(s.description || '').replace(/'/g, "''")}')`,
    )
    .join(',\n')
  return `INSERT OR REPLACE INTO system_settings (key, value, description) VALUES\n${values};`
}

function runD1(sql, local) {
  const flag = local ? '--local' : '--remote'
  const cmd = `npx wrangler d1 execute ai_vocab_db ${flag} --command "${sql.replace(/"/g, '\\"')}"`
  console.log(`Running: ${cmd.substring(0, 200)}...`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: resolve(import.meta.dirname, '..') })
  } catch {
    console.error('Failed to execute SQL.')
    process.exit(1)
  }
}

const sql = buildSql(settings)

if (isRemote) {
  console.log('\n\u{1f4e4} Writing app settings to REMOTE D1...\n')
  console.log(sql)
  console.log('')

  const skipConfirm = process.env.SKIP_CONFIRM === 'true'
  if (!skipConfirm) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const reply = await new Promise((resolve) => {
      rl.question(
        '\u26a0\ufe0f  This will overwrite production settings. Continue? (yes/no): ',
        resolve,
      )
    })
    rl.close()
    if (reply.trim().toLowerCase() !== 'yes') {
      console.log('Aborted.')
      process.exit(0)
    }
  }

  runD1(sql, false)
  console.log('\n\u2705 Done.')
} else {
  console.log('\n\u{1f4dd} Writing app settings to LOCAL D1...\n')
  console.log(sql)
  console.log('')

  runD1(sql, true)
  console.log('\n\u2705 Done.')
}
