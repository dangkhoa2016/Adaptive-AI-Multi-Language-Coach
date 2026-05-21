# Adaptive AI Multi-Language Coach

> 🌐 Language / Ngôn ngữ: [English](README.md) | **Tiếng Việt**

Bộ monorepo full-stack mang đến trải nghiệm học ngôn ngữ tích hợp AI — flashcard lặp lại ngắt quãng, từ vựng sinh bởi AI, luyện nghe/nói TTS/STT, xác thực qua magic-link, và gamification — tất cả chạy serverlessly trên mạng edge của Cloudflare.

Tài liệu kế hoạch chi tiết nằm ở [`idea-and-plan/`](./idea-and-plan/) (`plan.md` bằng tiếng Anh lẫn tiếng Việt / `plan.vi.md` bằng tiếng Việt thuần).

## Tính năng

### Đã triển khai

- **pnpm monorepo** với 3 workspace (`backend`, `frontend`, `packages/shared`)
- **Hono API** trên Cloudflare Workers kèm middleware i18n (`Accept-Language` / `?lang=`)
- **Vue 3 SPA** với bộ chọn ngôn ngữ, Pinia lưu trạng thái, vue-i18n
- **8 ngôn ngữ hỗ trợ**: `en`, `vi`, `ja`, `ko`, `th`, `zh`, `fr`, `de`
- **Schema D1** sẵn sàng cho xác thực, lặp lại ngắt quãng SM-2, và xoay nhà cung cấp email
- **CI/CD** — kiểm tra chất lượng trên PR, tự động deploy khi push lên `main`

### Dự kiến (xem [lộ trình](#l-trnh))

- Sinh từ vựng/cụm từ bằng AI kèm cache KV & fallback
- Flashcard, quiz, và trang kết quả với văn bản tự co giãn
- Xác thực magic-link với xoay nhà cung cấp email (SES, Postmark, SendPulse, Resend)
- Thuật toán lặp lại ngắt quãng SM-2 với cron ôn tập hàng ngày
- Luyện nghe TTS (MeloTTS) & luyện nói Whisper STT
- Gamification (chuỗi ngày, XP, giải đấu, bảng xếp hạng, huy hiệu)
- PWA + Capacitor cho mobile

## Công nghệ

| Tầng           | Công nghệ                                                              |
| -------------- | ---------------------------------------------------------------------- |
| **Runtime**    | Cloudflare Workers (Hono + TypeScript)                                 |
| **Lưu trữ**    | D1 (SQLite), KV (cache), Workers AI bindings                           |
| **Frontend**   | Vue 3 + Vite + Tailwind 4 + Pinia + vue-i18n@11 + Vue Router 5         |
| **Validation** | Zod                                                                    |
| **Testing**    | Vitest + `@cloudflare/vitest-pool-workers`                             |
| **Tooling**    | pnpm workspaces, ESLint 9 (flat config), Prettier, Husky + lint-staged |
| **CI/CD**      | GitHub Actions (typecheck, lint, format, test, build, deploy)          |

## Cấu trúc thư mục

```
.
├── backend/                    # Cloudflare Worker (Hono API + D1 migrations)
│   ├── src/
│   │   ├── index.ts            # Entry Hono, middleware, routes
│   │   └── env.ts              # Định nghĩa bindings & biến môi trường
│   ├── migrations/
│   │   └── 0001_init.sql       # Schema D1 ban đầu (5 bảng)
│   ├── test/
│   │   └── health.test.ts      # Test Vitest
│   ├── wrangler.toml           # Config production & bindings
│   └── package.json            # @vocab/backend
│
├── frontend/                   # Vue 3 SPA (build ra ../assets, được Worker phục vụ)
│   ├── src/
│   │   ├── main.ts             # Khởi tạo (Pinia + Router + i18n)
│   │   ├── App.vue             # Component gốc
│   │   ├── router/             # Cấu hình Vue Router
│   │   ├── stores/             # Pinia stores (prefs)
│   │   ├── i18n/               # Cấu hình vue-i18n + messages
│   │   ├── views/              # Component trang (HomeView)
│   │   └── styles/             # Entry Tailwind CSS
│   ├── vite.config.ts          # Output ra ../assets, proxy API tới :8787
│   ├── tailwind.config.ts      # Tailwind v4, dark mode, font CJK
│   └── package.json            # @vocab/frontend
│
├── packages/shared/            # @vocab/shared — hằng số ngôn ngữ, shared types
│   └── src/
│       ├── index.ts            # Re-exports
│       └── locales.ts          # SUPPORTED_LOCALES, kiểu Locale, resolveLocale()
│
├── assets/                     # Output frontend sau build (ASSETS binding phục vụ)
├── .github/workflows/
│   ├── ci.yml                  # Kiểm tra chất lượng trên PR
│   └── deploy.yml              # Deploy lên Cloudflare Workers
└── idea-and-plan/              # Kế hoạch sản phẩm
    ├── plan.md                 # Tiếng Anh lẫn tiếng Việt
    └── plan.vi.md              # Tiếng Việt thuần
```

