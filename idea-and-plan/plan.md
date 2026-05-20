# **Master Plan — AI-Powered Multilingual Vocabulary and Phrase App (Duolingo-like) on Cloudflare Workers**

## **Phase 0 — Initialization & Foundation (Bootstrap, ~0.5 - 1 day)**

**Goal: Scaffold the monorepo, set up CI, configure linting/formatting, and prepare database migrations.**

1.  **Initialize pnpm workspace at root:** `pnpm-workspace.yaml` **containing** `backend` **and** `frontend`**.**
2.  **Detailed Sample** `**wrangler.toml**` **Configuration:**
    
    Below is the complete configuration for the `wrangler.toml` file located in the `backend` directory (or root directory depending on monorepo structure) to integrate all necessary resources. This configuration includes the native Cloudflare Workers Rate Limiting bindings:
    
    ```plaintext
    name = "ai-vocab-app"
    main = "src/index.ts"
    compatibility_date = "2026-05-20"
    
    # [Static Assets] Configure serving the Frontend SPA located in the assets directory
    [assets]
    directory = "../assets"
    binding = "ASSETS"
    
    # [Vars] Declare non-sensitive environment variables (Non-secret vars)
    [vars]
    EMAIL_FROM = "no-reply@yourdomain.com"
    EMAIL_FROM_NAME = "AI Vocab App"
    # Default Email Provider options: CSV string "aws_ses,postmark,sendpulse,resend" (or dynamically read from the system_settings table in D1)
    EMAIL_PROVIDER = "database_dynamic"
    AWS_REGION = "us-east-1"
    
    # [Workers AI] Bindings to call AI models (Llama, Whisper, Melotts) directly from the Worker env
    [ai]
    binding = "AI"
    
    # [KV] Cloudflare KV namespace used as a Caching layer for the AI vocabulary generation API
    [[kv_namespaces]]
    binding = "CACHE"
    id = "xxxx_cache_kv_id_production"
    preview_id = "xxxx_cache_kv_id_local"
    
    # [D1] Cloudflare D1 SQL database configuration for User, Tokens, Learning progress, and SM-2
    [[d1_databases]]
    binding = "DB"
    database_name = "ai_vocab_db"
    database_id = "xxxx_d1_database_id_production"
    migrations_dir = "migrations"
    
    # [Rate Limit] Protection against DDoS, Spam, and resource exhaustion hacking
    [[unsafe.bindings]]
    name = "RATE_LIMITER_API"
    type = "ratelimit"
    namespace_id = "1001"
    simple = { limit = 10, period = 60 } # Default: 10 req / 60s
    
    [[unsafe.bindings]]
    name = "RATE_LIMITER_AUTH"
    type = "ratelimit"
    namespace_id = "1002"
    simple = { limit = 3, period = 900 } # Strict for Auth: 3 req / 15 minutes
    ```
    
    *   **Addition**
        
        Environment Variable Management: Set up `.dev.vars` for local development and Cloudflare Secrets for production.
        
    *   **Email Server Addition**
        
        Declare environment variables to flexibly configure Email Server services (API Key, Base URL, credentials for AWS SES, Postmark, SendPulse, Resend).
        
3.  `backend/` **Hono + TS + Zod + Vitest.**
    *   **Addition**
        
        Install Wrangler D1 Migrations (`wrangler d1 migrations create/apply`) to manage database schema versioning right from the start.
        
4.  `frontend/` **Vite + Vue 3 + TS + Tailwind 4 + Vue Router 4 + Pinia + vue-i18n@10.**
    *   **Addition**
        
        Install `pinia-plugin-persistedstate` to automatically persist the state (preventing loss of lesson data if the user refreshes the page).
        
5.  **Shared Tooling: ESLint flat config, Prettier, base tsconfig, Husky + lint-staged.**
6.  **GitHub Actions: workflow** `ci.yml` **(typecheck, lint, test, build) +** `deploy.yml` **(wrangler deploy on** `main`**).**
    *   **Addition**
        
        Integrate Deploy Previews (staging environments) for Pull Requests before merging into the `main` branch.
        

**Deliverable:** `pnpm install && pnpm -r build` runs clean; CI is green; Local environment is ready for DB migration.

