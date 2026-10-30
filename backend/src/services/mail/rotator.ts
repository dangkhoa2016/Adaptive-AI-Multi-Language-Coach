import type { EmailProvider, ProviderRecord } from './types'
import { resendProvider } from './resend'
import { postmarkProvider } from './postmark'

const providerMap: Record<string, EmailProvider> = {
  resend: resendProvider,
  postmark: postmarkProvider,
}

function selectProvider(providers: ProviderRecord[]): ProviderRecord | null {
  if (providers.length === 0) return null
  if (providers.length === 1) return providers[0]

  const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0)
  if (totalWeight <= 0) return providers[0]

  let rand = Math.random() * totalWeight
  for (const p of providers) {
    rand -= p.weight
    if (rand <= 0) return p
  }
  return providers[providers.length - 1]
}

export async function getActiveProviders(db: D1Database): Promise<ProviderRecord[]> {
  const result = await db
    .prepare(
      `SELECT provider_id, provider_name, is_active, weight, config_json FROM email_providers_config WHERE is_active = 1 AND provider_id IN ('resend', 'postmark')`,
    )
    .all<ProviderRecord>()
  return result.results ?? []
}

export async function getForceProviderWhitelist(db: D1Database): Promise<string[]> {
  const row = await db
    .prepare("SELECT value FROM system_settings WHERE key = 'force_email_provider'")
    .first<{ value: string }>()
  if (!row || !row.value) return []
  return row.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function deliverEmail(
  db: D1Database,
  params: { to: string; subject: string; html: string; from?: string },
  deadline: number,
): Promise<boolean> {
  const whitelist = await getForceProviderWhitelist(db)
  let activeProviders = await getActiveProviders(db)

  if (whitelist.length > 0) {
    activeProviders = activeProviders.filter((p) => whitelist.includes(p.provider_id))
  }

  activeProviders = activeProviders.filter((provider) => providerMap[provider.provider_id])

  if (activeProviders.length === 0) {
    console.log('[mail] delivery_unavailable')
    return false
  }

  const tried = new Set<string>()

  while (tried.size < activeProviders.length && tried.size < 3 && Date.now() < deadline) {
    const remaining = activeProviders.filter((p) => !tried.has(p.provider_id))
    const selected = selectProvider(remaining)
    if (!selected) break

    tried.add(selected.provider_id)
    const adapter = providerMap[selected.provider_id]
    if (!adapter) continue

    let config: Record<string, string>
    try {
      config = JSON.parse(selected.config_json) as Record<string, string>
      config.from = params.from ?? config.from ?? 'noreply@vocab.app'
    } catch {
      console.log('[mail] provider_configuration_invalid')
      continue
    }
    try {
      const ok = await adapter.send({
        to: params.to,
        subject: params.subject,
        html: params.html,
        config,
        timeoutMs: Math.min(5000, deadline - Date.now()),
      })
      if (ok) return true
      console.log('[mail] provider_delivery_failed')
    } catch {
      // A timeout/network failure might have occurred after acceptance. Do not duplicate mail.
      console.log('[mail] provider_delivery_unknown')
      return false
    }
  }

  console.log('[mail] delivery_exhausted')
  return false
}

export async function sendEmail(
  db: D1Database,
  params: { to: string; subject: string; html: string; from?: string },
): Promise<boolean> {
  const deadline = Date.now() + 15000
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => {
        console.log('[mail] delivery_deadline_exceeded')
        resolve(false)
      }, 15000)
    })
    return await Promise.race([deliverEmail(db, params, deadline), timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
