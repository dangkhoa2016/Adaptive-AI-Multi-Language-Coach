/** Only application-consumed settings can be changed through the admin API. */
export const SETTING_POLICIES = {
  AI_KEYS: { secret: true },
  AI_ENDPOINT_URL: { secret: false },
  AI_MODEL_NAME: { secret: false },
  AI_MODEL_OPTIONS: { secret: false },
} as const

export type SettingKey = keyof typeof SETTING_POLICIES

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTING_POLICIES, key)
}

export function validateSetting(key: string, value: unknown): asserts value is string {
  if (!isSettingKey(key)) throw new Error('invalid_key')
  if (typeof value !== 'string' || !value.trim() || value.length > 16384) {
    throw new Error('invalid_value')
  }
  try {
    if (key === 'AI_KEYS') {
      const keys: unknown = JSON.parse(value)
      if (
        !Array.isArray(keys) ||
        keys.length < 1 ||
        keys.length > 20 ||
        !keys.every((k) => typeof k === 'string' && k.length <= 4096 && /^[\x21-\x7e]+$/.test(k))
      ) {
        throw new Error('invalid_value')
      }
    } else if (key === 'AI_ENDPOINT_URL') {
      const url = new URL(value)
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.hash ||
        url.search ||
        !url.hostname.includes('.') ||
        /^(localhost|127\.|0\.|169\.254\.|10\.|192\.168\.)/i.test(url.hostname)
      ) {
        throw new Error('invalid_value')
      }
    } else if (key === 'AI_MODEL_NAME') {
      if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value)) throw new Error('invalid_value')
    } else {
      const options: unknown = JSON.parse(value)
      if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new Error('invalid_value')
      for (const [name, option] of Object.entries(options)) {
        if (name === 'max_output_tokens') {
          if (!Number.isInteger(option) || (option as number) < 1 || (option as number) > 32768)
            throw new Error('invalid_value')
        } else if (name === 'temperature' || name === 'top_p') {
          if (
            typeof option !== 'number' ||
            !Number.isFinite(option) ||
            option < 0 ||
            option > (name === 'top_p' ? 1 : 2)
          )
            throw new Error('invalid_value')
        } else {
          // Explicit fields prevent credentials or reserved request fields being smuggled into options.
          throw new Error('invalid_value')
        }
      }
    }
  } catch {
    throw new Error('invalid_value')
  }
}