## **Phase 1 — Backend i18n + Multilingual Content Generation (~2 - 2.5 days)**

### **1.1 Global Locale Configuration**

*   **File** `shared/locales.ts` **(exported to both backend & frontend via workspace package** `@vocab/shared`**):**
    
    ```plaintext
    export const SUPPORTED_LOCALES = ['en','vi','ja','ko','th','zh','fr','de'] as const;
    export type Locale = typeof SUPPORTED_LOCALES[number];
    export const LOCALE_LABELS: Record<Locale,string> = {  
        en:'English', vi:'Tiếng Việt', ja:'日本語', ko:'한국어',  
        th:'ไทย', zh:'中文', fr:'Français', de:'Deutsch'
    };
    ```
    

### **1.2 API Response i18n (Errors, Messages)**

*   **Hono middleware reading the** `Accept-Language` **header or query parameter** `?lang=`**, parsing →** `c.set('locale', resolveLocale(...))`**.**
*   **Directory** `backend/src/i18n/{en,vi,ja,ko,th,zh,fr,de}.json` **containing keys such as** `errors.invalid_payload`**,** `errors.ai_failed`**,** `quiz.correct`**,** `errors.rate_limited`**.**
*   **Helper function** `t(c, key, vars?)`**.**

### **1.3 Word & Phrase Pair Generation API**

**Endpoint:** `POST /api/generate` **→ supports both Words and Phrases/Collocations:**

*   **AI Resource Protection (Rate Limiting):** Utilizes `RATE_LIMITER_API` binding to immediately block any IP making more than **10 requests/minute**. Returns HTTP 429 Too Many Requests along with an i18n translated message to prevent hackers from draining the project's AI budget.

```plaintext
// Request
{  
    "source": "en",        // "front side" language  
    "target": "vi",        // "back side" language  
    "topic": "travel",  
    "level": "A2",         // CEFR  
    "count": 10,  
    "uiLocale": "vi",      // language for errors/explanations
    "mode": "mix"          // [Addition] "word" (single words) | "phrase" (collocations/idioms) | "mix" (both)
}
// Response
{  
    "pairs": [{     
        "source": "boarding pass",     // Supports long phrases instead of just single words
        "target": "thẻ lên máy bay",     
        "exampleSource": "Please have your boarding pass ready.",     
        "exampleTarget": "Vui lòng chuẩn bị sẵn thẻ lên máy bay của bạn.",     
        "ipa": "/ˈbɔː.dɪŋ ˌpɑːs/",      // IPA phonetics if source = en     
        "pos": "noun phrase",          // [Addition] Part of speech: noun, verb, idiom, phrasal verb...
        "isPhrase": true               // [Addition] Phrase flag for frontend UI optimization
    }]
}
```

*   **Dynamic Prompt Builder (**`services/prompts.ts`**) based on** `source/target` **and** `mode`**:**
    *   If `phrase` or `mix` is selected, the prompt instructs the AI to generate common collocations, phrasal verbs, or realistic idioms under the selected topic.
*   **Zod schema validation for each pair; retry up to 1 time upon failure.**
*   **AI Fallback Mechanism:** If the AI continuously returns invalid JSON formats (hallucinations) more than twice, fall back to a static, pre-defined JSON list stored in the code (containing basic words and phrases across topics) to ensure a smooth, unblocked user experience.
*   **Cache key:** `sha256(source|target|topic|level|count|mode|dayBucket)`**; TTL 24h.**

### **1.4 Multilingual Quiz API**

`POST /api/quiz` **body** `{ pairs, direction: 'source→target' | 'target→source' }` **— distractor options are pulled from the database pool matching** `topic+level+target`**. If there are insufficient options, the AI is called to generate contextually similar distractors.** Rate limit is configured at **15 requests/minute**.

### **1.5 Metadata Endpoints**

*   `GET /api/locales` **→ returns the list of locales and labels.**
*   `GET /api/topics?uiLocale=ja` **→ returns translated topics according to the UI locale.**

### **1.6 Tests**