## Bắt đầu

### Yêu cầu

- **Node.js >= 20.11** (xem `.nvmrc`)
- **pnpm** (packageManager ghim trong `package.json`)
- **Wrangler CLI** (`pnpm add -g wrangler`)

### Phát triển

```bash
# 1. Cài đặt tất cả workspace
pnpm install

# 2. Áp dụng D1 migrations cục bộ
pnpm --filter @vocab/backend db:migrate:local

# 3. Khởi chạy backend (Wrangler dev trên :8787)
pnpm dev:backend

# 4. Ở terminal khác, khởi chạy frontend (Vite trên :5173, proxy /api tới :8787)
pnpm dev:frontend
```

### Kiểm tra chất lượng

```bash
# Giống CI: typecheck + lint + kiểm tra format + test + build
pnpm typecheck && pnpm lint && pnpm test && pnpm -r build
```

### Danh sách lệnh

| Lệnh                | Mô tả                           |
| ------------------- | ------------------------------- |
| `pnpm dev:backend`  | Chạy backend với `wrangler dev` |
| `pnpm dev:frontend` | Chạy frontend với `vite`        |
| `pnpm build`        | Build tất cả workspace          |
| `pnpm test`         | Chạy tất cả test                |
| `pnpm typecheck`    | Kiểm tra kiểu tất cả workspace  |
| `pnpm lint`         | Chạy ESLint                     |
| `pnpm lint:fix`     | Chạy ESLint với `--fix`         |
| `pnpm format`       | Chạy Prettier (ghi đè)          |
| `pnpm format:check` | Chạy Prettier (kiểm tra)        |

Cho backend:

| Lệnh                                              | Mô tả                               |
| ------------------------------------------------- | ----------------------------------- |
| `pnpm --filter @vocab/backend dev`                | Wrangler dev                        |
| `pnpm --filter @vocab/backend test`               | Vitest run                          |
| `pnpm --filter @vocab/backend test:watch`         | Vitest watch                        |
| `pnpm --filter @vocab/backend db:migrate:local`   | Áp dụng D1 migrations cục bộ        |
| `pnpm --filter @vocab/backend db:migrate:remote`  | Áp dụng D1 migrations lên DB remote |
| `pnpm --filter @vocab/backend db:migrations:list` | Liệt kê migrations chưa áp dụng     |
| `pnpm --filter @vocab/backend deploy`             | `wrangler deploy`                   |

Cho frontend:

| Lệnh                                    | Mô tả                            |
| --------------------------------------- | -------------------------------- |
| `pnpm --filter @vocab/frontend dev`     | Vite dev server                  |
| `pnpm --filter @vocab/frontend build`   | `vue-tsc --noEmit && vite build` |
| `pnpm --filter @vocab/frontend preview` | Vite preview                     |

## Schema cơ sở dữ liệu

Schema D1 (`backend/migrations/0001_init.sql`) định nghĩa 5 bảng:

| Bảng                     | Mục đích                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `users`                  | Tài khoản người dùng (email, xác thực, múi giờ)                                       |
| `magic_tokens`           | Token magic-link mã SHA-256 kèm thời hạn                                              |
| `learned_pairs`          | Từ vựng/cụm từ với các trường SM-2 (ease, interval, repetitions, next_review, status) |
| `email_providers_config` | Cấu hình xoay nhà cung cấp email với chọn ngẫu nhiên theo trọng số                    |
| `system_settings`        | Kho key-value cho cài đặt runtime (vd: `force_email_provider`)                        |

