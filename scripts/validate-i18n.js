const fs = require('fs')
const path = require('path')

const messagesDir = path.join(__dirname, '../frontend/src/i18n/messages')
const refFile = path.join(messagesDir, 'en.json')

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

const ref = flatten(JSON.parse(fs.readFileSync(refFile, 'utf-8')))
let exitCode = 0
for (const file of fs.readdirSync(messagesDir)) {
  if (file === 'en.json') continue
  const keys = flatten(JSON.parse(fs.readFileSync(path.join(messagesDir, file), 'utf-8')))
  const missing = ref.filter((k) => !keys.includes(k))
  if (missing.length) {
    console.log(`✗ ${file}: missing ${missing.length} keys — ${missing.join(', ')}`)
    exitCode = 1
  } else {
    console.log(`✓ ${file}: ${keys.length} keys (all present)`)
  }
}
process.exit(exitCode)