**Vitest + Miniflare: 1 test for each representative language pair** `(source,target)` **(e.g., en↔vi, ja↔en, zh↔fr) — verifying clean JSON schemas that output both single words and long phrases.**

**Deliverable:** `curl` requests for all 8 languages return valid vocabulary pairs; cache hits successfully on the second attempt; fallback activates when AI failure is mocked; API is blocked with HTTP 429 when rate limit is exceeded.

## **Phase 2 — Frontend Vue 3 + Tailwind + i18n (~2 days)**

### **2.1 Stack & Structure**

```plaintext
frontend/
├── tailwind.config.ts
├── postcss.config.js
├── vite.config.ts            # outDir '../assets', proxy /api
├── index.html
└── src/    
    ├── main.ts               # createApp + router + pinia + i18n    
    ├── App.vue    
    ├── router/index.ts    
    ├── stores/    
    │   ├── session.ts        # current learning pairs (words/phrases), quiz score    
    │   └── prefs.ts          # uiLocale, source, target, learningMode (persist to localStorage)    
    ├── i18n/    
    │   ├── index.ts          # createI18n, lazy loading    
    │   └── messages/{en,vi,ja,ko,th,zh,fr,de}.json    
    ├── api/client.ts         # fetch wrapper sending Accept-Language + Global HTTP 429 Rate Limit handler 
    ├── composables/    
    │   ├── useLocale.ts      # switch UI locale + update html lang/dir    
    │   └── useTTS.ts         # Web Speech API    
    ├── views/    
    │   ├── HomeView.vue      # selection: source/target/topic/level/count/mode (word/phrase)
    │   ├── LearnView.vue     # flashcard dynamic view   
    │   ├── QuizView.vue    
    │   └── ResultView.vue    
    └── components/        
        ├── LanguageSwitcher.vue        
        ├── Flashcard.vue        # Auto-scaling text size for long phrases
        ├── QuizQuestion.vue     # Flexible layout for phrase answers
        └── ProgressBar.vue
```

### **2.2 vue-i18n & SEO Meta**

*   `legacy: false`**,** `globalInjection: true`**.**
*   **Lazy load messages:** `import('./messages/' + locale + '.json')` **— fallback to** `en`**.**
*   **Persist** `uiLocale` **in** `localStorage` **(key** `vocab.uiLocale`**), synchronized with** `<html lang>` **and** `document.dir` **(TH/JA/KO/ZH/FR/DE are LTR — no RTL needed).**
*   **Integrate** `**@unhead/vue**` to dynamically update the `<title>` and `<meta description>` based on the chosen language.

### **2.3 Tailwind & Rendering Long Text (Phrases)**

*   **Tailwind 4 (CSS-first config via** `@theme`**) or 3.4 if plugin stability is required.**
*   **Brand color scheme, dark mode configuration utilizing the** `class` **strategy, flashcard flip animations.**
*   **Auto-scaling Typography for Phrases:** Implement utility CSS classes so that when a long phrase is rendered (`isPhrase: true` or string length > 20 characters), the font size on the Flashcard automatically downscales (e.g., from `text-4xl` to `text-2xl` or `text-xl`) to prevent layout overflowing or ugly word-wrapping on mobile devices.
*   **Fonts: Inter for Latin alphabets, Noto Sans JP/KR/SC/Thai for regional scripts — loaded via Google Fonts or self-hosted.**

### **2.4 Home Screen**

*   **Two dropdowns: Source language / Target language (mutually exclusive).**
*   **Learning mode dropdown:** Select "Words", "Phrases & Idioms", or "Mixed".
*   **Topic dropdown (translated based on** `uiLocale`**).**
*   **Radio level selection (A1/A2/B1/B2 with display mappings).**
*   **Slider count (5–20). "Start" button triggers a call to** `/api/generate`**.**

### **2.5 Learn / Quiz / Result Screens**

*   **Flashcard flip animation; includes a TTS button utilizing** `speechSynthesis` **to fluently pronounce long phrases in the** `source` **language.**
*   **Quiz:** Design a vertical list layout for quiz options instead of a grid layout when displaying phrases, ensuring long texts do not get truncated or wrap awkwardly.
*   **Quiz: 4 randomized choices; highlights correct/incorrect answers instantly on click; score summary with a retry button.**