## API Endpoints

| Method | Path           | Mô tả                              |
| ------ | -------------- | ---------------------------------- |
| `GET`  | `/`            | Tin nhắn chào mừng                 |
| `GET`  | `/health`      | Kiểm tra sức khỏe `{ ok, ts }`     |
| `GET`  | `/api/locales` | Liệt kê 8 ngôn ngữ hỗ trợ kèm nhãn |

Tất cả route `/api/*` bao gồm:

- **CORS** headers
- **Middleware i18n** — phân giải ngôn ngữ từ header `Accept-Language` hoặc tham số `?lang=`, đặt header phản hồi `Content-Language`

## Cloudflare Bindings

`backend/wrangler.toml` khai báo:

| Binding             | Mục đích                                                |
| ------------------- | ------------------------------------------------------- |
| `ASSETS`            | Static assets (Vue SPA build vào `../assets`)           |
| `AI`                | Workers AI (LLM, Whisper, MeloTTS)                      |
| `CACHE`             | KV namespace để cache phản hồi sinh AI (TTL 24h)        |
| `DB`                | D1 SQLite database (users, magic tokens, learned pairs) |
| `RATE_LIMITER_API`  | 10 req / 60s — AI endpoints                             |
| `RATE_LIMITER_AUTH` | 3 req / 15 phút — magic-link request / verify           |

> **Trước khi deploy**, thay các `id` placeholder trong `wrangler.toml` bằng ID thật từ `wrangler kv namespace create` / `wrangler d1 create`.

## Secrets

Secret dev cục bộ nằm ở `backend/.dev.vars` (đã gitignore). Copy từ [`backend/.dev.vars.example`](./backend/.dev.vars.example):

```bash
cp backend/.dev.vars.example backend/.dev.vars
```

Secret production được cài qua Wrangler:

```bash
pnpm --filter @vocab/backend exec wrangler secret put <NAME>
```

Các secret dự kiến: `JWT_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `POSTMARK_SERVER_TOKEN`, `SENDPULSE_CLIENT_ID`, `SENDPULSE_CLIENT_SECRET`, `RESEND_API_KEY`.

## CI/CD

### `ci.yml` — Cổng kiểm tra chất lượng

Chạy khi push lên `main` và khi tạo PR:

1. `pnpm install` (frozen lockfile)
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm format:check`
5. `pnpm test`
6. `pnpm -r build`

### `deploy.yml` — Deploy

- **Push lên `main`**: `wrangler deploy` (production)
- **PR**: `wrangler deploy --env preview --name ai-vocab-app-pr-<number>` (preview deployment)

Yêu cầu GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Lộ trình

| Phase | Mục tiêu                                                                           | Trạng thái                  |
| ----- | ---------------------------------------------------------------------------------- | --------------------------- |
| **0** | Bootstrap monorepo, CI, DB migrations, Wrangler config, linting                    | **Hoàn thành**              |
| **1** | Backend i18n, API sinh từ vựng/cụm từ bằng AI với cache, fallback, rate limiting   | Dự kiến                     |
| **2** | Vue 3 SPA — flashcard/quiz/kết quả, văn bản tự co giãn, i18n 8 ngôn ngữ            | **Một phần** (chỉ HomeView) |
| **3** | A11y, Lighthouse 95+, offline cache, WAF, error boundaries, analytics              | Dự kiến                     |
| **4** | Xác thực magic-link (token SHA-256, JWT cookies), multi-provider email adapter     | Dự kiến                     |
| **5** | Thuật toán lặp lại ngắt quãng SM-2, cron ôn tập hàng ngày, reset/từ vựng học lại   | Dự kiến                     |
| **6** | Server TTS (MeloTTS), luyện nghe & luyện nói (Whisper STT)                         | Dự kiến                     |
| **7** | Gamification — chuỗi ngày, XP, giải đấu, bảng xếp hạng, huy hiệu, thử thách xã hội | Dự kiến                     |
| **8** | PWA manifest (8 ngôn ngữ), Capacitor wrapper, Sentry, custom domain                | Dự kiến                     |
| **9** | QA toàn diện — Vitest unit, Miniflare integration, Playwright E2E, k6 load testing | Dự kiến                     |
