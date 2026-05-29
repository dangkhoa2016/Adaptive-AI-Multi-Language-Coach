import 'vitest/node'

declare module 'vitest/node' {
  interface InlineConfig {
    poolOptions?: {
      workers?: {
        wrangler?: {
          configPath?: string
          environment?: string
        }
        main?: string
        isolatedStorage?: boolean
      }
    }
  }
}

declare module 'cloudflare:workers' {
  export const env: Cloudflare.Env
  export const exports: Record<string, unknown>
}

declare module 'cloudflare:test' {
  export const env: Cloudflare.Env
  export function applyD1Migrations(
    db: D1Database,
    migrations: Array<{ name: string; sql: string }>,
  ): Promise<void>
}