### **2.6 Build → Assets**

*   `vite.config.ts`**:** `build.outDir = '../assets'`**,** `emptyOutDir = true`**.**
*   **Worker Static Assets binding serves the SPA, with fallback to** `index.html`**.**

**Deliverable:** UI switches seamlessly between 8 languages; successful learning cycles for EN→JA, JA→VI, ZH→FR with both words and phrases.

## **Phase 3 — Quality, Accessibility, and Performance (~1 day)**

1.  **A11y:** ARIA labels (`role="button"`, `aria-live` for quiz feedback), focus rings, and keyboard navigation (Enter to flip, keys 1–4 to select quiz options).
2.  **Lighthouse score ≥ 95 across all 4 categories — font preloading, route code-splitting, and asset filename hashing (default in Vite).**
3.  **Lightweight Offline Cache:** Service Worker (Workbox) to cache static assets and the last learning session for offline study.
4.  **Comprehensive Security & Rate Limiting (DDoS & Anti-Hacking Protection):**
    *   Leverage the native Cloudflare **Workers Rate Limiting API** configured in `wrangler.toml`.
    *   Implement a Hono middleware to dynamically evaluate the rate limits per request IP.
    *   Configure Cloudflare WAF rules on the dashboard to block IPs generating excessive HTTP 429 rate limit responses.
5.  **Logging:** Structured JSON logs using `console.log` → exported to Workers Logpush or evaluated via Workers Tail.
    *   **Alerting Webhooks:** Flag continuous `5xx` errors or consecutive AI generation failures to automatically ping Slack/Discord webhooks.
6.  **Vue Error Boundary:** Display translated fallback error pages matching the user's locale. Catch 429 status codes and display: "The system is experiencing high traffic, please try again in a moment."
7.  **Web Analytics:** Integrate **Cloudflare Web Analytics** (free, cookie-less, and privacy-first) to monitor traffic without using tracking scripts like Google Analytics.

## **Phase 4 — Auth & Magic Link Sign-In (~3 days)**

### **4.1 D1 Database Design**

Create SQL schemas to manage user profiles, email verification states, temporary secure login tokens, **and dynamic credentials for the rotating email dispatch system directly from the database**.

*   `**users**` **table:**
    
    ```plaintext
    CREATE TABLE users (
        id TEXT PRIMARY KEY,                       -- User's UUID
        email TEXT UNIQUE NOT NULL,                -- User's email address
        email_verified BOOLEAN DEFAULT FALSE,      -- Set to TRUE after clicking the Magic Link
        activated_date TEXT,                       -- ISO8601 Timestamp YYYY-MM-DD HH:MM:SS on first activation
        activation_method TEXT,                    -- Method: defaults to 'open_email' for Magic Link, 'oauth' for Google
        created_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Initial registration date
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Latest update date
        timezone TEXT DEFAULT 'UTC'                -- Timezone used for daily learning cron reminders
    );
    ```
    
*   `**magic_tokens**` **table:**
    
    ```plaintext
    CREATE TABLE magic_tokens (
        token_hash TEXT PRIMARY KEY,               -- SHA-256 hash of the secure random token
        email TEXT NOT NULL,                       -- Email requesting login
        expires_at TEXT NOT NULL,                  -- Token expiration timestamp (typically 15 minutes)
        used BOOLEAN DEFAULT FALSE,                -- Flag to prevent token replay attacks
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    ```
    
*   `**email_providers_config**` **table (Stores sensitive API credentials and rotating statuses dynamically so admins can edit directly on Cloudflare D1 UI Dashboard):**
    
    ```plaintext
    CREATE TABLE email_providers_config (
        provider_id TEXT PRIMARY KEY,             -- Provider ID: 'aws_ses', 'postmark', 'sendpulse', 'resend'
        provider_name TEXT NOT NULL,              -- Display name (e.g., 'Amazon SES', 'Resend API')
        is_active INTEGER DEFAULT 1,              -- Status: 1 = Active (included in rotation), 0 = Disabled
        weight INTEGER DEFAULT 25,                -- Percent weight distribution for randomized routing (e.g., 25)
        config_json TEXT NOT NULL,                -- Encrypted/sensitive JSON config (e.g., {"apiKey": "...", "region": "us-east-1", "secret": "..."})
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    ```
    
