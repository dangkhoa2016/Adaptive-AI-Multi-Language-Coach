export interface EmailProvider {
  send(params: {
    to: string
    subject: string
    html: string
    config: Record<string, string>
    timeoutMs?: number
  }): Promise<boolean>
}

export interface ProviderRecord {
  provider_id: string
  provider_name: string
  is_active: number
  weight: number
  config_json: string
}
