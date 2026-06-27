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
      'SELECT provider_id, provider_name, is_active, weight, config_json FROM email_providers_config WHERE is_active = 1',
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

export async function sendEmail(
  db: D1Database,
  params: { to: string; subject: string; html: string; from?: string },
): Promise<boolean> {
  const whitelist = await getForceProviderWhitelist(db)
  let activeProviders = await getActiveProviders(db)

  if (whitelist.length > 0) {
    activeProviders = activeProviders.filter((p) => whitelist.includes(p.provider_id))
  }

  if (activeProviders.length === 0) {
    console.log(`[mail] No active providers configured — email not sent to ${params.to}`)
    return false
  }

  const tried = new Set<string>()

  while (tried.size < activeProviders.length) {
    const remaining = activeProviders.filter((p) => !tried.has(p.provider_id))
    const selected = selectProvider(remaining)
    if (!selected) break

    tried.add(selected.provider_id)
    const adapter = providerMap[selected.provider_id]
    if (!adapter) continue

    try {
      const config = JSON.parse(selected.config_json) as Record<string, string>
      config.from = params.from ?? config.from ?? 'noreply@vocab.app'
      const ok = await adapter.send({
        to: params.to,
        subject: params.subject,
        html: params.html,
        config,
      })
      if (ok) return true
      console.log(`[mail] Provider ${selected.provider_id} failed, trying next...`)
    } catch (err) {
      console.log(`[mail] Provider ${selected.provider_id} error: ${err}`)
    }
  }

  console.log(`[mail] All providers exhausted — email not sent to ${params.to}`)
  return false
}
