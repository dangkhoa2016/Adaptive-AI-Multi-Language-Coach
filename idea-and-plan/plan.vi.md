# **Kế hoạch tổng thể — Ứng dụng học từ vựng và cụm từ AI đa ngôn ngữ (Duolingo-like) trên Cloudflare Worker**

## **Phase 0 — Khởi tạo & nền tảng (bootstrap, ~0.5 - 1 ngày)**

**Mục tiêu: scaffold repo monorepo, CI, lint, format, database migrations.**

1.  **Khởi tạo pnpm workspace ở root:** `pnpm-workspace.yaml` **chứa** `backend`**,** `frontend`**.**
2.  **Cấu hình** `**wrangler.toml**` **mẫu chi tiết:**
    
    Dưới đây là cấu hình hoàn chỉnh cho file `wrangler.toml` đặt tại thư mục `backend` (hoặc thư mục root tùy cách thiết lập monorepo) để tích hợp đầy đủ các tài nguyên cần thiết. Đã bổ sung cấu hình Rate Limit nguyên bản của Cloudflare Workers:
    
    ```plaintext
    name = "ai-vocab-app"
    main = "src/index.ts"
    compatibility_date = "2026-05-20"
    
    # [Static Assets] Định cấu hình phục vụ Frontend SPA nằm trong thư mục assets
    [assets]
    directory = "../assets"
    binding = "ASSETS"
    
    # [Vars] Khai báo các biến môi trường không nhạy cảm (Non-secret vars)
    [vars]
    EMAIL_FROM = "no-reply@yourdomain.com"
    EMAIL_FROM_NAME = "AI Vocab App"
    # Các tùy chọn Email Provider mặc định: chuỗi CSV "aws_ses,postmark,sendpulse,resend" (hoặc đọc động từ bảng system_settings trong D1)
    EMAIL_PROVIDER = "database_dynamic"
    AWS_REGION = "us-east-1"
    
    # [Workers AI] Cấp quyền gọi các mô hình AI (Llama, Whisper, Melotts) trực tiếp qua Worker env
    [ai]
    binding = "AI"
    
    # [KV] Liên kết Cloudflare KV dùng để làm tầng Caching cho API sinh từ vựng của AI
    [[kv_namespaces]]
    binding = "CACHE"
    id = "xxxx_cache_kv_id_production"
    preview_id = "xxxx_cache_kv_id_local"
    
    # [D1] Cấu hình cơ sở dữ liệu D1 SQL phục vụ lưu trữ User, Tokens, Học tập và SM-2
    [[d1_databases]]
    binding = "DB"
    database_name = "ai_vocab_db"
    database_id = "xxxx_d1_database_id_production"
    migrations_dir = "migrations"
    
    # [Rate Limit] Cấu hình bảo vệ chống DDoS, Spam, Hacking cạn kiệt tài nguyên
    [[unsafe.bindings]]
    name = "RATE_LIMITER_API"
    type = "ratelimit"
    namespace_id = "1001"
    simple = { limit = 10, period = 60 } # Default: 10 req / 60s
    
    [[unsafe.bindings]]
    name = "RATE_LIMITER_AUTH"
    type = "ratelimit"
    namespace_id = "1002"
    simple = { limit = 3, period = 900 } # Strict cho Auth: 3 req / 15 phút
    ```
    
    *   **Bổ sung**
        
        Quản lý biến môi trường: Thiết lập `.dev.vars` cho local và hệ thống Cloudflare Secrets cho production.
        
    *   **Bổ sung Email Server**
        
        Khai báo các biến môi trường để cấu hình linh hoạt dịch vụ Email Server (API Key, Base URL, Credentials của AWS SES, Postmark, SendPulse, Resend).
        
3.  `backend/` **Hono + TS + Zod + Vitest.**
    *   **Bổ sung**
        
        Cài đặt Wrangler D1 Migrations (`wrangler d1 migrations create/apply`) để quản lý version của schema database ngay từ đầu.
        
4.  `frontend/` **Vite + Vue 3 + TS + Tailwind 4 + Vue Router 4 + Pinia + vue-i18n@10.**
    *   **Bổ sung**
        
        Cài đặt `pinia-plugin-persistedstate` để tự động lưu state (tránh mất dữ liệu bài học nếu user lỡ F5).
        
5.  **Tooling chung: ESLint flat config, Prettier, tsconfig base, Husky + lint-staged.**
6.  **GitHub Actions: workflow** `ci.yml` **(typecheck, lint, test, build) +** `deploy.yml` **(wrangler deploy on** `main`**).**
    *   **Bổ sung**
        
        Tích hợp Deploy Preview (môi trường staging) cho các Pull Request trước khi merge vào nhánh `main`.
        

**Deliverable:** `pnpm install && pnpm -r build` **chạy sạch; CI xanh; Môi trường local có thể migrate DB.**

## **Phase 1 — Backend i18n + sinh nội dung đa ngôn ngữ (~2 - 2.5 ngày)**

