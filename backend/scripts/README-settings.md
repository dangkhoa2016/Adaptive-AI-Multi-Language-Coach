# App Settings — KV Seed Guide

How to configure and seed app settings into the `APP_KV` namespace.

## What gets stored

### `app_setting:config` — endpoint + model settings

| Field                              | Type   | Default                               | Description                               |
| ---------------------------------- | ------ | ------------------------------------- | ----------------------------------------- |
| `aiEndpointUrl`                    | string | `https://api.openai.com/v1/responses` | AI API endpoint URL                       |
| `aiModelName`                      | string | `gpt-5.4-mini`                        | Model identifier sent in the request body |
| `aiModelOptions.max_output_tokens` | number | `4096`                                | Max tokens in the AI response             |
| `aiModelOptions.temperature`       | number | `0.7`                                 | Creativity level (0–1)                    |

### AI Key — stored in D1 `system_settings`

The AI API key is stored separately in D1 under `env.AI_KEY` (encrypted).
Use the `setEnvSetting` utility or the settings admin endpoint to set it.

## Quick start

### 1. Seed defaults to local KV

```bash
cd backend
pnpm seed:settings:local
```

or at root directory:

```bash
pnpm --filter backend seed:settings:local
```

This writes the built-in defaults into the **local** KV namespace. No confirmation needed.

### 2. Seed custom values

Create a JSON file (copy from `scripts/settings.example.json`):

```bash
cp scripts/settings.example.json scripts/my-settings.json
# Edit scripts/my-settings.json with your values
```

Then seed it:

```bash
pnpm seed:settings:local --file ./scripts/my-settings.json
```

The provided values are **merged** with defaults — you only need to override what you want to change.

### 3. Seed to production (remote)

```bash
pnpm seed:settings:remote
```

This will:

1. Show the config that will be written
2. Prompt for `yes/no` confirmation
3. Write to `app_setting:config`

To skip the confirmation prompt (e.g. in CI):

```bash
SKIP_CONFIRM=true pnpm seed:settings:remote
```

> **Note:** Remote writes require `CLOUDFLARE_API_TOKEN` to be set in your environment.

## Verify what's stored

```bash
# Local — config
npx wrangler kv key get "app_setting:config" --binding=APP_KV --preview false

# Remote — config
npx wrangler kv key get "app_setting:config" --binding=APP_KV --remote --preview true
```

## How it works

The script (`scripts/seed-settings.mjs`):

1. Loads built-in defaults from `src/services/appSettings.ts`
2. Optionally merges overrides from a `--file` JSON argument
3. Writes to KV under `app_setting:config`

The backend reads settings at runtime via `getAppSettings()` from KV and resolves the AI key from D1 `system_settings` via `resolveEnv()` (auto-decrypts sensitive values).