*   `**system_settings**` **table (Stores system variables like CSV-formatted routing whitelists):**
    
    ```plaintext
    CREATE TABLE system_settings (
        key TEXT PRIMARY KEY,                     -- 'force_email_provider'
        value TEXT NOT NULL,                      -- CSV string (e.g., 'aws_ses,postmark,sendpulse' for selective rotation, or 'postmark' to force a single provider)
        description TEXT,                         -- Configuration description
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    ```
    

### **4.2 Magic Link Verification Workflow**

1.  **Initiate Request (**`**POST /api/auth/request**`**):**
    *   The user enters their email on the Vue 3 frontend and clicks "Send Link".
    *   The backend generates a cryptographically secure token of 32 characters: `const rawToken = crypto.randomUUID() + crypto.getRandomValues(...)`.
    *   The backend hashes the raw token with SHA-256 and records it into `magic_tokens` alongside a 15-minute expiration time. This ensures security even if database snapshots are leaked.
    *   **Dynamic Email Dispatch:**
        
        Dispatches an email containing the activation hyperlink to the user via the **Mail Service Adapter** (automatically reading configurations from the D1 database to dynamically rotate or selectively route via AWS SES, Postmark, SendPulse, Resend, etc.): `https://vocab-app.pages.dev/auth/verify?token=${rawToken}` pointing to the Vue SPA.
        
2.  **Verify & Login (**`**POST /api/auth/verify**`**):**
    *   The user clicks the link in their inbox, and the browser navigates to `/auth/verify` on the Vue app.
    *   The Vue app extracts the `token` parameter from the URL query and posts it to the backend verification endpoint.
    *   The backend hashes the `rawToken` with SHA-256 and queries the `magic_tokens` table:
        *   Evaluates if the token exists, whether it has already been used (`used = true`), or if it has expired relative to the current server timestamp (`expires_at`).
        *   If invalid or expired: Returns an error message for the frontend to notify the user and prompt them to generate a new link.
    *   If valid:
        *   Sets `used = true` in the DB to prevent replay attacks.
        *   Check if a user with this email already exists in the `users` table (Upsert logic):
            *   **New User:** Insert a record with `email_verified = true`, `activated_date = CURRENT_TIMESTAMP`, `activation_method = 'open_email'`.
            *   **Existing User:** Updates `email_verified = true`, updates `activated_date` (if not previously activated), and modifies `activation_method = 'open_email'`.
        *   Generates a signed JWT token using `hono/jwt` carrying the `user_id`.
        *   Sets the JWT inside a secure HTTP cookie with options: `HttpOnly`, `Secure`, `SameSite=Lax`.

### **4.3 API Endpoint Specifications**

*   `POST /api/auth/request` → Accepts JSON `{ email }`, generates tokens, writes to DB, and sends magic emails. **(STRICT RATE LIMIT ENFORCED: Linked to** `**RATE_LIMITER_AUTH**` **- Max 3 requests per 15 minutes per IP/Email. Blocked with HTTP 429 if violated. This is the crucial shield against automated email-bombing attacks and provider cost spikes).**
*   `POST /api/auth/verify` → Accepts JSON `{ token }`. Verifies and flags tokens, activates profiles (`email_verified: true`, `activated_date`, `activation_method: 'open_email'`), returns user details, and issues HTTP-only JWT cookies. **(Rate-limited at 10 requests/minute to protect against brute-forcing).**
*   `GET /api/me` → Middleware decodes the JWT cookie and returns the active user profile from the database.
*   `POST /api/logout` → Cleans the HTTP-only JWT cookie to safely log out.

### **4.4 Mail Service Adapter Integration (AWS SES, Postmark, SendPulse, Resend)**

To run seamlessly inside Cloudflare Workers (an environment that does not support classic TCP SMTP sockets out of the box without special runtime socket configurations), the app integrates the **HTTP REST APIs** of each mail carrier using an object-oriented Adapter Pattern.