### **1.1 Cấu hình locale chung**

*   **File** `shared/locales.ts` **(export từ cả backend & frontend qua workspace package** `@vocab/shared`**):**
    
    ```plaintext
    export const SUPPORTED_LOCALES = ['en','vi','ja','ko','th','zh','fr','de'] as const
    export type Locale = typeof SUPPORTED_LOCALES[number]
    export const LOCALE_LABELS: Record<Locale,string> = {  
        en:'English', vi:'Tiếng Việt', ja:'日本語', ko:'한국어',  
        th:'ไทย', zh:'中文', fr:'Français', de:'Deutsch'
    }
    ```
    

### **1.2 i18n cho phản hồi API (lỗi, message)**

*   **Middleware Hono đọc header** `Accept-Language` **hoặc query** `?lang=`**, parse →** `c.set('locale', resolveLocale(...))`**.**
*   **Thư mục** `backend/src/i18n/{en,vi,ja,ko,th,zh,fr,de}.json` **chứa key như** `errors.invalid_payload`**,** `errors.ai_failed`**,** `quiz.correct`, `errors.rate_limited`.
*   **Hàm** `t(c, key, vars?)`**.**

### **1.3 API sinh cặp từ/cụm từ — đa ngôn ngữ**

**Endpoint:** `POST /api/generate` **→ hỗ trợ cả Từ đơn (Word) và Cụm từ (Phrase/Collocation):**

*   **Bảo vệ tài nguyên AI (Rate Limiting):** Sử dụng `RATE_LIMITER_API` binding chặn đứng ngay lập tức nếu 1 IP cố tình gọi quá **10 lần/phút**. Trả về HTTP 429 Too Many Requests kèm câu thông báo dịch i18n nhằm tránh việc Hacker làm cạn kiệt ngân sách AI của dự án.

```plaintext
// Request
{  
    "source": "en",        // ngôn ngữ "mặt trước"  
    "target": "vi",        // ngôn ngữ "mặt sau"  
    "topic": "travel",  
    "level": "A2",         // CEFR  
    "count": 10,  
    "uiLocale": "vi",      // ngôn ngữ trả lỗi/giải thích
    "mode": "mix"          // [Bổ sung] "word" (từ đơn) | "phrase" (cụm từ/idiom) | "mix" (cả hai)
}
// Response
{  
    "pairs": [{     
        "source": "boarding pass",     // Hỗ trợ cụm từ dài thay vì chỉ từ đơn
        "target": "thẻ lên máy bay",     
        "exampleSource": "Please have your boarding pass ready.",     
        "exampleTarget": "Vui lòng chuẩn bị sẵn thẻ lên máy bay của bạn.",     
        "ipa": "/ˈbɔː.dɪŋ ˌpɑːs/",      // IPA phiên âm cụm từ nếu source = en     
        "pos": "noun phrase",          // [Bổ sung] Định dạng loại từ: noun, verb, idiom, phrasal verb...
        "isPhrase": true               // [Bổ sung] Đánh dấu cụm từ để frontend tối ưu hóa UI
    }]
}
```

*   **Prompt builder (**`services/prompts.ts`**) dynamic theo** `source/target` **và** `mode`:
    *   Nếu chọn `phrase` hoặc `mix`, prompt yêu cầu AI sinh ra các collocations thông dụng, phrasal verbs, idioms thực tế theo chủ đề tương ứng.
*   **Schema validation Zod cho từng cặp; retry 1 lần nếu fail.**
*   **Cơ chế Fallback AI:** Nếu AI liên tục trả về sai định dạng JSON (hallucination) quá 2 lần, fallback về một danh sách JSON tĩnh lưu sẵn trong code (chứa cả từ và cụm từ theo các chủ đề cơ bản) để đảm bảo User luôn có trải nghiệm mượt mà, không bị block.
*   **Cache key:** `sha256(source|target|topic|level|count|mode|dayBucket)`**; TTL 24h.**

### **1.4 API quiz đa ngôn ngữ**

`POST /api/quiz` **body** `{ pairs, direction: 'source→target' | 'target→source' }` **— distractor lấy từ pool cùng** `topic+level+target`**; nếu thiếu, gọi AI sinh thêm cụm từ nhiễu tương đồng.** Áp dụng cấu hình Rate Limit **15 req/phút**.

### **1.5 Endpoint metadata**

*   `GET /api/locales` **→ trả danh sách locale + labels.**
*   `GET /api/topics?uiLocale=ja` **→ trả danh sách chủ đề đã dịch.**

### **1.6 Tests**

**Vitest + Miniflare: 1 test cho mỗi cặp** `(source,target)` **đại diện (en↔vi, ja↔en, zh↔fr) — verify schema JSON sạch chứa cả từ đơn lẫn cụm từ dài.**

**Deliverable:** `curl` **8 ngôn ngữ đều trả từ/cụm từ hợp lệ; cache hit lần 2; fallback hoạt động khi cố tình mock AI fail; API bị chặn HTTP 429 nếu gọi quá nhanh.**

