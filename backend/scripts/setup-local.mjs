import { copyFileSync, existsSync, writeFileSync, constants } from 'node:fs'
import { fileURLToPath } from 'node:url'

const backend = fileURLToPath(new URL('../', import.meta.url))
const configPath = `${backend}wrangler.toml`

// Local-only configuration: no remote AI binding or account identifiers.
if (!existsSync(configPath)) {
  writeFileSync(
    configPath,
    `name = "ai-vocab-app-local"
main = "src/index.ts"
compatibility_date = "2026-05-20"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "../assets"
binding = "ASSETS"

[[kv_namespaces]]
binding = "CACHE"
id = "00000000000000000000000000000000"

[[d1_databases]]
binding = "DB"
database_name = "ai_vocab_db"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "migrations"

[[ratelimits]]
name = "RATE_LIMITER_API"
namespace_id = "1001"
simple = { limit = 10, period = 60 }

[[ratelimits]]
name = "RATE_LIMITER_AUTH"
namespace_id = "1002"
simple = { limit = 3, period = 60 }
`,
    { flag: 'wx' },
  )
  console.log('Created backend/wrangler.toml for local use only; never deploy this file.')
}

if (!existsSync(`${backend}.dev.vars`)) {
  copyFileSync(`${backend}.dev.vars.example`, `${backend}.dev.vars`, constants.COPYFILE_EXCL)
  console.log('Created local synthetic development secrets. Never use these in production.')
}
console.log(
  'Existing config and secrets are preserved. Build frontend assets before starting Wrangler.',
)