*   **Adapter Structure (**`**backend/src/services/mail/**`**):**
    
    ```plaintext
    // Interface simulating generic mail sending behavior
    export interface EmailProvider {
      sendMail(to: string, subject: string, htmlContent: string, config: any): Promise<boolean>;
    }
    ```
    
*   **Provider Implementations:**
    1.  **AWS SES Adapter:** Signs requests using AWS v4 Signature and triggers the REST API endpoint `https://email.${region}.amazonaws.com/v2/email/outbound-emails` directly from the Worker (highly secure and faster than SMTP).
    2.  **Postmark Adapter:** Shoots HTTP requests to `https://api.postmarkapp.com/email` sending the `X-Postmark-Server-Token` read from the DB.
    3.  **SendPulse Adapter:** Automatically fetches and caches an OAuth2 token using client ID / client secret, then routes request data to `/smtp/emails`.
    4.  **Resend Adapter:** Fires requests to `https://api.resend.com/emails` passing `Authorization: Bearer` keys extracted from the database.
*   **D1-Backed Config & Rate Limit Mitigation:**
    
    Sensitive API keys are stored in the D1 table `email_providers_config`. Admins can alter API credentials, adjust weights, or toggle providers on the fly on Cloudflare's D1 UI without redeploying code.
    
    *   **Weighted Random Selection & Whitelisting Algorithm:**
        1.  **Step 1:** Read the `force_email_provider` key from `system_settings`. The value supports **CSV-formatted strings** (e.g., `'aws_ses,postmark,sendpulse'`).
            *   If multiple providers are specified, the backend splits the string by comma to build a whitelist. Only whitelisted providers will participate in the rotation.
            *   If a single provider is specified (e.g., `'postmark'`), it acts as a forced override.
            *   If empty, all active providers from the database are used.
        2.  **Step 2:** Query active provider configurations matching the whitelist filter:
            
            ```plaintext
            -- Fetch the entire list of valid, active providers
            SELECT * FROM email_providers_config WHERE is_active = 1;
            ```
            
            _(Perform array_ `_.filter()_` _on the retrieved records using the whitelisted array values)._
            
        3.  **Step 3:** If only 1 provider remains after filtering, use it immediately. If multiple exist, apply a **Weighted Random Selection** algorithm matching the D1 database `weight` values:
            
            ```plaintext
            // Backend logic example:
            // Assuming activeProviders is the array filtered against the Admin's CSV string
            let totalWeight = activeProviders.reduce((sum, p) => sum + p.weight, 0);
            let randomNum = Math.random() * totalWeight;
            let selectedProvider = activeProviders[0];
            
            for (const provider of activeProviders) {
              randomNum -= provider.weight;
              if (randomNum <= 0) {
                selectedProvider = provider;
                break;
              }
            }
            // Extract the dynamic JSON configuration
            const config = JSON.parse(selectedProvider.config_json);
            ```
            
        4.  **Automatic Fallback Routing:** If provider $A$ is picked but fails due to API timeouts, authentication errors, or exceeded limits, the application catches the error, logs the failure, temporarily excludes $A$ from the pool, and instantly retries dispatching with another available whitelisted provider to ensure 100% email delivery success.
*   **Sample DB Configurations (Stored within D1** `**config_json**` **columns):**
    
    ```plaintext
    // Amazon SES record config_json sample:
    {
      "provider_id": "aws_ses",
      "provider_name": "Amazon SES Service",
      "is_active": 1,
      "weight": 35,
      "config_json": "{\"accessKeyId\":\"AKIA...\",\"secretAccessKey\":\"wJalr...\",\"region\":\"us-east-1\"}"
    }
    
    // Resend record config_json sample:
    {
      "provider_id": "resend",
      "provider_name": "Resend API Platform",
      "is_active": 1,
      "weight": 25,
      "config_json": "{\"apiKey\":\"re_...\"}"
    }
    ```
    

### **4.5 Persisting Learning Progress**

*   Write user study logs into `learned_pairs(user_id, source, target, source_text, target_text, last_seen, ease, interval, status)`:
    *   **Log** `**is_phrase: boolean**` properties to support phrase-based analytics.
    *   **Maintain a** `**status**` **field** (`learning` | `mastered` | `archived`) to enable filtering and status resets.