## **Phase 2 — Frontend Vue 3 + Tailwind + i18n (~2 ngày)**

### **2.1 Stack & cấu trúc**

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
    │   ├── session.ts        # pairs đang học (từ/cụm từ), điểm quiz    
    │   └── prefs.ts          # uiLocale, source, target, learningMode (persist localStorage)    
    ├── i18n/    
    │   ├── index.ts          # createI18n, lazy load    
    │   └── messages/{en,vi,ja,ko,th,zh,fr,de}.json    
    ├── api/client.ts         # fetch wrapper gửi Accept-Language + Xử lý mã lỗi 429 Rate Limit toàn cục 
    ├── composables/    
    │   ├── useLocale.ts      # đổi UI locale + html lang/dir    
    │   └── useTTS.ts         # Web Speech API    
    ├── views/    
    │   ├── HomeView.vue      # chọn source/target/topic/level/count/mode (từ/cụm)
    │   ├── LearnView.vue     # flashcard    
    │   ├── QuizView.vue    
    │   └── ResultView.vue    
    └── components/        
        ├── LanguageSwitcher.vue        
        ├── Flashcard.vue        # Hỗ trợ tự động căn chỉnh kích thước chữ cho cụm từ dài
        ├── QuizQuestion.vue     # UI lựa chọn linh hoạt cho cụm từ dài
        └── ProgressBar.vue