### **4.6 Frontend Authentication UX**

*   **Login Page:** Simple email input with a clean submit button. Upon successful request, render a beautiful confirmation prompt instructing the user to check their inbox.
*   **Verification Intermediary (**`**/auth/verify**`**):** Displays a spinning loading animation with a status text: "Verifying your sign-in link...". On API success, displays a success toast and redirects the user directly to the core dashboard.
*   **Profile View (**`**/profile**`**):** Displays user profile details including verification badge (`Verified ✔`), activation timestamp (`Activated on: [date]`), signup method (`Login method: Magic Link`), current learning streak, and count of mastered vocabulary.
*   **GDPR & Data Portability:** Add a button to "Download my data" (exporting learned vocabulary lists in JSON/CSV formats) inside the Profile screen to comply with privacy policies and increase user trust.

## **Phase 5 — Spaced Repetition (SM-2) & Vocabulary Reset (~2 days)**

1.  **SM-2 Core Algorithm: updating properties like** `EF`**,** `interval`**, and** `repetitions`**.**
    *   When a user successfully answers a card consecutively and reaches a specific interval threshold (e.g., `interval >= 30` days), the pair automatically transitions to `mastered` status.
2.  **Retrieve daily scheduled cards via** `GET /api/review/today?user=…` **filtering records where** `next_review <= now()`**.**
3.  **Re-learn Mastered Vocabulary:**
    *   **Endpoint** `POST /api/vocab/reset-status`: Enables users to reset specific vocabularies or their entire `mastered` list back to `learning` status to restart the SM-2 learning loops.
    *   **Lifetime Review Mode:** Users can toggle this option from the Dashboard. Instead of hiding mastered cards forever, SM-2 scales the `interval` to a high cap (e.g., reappearing every 180 days to test long-term retention).
    *   **Frontend Interface:** A dedicated `/mastered` page listing all learned cards, featuring individual and batch "Re-learn card" actions with clear validation prompts.
4.  **Review Interface UX:** Simple 1–5 self-rating sliders updated via `POST /api/review/grade` to adjust card weights.
5.  **Cloudflare Cron Triggers executing daily at 00:05 UTC: sends study reminders (utilizing the dynamic database-configured Mail Service Adapter) including custom statistics summarizing mastered words and phrases.**
    *   **Timezone Handling:** The Cron job executes in UTC. The logic queries user timezones and checks whether it corresponds to their localized morning hours (e.g., 8:00 AM) before sending, preventing late-night email spam.

## **Phase 6 — High-Quality TTS + Audio Writing Drills (~2.5 days)**

1.  **Server-Side TTS:** Powered by Cloudflare Workers AI model `@cf/myshell-ai/melotts` providing high-fidelity, natural reading for EN/ZH/FR/JA/KR phrases; other languages gracefully fall back to local browser Web Speech APIs.
    *   **Resource Protection:** Apply `RATE_LIMITER_API` (e.g., 20 requests/minute/IP) on `POST /api/tts` endpoints to prevent automated scraping of audio files and unexpected R2 or Workers AI costs.
2.  **Endpoint** `POST /api/tts` **→ pipes a** `audio/mpeg` **stream, cached in Cloudflare R2 using the MD5 hash of the text.**
3.  **Listening Drills:** Plays the audio segment → user transcribes it; validated using Levenshtein distance matching after stripping formatting diacritics, kana, and double spaces.
4.  **Typing Assistance:** Displays starting character hints for each word in long phrases, customized to remain IME-friendly for JA/KO/ZH/TH inputs.
5.  **Speaking Drills (Pronunciation):** Uses Cloudflare Workers AI speech-to-text model `@cf/openai/whisper`. Captures user microphone input -> posts audio to Worker -> Whisper processes to text -> calculates string similarity against the target phrase to grade pronunciation.
    *   **Strict Rate Limiting:** Enforce a strict limit on audio uploads (e.g., 10 uploads/minute/IP) to prevent volumetric payload attacks on Cloudflare's AI infrastructure.

## **Phase 7 — Gamification & Social (~2 days)**

1.  **Track learning Streaks, XP milestones, and Weekly Leagues using D1/KV storage.**
2.  **Global Leaderboard Endpoint:** `GET /api/leaderboard?scope=week|all`**.**
3.  **Earnable Badges (e.g., "Collocation Master", "The Phoenix" for re-learning vocabularies), accompanied by celebration toast notifications.**
4.  **Shareable Achievements using dynamic OpenGraph images — powered by** `**@vercel/og**` **run natively on Edge Workers.**
    *   **Social Challenge:** Create an endpoint `GET /api/challenge/:id` allowing users to share custom study cards with friends. Friends opening the link can challenge the same 10-card quiz deck and compare their high scores.

## **Phase 8 — Native-Feel & Production Deployment (~1.5 days)**

1.  **PWA Integration:** Web App Manifest translated into 8 locales (`name` and `short_name` dynamically matching `uiLocale`), responsive custom icons, and installation prompts.
2.  **Capacitor Mobile Wrapper (Optional) for iOS/Android distribution — reusing the identical Vue 3 SPA.**
3.  **Error Tracking:** Set up Sentry SDKs for both Cloudflare Workers (Backend) and Vue 3 (Frontend).
4.  **Production DNS Configuration:** Map custom domains, enable Cloudflare SSL, and configure Argo Smart Routing to minimize database global response times.
5.  **Documentation:** Deliver comprehensive multilingual `README.md` files (EN + VI).

## **Phase 9 — Full QA & Launch (~1 day)**

1.  **Unit Testing:** Vitest to test AI prompt structures, cache mechanisms, Magic Link validation steps, database email adapters, and Pinia store properties.
2.  **Integration Testing:** Miniflare to simulate the 8-language setup with 3 sample proficiency levels, verifying phrase parsing, D1 email adapter configurations, and mocking successful email delivery. Verify the Rate Limiter correctly returns HTTP 429 when spam is simulated.
3.  **E2E Testing:** Playwright testing covering: Request magic token → click verification link → authenticate → select learning mode (Word/Phrase) → flashcard study → complete quiz → view results → reset mastered words → restart learning cycle.
4.  **Load Testing:** `k6` script pushing 100 RPS to `/api/generate` to benchmark caching hits/misses, with bypassed rate-limiting headers in staging environments.
5.  **Pre-launch Checklist:** Ensure proper keyboard navigation and screen-reader accessibility (axe-core), score ≥ 95 on Lighthouse audits, and bundle sizing ≤ 250KB gzipped.
6.  **Tag** `**v1.0.0**`, execute production release, and monitor log exceptions on Logpush for 48 hours.

## **Roadmap Summary**

| **Phase** | **Objective** | **Timeline** | **Dependencies** |
| --- | --- | --- | --- |
| **Phase 0** | Bootstrap monorepo, CI setup, DB Migrations & Config Mail/Rate Limit | 0.5 - 1 day | —   |
| **Phase 1** | Backend i18n + AI Word & Phrase Generation (Fallback & Abuse Protection) | 2.5 days | Phase 0 |
| **Phase 2** | Vue 3 + Tailwind (Auto-scale Text) + i18n & 429 UI Handling | 2 days | Phase 1 |
| **Phase 3** | Quality audit: A11y, performance, rate limiting, analytics, alerts | 1 day | Phase 2 |
| **Phase 4** | Magic Link Auth + Multi-Provider Email Service Adapter (CSV filter + Anti-Spam Email Bombing) | 3 days | Phase 3 |
| **Phase 5** | SM-2 Scheduler + Vocab Reset/Re-learn + Timezone-based Cron reminders | 2 days | Phase 4 |
| **Phase 6** | Server TTS + Listening Drills + STT Speaking (Whisper with Rate Limit) | 2.5 days | Phase 5 |
| **Phase 7** | Gamification & Weekly Leaderboards + Social Challenge | 2 days | Phase 4 |
| **Phase 8** | PWA assets + Deployment configuration | 1.5 days | Phase 7 |
| **Phase 9** | Comprehensive QA, E2E Testing & Staging Validation | 1 day | Phase 8 |
| **Total** |     | **~ 16 - 18 days** |     |