```

### **2.2 vue-i18n & SEO Meta**

*   `legacy: false`**,** `globalInjection: true`**.**
*   **Lazy load messages:** `import('./messages/' + locale + '.json')` **— fallback** `en`**.**
*   **Persist** `uiLocale` **trong** `localStorage` **(key** `vocab.uiLocale`**), đồng bộ với** `<html lang>` **và** `document.dir` **(TH/JA/KO/ZH/FR/DE đều LTR — không cần RTL).**
*   **Tích hợp** `**@unhead/vue**` để cập nhật động thẻ `<title>` và `<meta description>` tương ứng với ngôn ngữ đang chọn.

### **2.3 Tailwind & Xử lý hiển thị văn bản dài (Cụm từ)**

*   **Tailwind 4 (CSS-first config qua** `@theme`**) hoặc 3.4 nếu plugin cần ổn định.**
*   **Bảng màu thương hiệu, dark mode** `class`**, animations cho flashcard flip.**
*   **Auto-scaling Typography cho Cụm từ:** Thiết lập lớp CSS tiện ích để khi gặp cụm từ dài (`isPhrase: true` hoặc chuỗi có độ dài ký tự lớn hơn 20), kích thước chữ trên Flashcard tự động giảm dần (`text-4xl` xuống `text-2xl` hoặc `text-xl`) giúp không bị tràn hoặc gãy khung trên giao diện di động.
*   **Font: Inter cho Latin, Noto Sans JP/KR/SC/Thai cho ký tự tương ứng — load qua Google Fonts hoặc self-host.**

### **2.4 Trang Home**

*   **Hai dropdown: Source language / Target language (loại trừ nhau).**
*   **Dropdown chọn chế độ học:** Học "Từ đơn", "Cụm từ & Thành ngữ", hoặc "Trộn cả hai".
*   **Dropdown topic (dịch theo** `uiLocale`**).**
*   **Radio level (A1/A2/B1/B2 + mapping hiển thị).**
*   **Slider count (5–20). Nút "Bắt đầu" gọi** `/api/generate`**.**

### **2.5 Trang Learn / Quiz / Result**

*   **Flashcard flip animation; có nút TTS (**`speechSynthesis` **đọc trôi chảy cả cụm từ dài theo** `source`**).**
*   **Quiz:** Thiết kế danh sách đáp án dạng dọc (Vertical List) thay vì dạng lưới (Grid) khi gặp cụm từ, đảm bảo các cụm từ tiếng Việt hoặc tiếng nước ngoài dài không bị che khuất hoặc xuống dòng xấu xí.
*   **Quiz: 4 lựa chọn random; tô màu sau khi chọn; tổng kết điểm + nút retry.**

### **2.6 Build → assets**

*   `vite.config.ts`**:** `build.outDir = '../assets'`**,** `emptyOutDir = true`**.**
*   **Worker (Static Assets binding) phục vụ SPA, fallback** `index.html`**.**

**Deliverable: chuyển UI giữa 8 ngôn ngữ, học từ đơn và cụm từ EN→JA, JA→VI, ZH→FR thành công.**

## **Phase 3 — Quality, accessibility, hiệu năng (~1 ngày)**

1.  **A11y: ARIA labels (**`role="button"`**,** `aria-live` **cho feedback quiz), focus ring, navigation bàn phím (Enter để flip, 1–4 chọn đáp án).**
2.  **Lighthouse ≥ 95 cả 4 mục — preload font, code-split route, hash filenames (Vite mặc định).**
3.  **Offline cache nhẹ: service worker (Workbox) cache static + last session pairs để học offline.**
4.  **Bảo mật & Rate limiting toàn diện (Chống DDoS / Hacking):** \* Tận dụng tính năng **Workers Rate Limiting API** vừa được cấu hình ở `wrangler.toml`.
    *   Cài đặt middleware trong Hono để tự động check quota trên mỗi request theo IP.
    *   Cấu hình Cloudflare WAF trên dashboard (Rule Block IP nếu nhận quá nhiều HTTP 429).
5.  **Logging:** `console.log` **JSON structured → Workers Logpush hoặc Tail.**
    *   **Cài đặt Webhooks Alert:** Gắn cờ các lỗi `5xx` hoặc lỗi AI liên tục để tự động gửi thông báo qua Discord/Slack.
6.  **Error boundary Vue: trang fallback dịch theo locale.** Bắt lỗi 429 và thông báo "Hệ thống đang xử lý quá nhiều yêu cầu, vui lòng thử lại sau giây lát."
7.  **Web Analytics:** Tích hợp **Cloudflare Web Analytics** (Miễn phí, không dùng cookie, privacy-first) để theo dõi traffic thay vì Google Analytics.

## **Phase 4 — Tài khoản & Đăng nhập Magic Link (~3 ngày)**

### **4.1 Thiết kế Cơ sở dữ liệu D1**

Tạo cấu trúc bảng để quản lý thông tin định danh, trạng thái kích hoạt tài khoản của người dùng, các token đăng nhập ngắn hạn, **và cấu hình động linh hoạt cho toàn bộ hệ thống email xoay vòng trực tiếp từ database**.

*   **Bảng** `**users**`**:**
    
    ```plaintext
    CREATE TABLE users (
        id TEXT PRIMARY KEY,                       -- UUID của user
        email TEXT UNIQUE NOT NULL,                -- Email người dùng
        email_verified BOOLEAN DEFAULT FALSE,      -- Trạng thái xác thực email thật (được set thành TRUE sau khi click Magic Link)
        activated_date TEXT,                       -- Định dạng ISO8601 YYYY-MM-DD HH:MM:SS khi user mở mail kích hoạt lần đầu
        activation_method TEXT,                    -- Phương thức kích hoạt, mặc định là 'open_email' cho Magic Link, 'oauth' cho Google
        created_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Thời gian đăng ký tài khoản ban đầu
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Thời gian cập nhật thông tin mới nhất
        timezone TEXT DEFAULT 'UTC'                -- Múi giờ để phục vụ cron nhắc nhở học tập
    );
    ```
    
*   **Bảng** `**magic_tokens**`**:**
    
    ```plaintext
    CREATE TABLE magic_tokens (
        token_hash TEXT PRIMARY KEY,               -- Hash SHA-256 của login token ngẫu nhiên
        email TEXT NOT NULL,                       -- Email yêu cầu đăng nhập
        expires_at TEXT NOT NULL,                  -- Thời gian hết hạn của token (thường là 15 phút sau khi tạo)
        used BOOLEAN DEFAULT FALSE,                -- Đánh dấu token đã được sử dụng hay chưa để chống replay attack
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    ```
    
*   **\[BỔ SUNG\] Bảng** `**email_providers_config**` **(Lưu thông tin động của các email provider để admin chỉnh sửa trực tiếp trên Cloudflare UI):**
    
    ```plaintext
    CREATE TABLE email_providers_config (
        provider_id TEXT PRIMARY KEY,             -- Mã nhà cung cấp: 'aws_ses', 'postmark', 'sendpulse', 'resend'
        provider_name TEXT NOT NULL,              -- Tên hiển thị trực quan (ví dụ: 'Amazon SES', 'Resend API')
        is_active INTEGER DEFAULT 1,              -- Trạng thái hoạt động: 1 = Active (được tham gia xoay vòng ngẫu nhiên), 0 = Disabled
        weight INTEGER DEFAULT 25,                -- Tỷ lệ phân phối xác suất ngẫu nhiên khi gửi (ví dụ: 25)
        config_json TEXT NOT NULL,                -- Chứa chuỗi JSON cấu hình nhạy cảm (như {"apiKey": "...", "region": "us-east-1", "secret": "..."})
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    ```
    
*   **\[BỔ SUNG\] Bảng** `**system_settings**` **(Cấu hình hệ thống động để quản trị chế độ chọn Provider bằng chuỗi CSV):**
    
    ```plaintext
    CREATE TABLE system_settings (
        key TEXT PRIMARY KEY,                     -- 'force_email_provider'
        value TEXT NOT NULL,                      -- Giá trị CSV (ví dụ: 'aws_ses,postmark,sendpulse' để xoay vòng, hoặc 'postmark' để ép dùng 1 nhà cung cấp)
        description TEXT,                         -- Mô tả cấu hình
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    ```
    

### **4.2 Luồng xử lý Magic Link (Xác thực thực tế)**

1.  **Khởi tạo yêu cầu (**`**POST /api/auth/request**`**):**
    *   Người dùng nhập Email ở Frontend Vue 3 và nhấn nút gửi.
    *   Backend sinh một chuỗi ngẫu nhiên có độ bảo mật cao (cryptographically secure token) dài 32 ký tự: `const rawToken = crypto.randomUUID() + crypto.getRandomValues(...)`.
    *   Backend băm chuỗi này bằng thuật toán SHA-256 làm khóa lưu vào bảng `magic_tokens` nhằm đảm bảo an toàn ngay cả khi database bị rò rỉ. Đặt thời gian hết hạn là 15 phút.
    *   **Cập nhật cấu hình Email Server**
        
        Gửi một Email chứa đường dẫn kích hoạt đến hộp thư người dùng qua hệ thống **Mail Service Adapter** linh hoạt đã cấu hình trong hệ thống (Tự động đọc thông tin cấu hình từ D1 Database để xoay vòng ngẫu nhiên AWS SES, Postmark, SendPulse, Resend, v.v.): `https://vocab-app.pages.dev/auth/verify?token=${rawToken}` (Link trỏ đến SPA Frontend Vue).
        
2.  **Kích hoạt & Đăng nhập (**`**POST /api/auth/verify**`**):**
    *   Khi người dùng mở email và click vào đường dẫn, trình duyệt mở trang `/auth/verify` trên Vue app.
    *   Vue app lấy param `token` trên URL và thực hiện gửi request xác thực về API backend.
    *   Backend lấy `rawToken`, băm SHA-256 rồi truy vấn trong bảng `magic_tokens`:
        *   Kiểm tra xem token có tồn tại không? Đã được sử dụng (`used = true`) chưa? Đã quá hạn so với thời gian thực tại (`expires_at`) chưa?
        *   Nếu không hợp lệ hoặc hết hạn: Trả lỗi chi tiết để Frontend hiển thị thông báo yêu cầu gửi lại link mới.
    *   Nếu token hoàn toàn hợp lệ:
        *   Cập nhật trạng thái token trong DB: `used = true` để tránh việc tái sử dụng link.
        *   Kiểm tra xem người dùng có email này đã tồn tại trong bảng `users` chưa (Upsert logic):
            *   **Trường hợp chưa tồn tại:** Tạo mới bản ghi user với `email_verified = true`, `activated_date = CURRENT_TIMESTAMP`, `activation_method = 'open_email'`.
            *   **Trường hợp đã tồn tại:** Cập nhật thông tin `email_verified = true`, `activated_date = CURRENT_TIMESTAMP` (nếu trước đó chưa được kích hoạt), và đổi `activation_method = 'open_email'`.
        *   Sinh JWT Token (sử dụng `hono/jwt`) chứa payload `user_id`.
        *   Lưu trữ JWT này vào cookie trình duyệt dưới dạng `HttpOnly`, `Secure`, `SameSite=Lax`.

### **4.3 Các API endpoints chi tiết**

*   `POST /api/auth/request` → Nhận JSON `{ email }`, sinh token, lưu DB, gửi email xác thực qua Mail Service Adapter. **(ÁP DỤNG RATE LIMIT SIÊU KHẮT KHE: Dùng binding** `**RATE_LIMITER_AUTH**` **- Tối đa 3 requests/15 phút cho cùng 1 IP hoặc Email. Nếu cố tình spam, trả ngay HTTP 429. Đây là lá chắn sống còn để bảo vệ hệ thống khỏi bị tước API Key gửi mail và chịu phí lớn).**
*   `POST /api/auth/verify` → Nhận JSON `{ token }`. Xác thực token, cập nhật trạng thái người dùng trong DB D1 (`email_verified: true`, `activated_date`, `activation_method: 'open_email'`). Trả về thông tin user + set cookie JWT. **(Cũng áp dụng giới hạn 10 requests / phút để chống brute-force token).**
*   `GET /api/me` → Middleware parse cookie JWT, truy xuất thông tin hồ sơ người dùng hiện tại từ database.
*   `POST /api/logout` → Xóa cookie JWT trên trình duyệt để đăng xuất tài khoản.

### **4.4 Cấu hình Mail Service Adapter (Tích hợp AWS SES, Postmark, SendPulse, Resend)**

Nhằm đảm bảo backend chạy mượt mà trên Cloudflare Workers (môi trường không hỗ trợ các kết nối TCP SMTP truyền thống trừ khi thông qua các thư viện Socket đặc thù), dự án sẽ sử dụng **HTTP REST API** của các nhà cung cấp email thông qua một interface hướng đối tượng (Adapter Pattern) linh hoạt.

*   **Sơ đồ cấu trúc thiết lập Adapter (**`**backend/src/services/mail/**`**):**
    
    ```plaintext
    // interface mô phỏng hành vi gửi mail chung
    export interface EmailProvider {
      sendMail(to: string, subject: string, htmlContent: string, config: any): Promise<boolean>;
    }
    ```
    
*   **Chi tiết triển khai các Provider Adapter:**
    1.  **AWS SES Adapter:** Sử dụng AWS v4 Signature để gọi REST API `https://email.${region}.amazonaws.com/v2/email/outbound-emails` trực tiếp từ Worker (nhanh và bảo mật hơn cài đặt SMTP TCP).
    2.  **Postmark Adapter:** Gửi request đến `https://api.postmarkapp.com/email` sử dụng header `X-Postmark-Server-Token` lấy từ cấu hình database.
    3.  **SendPulse Adapter:** Tự động lấy và cache OAuth2 token từ client\_id/client\_secret trong DB, sau đó gửi request đến `/smtp/emails`.
    4.  **Resend Adapter:** Gửi request đến `https://api.resend.com/emails` sử dụng `Authorization: Bearer` từ cấu hình database.
*   **\[BỔ SUNG\] Giải pháp Quản lý Cấu hình và Tránh Rate-Limit Linh Hoạt Qua Database D1:**
    
    Để tránh việc phải sửa file `.env` hoặc deploy lại Worker mỗi khi thay đổi API Key, cập nhật thêm dịch vụ, hay đổi hạn mức, toàn bộ credentials nhạy cảm và cơ chế kích hoạt được lưu trữ hoàn toàn trong bảng `email_providers_config` của D1. Điều này giúp Admin dễ dàng điều chỉnh cấu hình ngay lập tức thông qua giao diện Cloudflare D1 UI Dashboard mà không bị gián đoạn dịch vụ.
    
    *   **Thuật toán Xoay vòng & Lựa chọn Ngẫu nhiên (Random Dispatcher tích hợp lọc CSV):**
        1.  **Bước 1:** Query bảng `system_settings` để xem giá trị cấu hình `force_email_provider` của Admin. Cấu hình này hỗ trợ định dạng **chuỗi CSV** (ví dụ: `'aws_ses,postmark,sendpulse'`).
            *   Nếu Admin điền nhiều provider, hệ thống sẽ chẻ chuỗi (split by comma) để tạo thành một danh sách (Whitelist). Việc xoay vòng sẽ chỉ diễn ra giới hạn trong danh sách này.
            *   Nếu Admin muốn ép buộc sử dụng duy nhất một dịch vụ, chỉ cần điền tên dịch vụ đó (ví dụ: `'postmark'`).
            *   Nếu giá trị trống, coi như lấy toàn bộ các provider đang active.
        2.  **Bước 2:** Kết hợp danh sách từ Bước 1, backend tiến hành query danh sách các provider đang bật từ bảng `email_providers_config`:
            
            ```plaintext
            -- Lấy toàn bộ danh sách hợp lệ đang kích hoạt
            SELECT * FROM email_providers_config WHERE is_active = 1;
            ```
            
            _(Ở phía backend TS, sử dụng logic Array_ `_.filter()_` _dựa trên mảng whitelist phân tách bằng dấu phẩy từ Bước 1)._
            
        3.  **Bước 3:** Nếu mảng sau khi lọc chỉ có 1 phần tử, backend sử dụng nó ngay lập tức. Nếu có nhiều hơn 1 provider, backend áp dụng thuật toán **Weighted Random Selection (Chọn ngẫu nhiên có trọng số)** dựa trên cột `weight` nhằm phân phối tỉ lệ gửi tối ưu:
            
            ```plaintext
            // Thuật toán ví dụ trong backend:
            // Giả sử mảng activeProviders đã được lọc dựa trên chuỗi CSV của Admin
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
            // Trích xuất cấu hình JSON động
            const config = JSON.parse(selectedProvider.config_json);
            ```
            
        4.  **Cơ chế Tự động Dự phòng (Multi-provider Fallback):** Nếu lựa chọn ngẫu nhiên nhà cung cấp $A$ nhưng trong quá trình gửi gặp lỗi API lỗi hoặc hết hạn ngạch phát sinh từ phía nhà cung cấp, hệ thống tự động loại $A$ ra khỏi danh sách gửi hiện tại, ghi nhận log và tự động thử lại (retry) ngay lập tức bằng cách chọn ngẫu nhiên một nhà cung cấp active khác còn lại để đảm bảo email gửi đi thành công 100%.
*   **Cấu hình môi trường khởi tạo trong D1 DB (Mẫu JSON lưu trữ trong cột** `**config_json**`**):**
    
    ```plaintext
    // Ví dụ record cho 'aws_ses' trong bảng email_providers_config:
    {
      "provider_id": "aws_ses",
      "provider_name": "Amazon SES Service",
      "is_active": 1,
      "weight": 35,
      "config_json": "{\"accessKeyId\":\"AKIA...\",\"secretAccessKey\":\"wJalr...\",\"region\":\"us-east-1\"}"
    }
    
    // Ví dụ record cho 'resend' trong bảng email_providers_config:
    {
      "provider_id": "resend",
      "provider_name": "Resend API Platform",
      "is_active": 1,
      "weight": 25,
      "config_json": "{\"apiKey\":\"re_...\"}"
    }
    ```
    

### **4.5 Lưu dữ liệu bài học**

*   Lưu mỗi cặp đã học vào `learned_pairs(user_id, source, target, source_text, target_text, last_seen, ease, interval, status)`.
    *   **Lưu trữ thuộc tính** `**is_phrase: boolean**` để hệ thống phân loại báo cáo học tập.
    *   **Thêm trường** `**status**` (`learning` | `mastered` | `archived`) để hỗ trợ việc phân loại và thiết lập học lại.

### **4.6 Trải nghiệm trên Frontend**

*   **Màn hình Đăng nhập:** Input nhập email + nút gửi. Khi gửi thành công, chuyển sang màn hình thông báo kiểm tra hòm thư với hiệu ứng minh họa đẹp mắt.
*   **Trang Xác thực (**`**/auth/verify**`**):** Hiển thị màn hình chờ (Spinning Loader) cùng dòng trạng thái "Đang xác thực liên kết đăng nhập của bạn...". Sau khi API xử lý thành công, hiển thị toast chúc mừng và chuyển hướng người dùng thẳng về trang Dashboard để học tập.
*   **Trang cá nhân (**`**/profile**`**):** Hiển thị chi tiết hồ sơ bao gồm trạng thái xác thực (`Verified ✔`), ngày kích hoạt tài khoản (`Activated on: [date]`), phương thức kích hoạt (`Login method: Magic Link`), streak học tập, danh sách từ/cụm từ đã thuộc (Mastered).
*   **GDPR/Data Export:** Thêm nút "Tải xuống dữ liệu của tôi" (Export file CSV/JSON các từ và cụm từ đã học) ở trang Profile để tuân thủ quyền riêng tư và tăng độ tương đương của user.

## **Phase 5 — Spaced Repetition (SM-2) & Tính năng Học lại (~2 ngày)**

1.  **Algorithm SM-2: tham số** `EF`**,** `interval`**,** `repetitions`**.**
    *   Khi người dùng trả lời chính xác liên tiếp đạt một mốc nhất định (ví dụ: `interval >= 30` ngày), từ/cụm từ đó sẽ tự động chuyển sang trạng thái `mastered` (Đã hoàn thành).
2.  **Endpoint** `GET /api/review/today?user=…` **trả danh sách cần ôn (**`next_review <= now()`**).**
3.  **Tính năng Học lại các từ/cụm từ đã xong (Re-learn Mastered Vocab):**
    *   **Endpoint** `POST /api/vocab/reset-status`: Cho phép người dùng reset trạng thái của một từ/cụm từ cụ thể hoặc toàn bộ danh sách `mastered` về lại trạng thái `learning` để bắt đầu lại chu kỳ SM-2 từ đầu.
    *   **Chế độ "Học ôn tập trọn đời" (Lifetime Review Mode):** Người dùng có thể chọn bật tính năng này trên Dashboard. Thay vì ẩn hẳn các từ đã xong (`mastered`), thuật toán SM-2 sẽ tăng `interval` lên mức tối đa (ví dụ: cứ 180 ngày lại xuất hiện một lần để kiểm tra lại phản xạ nhanh).
    *   **Frontend UI:** Trang chuyên biệt `/mastered` hiển thị tất cả từ đơn/cụm từ đã thuộc, đi kèm nút bấm "Học lại từ này" hoặc "Học lại tất cả" kèm hiệu ứng xác nhận trực quan.
4.  **UI Review mode: rating 1–5 sau mỗi câu, cập nhật** `learned_pairs` **qua** `POST /api/review/grade`**.**
5.  **Cron Trigger (Cloudflare) chạy 00:05 daily: gửi email nhắc ôn tập (qua hệ thống xoay vòng Mail Service Adapter động lấy từ database D1) — bao gồm thống kê số lượng từ đơn & cụm từ đã làm chủ.**
    *   **Xử lý Múi giờ (Timezone):** Cron chạy theo giờ UTC. Trong logic Cron Worker, cần query database xem user nào có múi giờ đang là 8:00 AM (hoặc giờ họ cài đặt) thì mới push email, tránh gửi mail lúc nửa đêm của user.

## **Phase 6 — TTS chất lượng cao + nghe & nhập (~2.5 ngày)**

1.  **TTS server-side (chất lượng > Web Speech): Workers AI** `@cf/myshell-ai/melotts` **hỗ trợ đọc trơn tru cả cụm từ cho EN/ZH/FR/JA/KR; ngôn ngữ khác fallback Web Speech.**
    *   **Bảo mật Rate Limit:** Áp dụng `RATE_LIMITER_API` (giới hạn ví dụ: 20 req/phút/IP) cho endpoint `POST /api/tts` để tránh hacker spam tải xuống file âm thanh làm độn chi phí AI & R2.
2.  **Endpoint** `POST /api/tts` **→ trả** `audio/mpeg` **stream, cache R2 theo hash của cụm từ/từ đơn.**
3.  **Bài tập listening: phát audio cụm từ → user gõ lại; chấm bằng Levenshtein + chuẩn hoá diacritics/kana/khoảng trắng giữa các từ.**
4.  **Bài tập typing: gợi ý ký tự đầu của từng từ trong cụm từ, IME-friendly cho JA/KO/ZH/TH.**
5.  **Bài tập Speaking (Pronunciation):** Sử dụng Cloudflare Workers AI model `@cf/openai/whisper` (Speech-to-Text). User thu âm bằng trình duyệt -> gửi file lên Worker -> Whisper chuyển thành text -> so sánh với từ/cụm từ gốc để chấm điểm phát âm cho cả câu.
    *   **Bảo mật Rate Limit:** Tương tự TTS, giới hạn khắt khe số lượng file âm thanh user được đẩy lên phân tích (Ví dụ: 10 lần/phút/IP) để chống Flood Attack vào hạ tầng AI của Cloudflare.

## **Phase 7 — Gamification & social (~2 ngày)**

1.  **Streak, XP, leagues theo tuần (lưu KV/D1).**
2.  **Leaderboard** `GET /api/leaderboard?scope=week|all`**.**
3.  **Achievement badges (ví dụ: "Bậc thầy cụm từ", "Chiến thần học lại"), toast notifications.**
4.  **Share kết quả qua OG image — dùng** `@vercel/og` **chạy được trên Workers.**
    *   **Social Challenge:** Tạo endpoint `GET /api/challenge/:id` để chia sẻ link bài học cho bạn bè. Bạn bè bấm vào link sẽ được giải đúng set 10 từ/cụm từ vựng mà user vừa học để xem ai điểm cao hơn.

## **Phase 8 — Native-feel & deploy (~1.5 ngày)**

1.  **PWA: manifest 8 locale (**`name`**/**`short_name` **theo** `uiLocale`**), icons, install prompt.**
2.  **Capacitor wrapper (tuỳ chọn) cho iOS/Android — vẫn dùng cùng frontend Vue.**
3.  **Sentry (Worker + Vue) cho error tracking.**
4.  **Custom domain + SSL qua Cloudflare; cấu hình Argo Smart Routing nếu cần.**
5.  **Tài liệu** `README.md` **đa ngôn ngữ (EN + VI).**

## **Phase 9 — Test toàn diện & ra mắt (~1 ngày)**

1.  **Unit: Vitest cho services AI/cache, thiết lập reset trạng thái học lại, các case xác thực Magic Link, cấu trúc xoay vòng động của Mail Service Adapter, store Pinia.**
2.  **Integration: Miniflare test 8 cặp ngôn ngữ × 3 level mẫu (bao gồm việc kiểm tra parse cụm từ dài, mock lấy dữ liệu config provider từ D1 & gửi mail xoay vòng).** Kiểm tra module Rate Limiter trả về HTTP 429 chuẩn xác khi bị spam giả lập.
3.  **E2E: Playwright — flow Gửi yêu cầu đăng nhập → Nhấp liên kết Magic Link → Đăng nhập thành công → Home → Learn (Word/Phrase) → Quiz → Result → Reset Mastered → Học lại.**
4.  **Load test:** `k6` **100 RPS endpoint generate (cache hit / miss).** (Kịch bản Test có bypass Rate Limit môi trường test hoặc giả lập nhiều IP để xem độ mượt của Database).
5.  **Checklist a11y (axe-core), Lighthouse ≥ 95, bundle ≤ 250KB gzip.**
6.  **Tag** `v1.0.0`**, deploy production, theo dõi Logpush 48h.**

## **Tổng kết roadmap**

| **Phase** | **Mục đích** | **Thời gian** | **Phụ thuộc** |
| --- | --- | --- | --- |
| **0** | **Bootstrap monorepo, CI, DB Migrations & Config Mail/Rate Limit** | **0.5 - 1d** | **—** |
| **1** | **Backend i18n + AI Từ & Cụm từ (có Fallback & Chống lạm dụng)** | **2.5d** | **0** |
| **2** | **Vue 3 + Tailwind (Auto-scale Text) + i18n + Xử lý lỗi 429 UI** | **2d** | **1** |
| **3** | **A11y, perf, rate limit, Analytics, Alert** | **1d** | **2** |
| **4** | **Hệ thống Magic Link Auth + Đa dạng hóa Mail Server Adapter xoay vòng (hỗ trợ CSV filter + Anti Spam Email Bombing)** | **3d** | **3** |
| **5** | **SM-2 review + Reset & Học lại + Timezone Cron** | **2d** | **4** |
| **6** | **TTS server + listening + STT Speaking (Cụm từ, bảo vệ bởi Rate Limit)** | **2.5d** | **5** |
| **7** | **Gamification + Social Challenge** | **2d** | **4** |
| **8** | **PWA + deploy** | **1.5d** | **7** |
| **9** | **QA toàn diện** | **1d** | **8** |
| **Tổng** |     | **~ 16 - 18 ngày** |     |
