# Hướng dẫn Dev — Chạy Local

## 1. Yêu cầu

- **Node.js >= 20.11** (xem `.nvmrc`)
- **pnpm** (bản trong `package.json`)
- **Wrangler CLI** (đã bundle trong `devDependencies` của backend)

```bash
node --version   # >= 20.11
pnpm --version   # 11.x
```

## 2. Cài đặt dependencies

```bash
git clone <repo-url>
cd adaptive-ai-multi-language-coach
pnpm install
```

## 3. Cấu hình wrangler.toml

Đã có sẵn `backend/wrangler.toml` cấu hình cho local dev. Kiểm tra lại:

```toml
name = "ai-vocab-app-dev"
main = "src/index.ts"
compatibility_date = "2026-05-20"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "../assets"
binding = "ASSETS"

[dev]
port = 8787

[[kv_namespaces]]
binding = "CACHE"
id = "dev-cache"
preview_id = "dev-cache-preview"

[[d1_databases]]
binding = "DB"
database_name = "ai_vocab_db"
database_id = "dev-db"
migrations_dir = "migrations"

[[ratelimits]]
name = "RATE_LIMITER_API"
namespace_id = "1001"
simple = { limit = 100, period = 60 }

[[ratelimits]]
name = "RATE_LIMITER_AUTH"
namespace_id = "1002"
simple = { limit = 10, period = 60 }
```

> **Lưu ý**: `database_name = "ai_vocab_db"` phải khớp với tên DB trong script `db:migrate:local` ở `backend/package.json`.

## 4. Tạo file .dev.vars

Đã có sẵn `backend/.dev.vars`:

```
ENCRYPTION_KEY = "development-encryption-key-not-for-production"
JWT_SECRET = "development-jwt-secret-not-for-production"
```

## 5. Migrate D1 database

```bash
pnpm --filter @vocab/backend db:migrate:local
```

Lệnh này chạy toàn bộ migration trong `backend/migrations/` (0012_audit_log.sql). Output thành công sẽ hiển thị tất cả migrations với ✅.

## 6. Seed dữ liệu

### Seed topics & fallback pairs

```bash
pnpm --filter @vocab/backend db:seed:local
```

### Seed admin user

```bash
pnpm --filter @vocab/backend exec wrangler d1 execute ai_vocab_db --local \
  --file=seed/0002_test_users.sql
```

Kết quả: thêm 2 user:
| Email | Role |
|-------------------|---------|
| admin@test.com | admin |
| user@test.com | user |

### Seed app settings (tuỳ chọn)

Xem `backend/scripts/README-settings.md`.

## 7. Chạy dev

### Backend (cổng 8787)

```bash
pnpm dev:backend
```

### Frontend (cổng 5173)

Mở terminal khác:

```bash
pnpm dev:frontend
```

> Frontend dev server tự động proxy `/api` về `http://127.0.0.1:8787`.

Mở trình duyệt: `http://localhost:5173`

## 8. Đăng nhập Admin (Magic Link)

Hệ thống dùng **magic link**, không có mật khẩu.

### Cách 1 — Qua console log

Đảm bảo backend đang chạy (`pnpm dev:backend`), sau đó từ terminal khác:

```bash
curl -X POST http://localhost:8787/api/auth/request \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com"}'
```

Kiểm tra terminal chạy backend — sẽ thấy dòng log chứa token, ví dụ:

```
[LOG] Magic link for admin@test.com: http://localhost:5173/auth/verify?token=xxxx-xxxx-xxxx
```

Copy URL đó và mở trong trình duyệt.

### Cách 2 — Tạo token thủ công trong D1

Chạy lệnh sau để tạo token 15 phút trực tiếp trong database:

```bash
pnpm --filter @vocab/backend exec wrangler d1 execute ai_vocab_db --local \
  --command="INSERT INTO magic_tokens (id, email, token_hash, expires_at) VALUES ('dev-' || lower(hex(randomblob(16))), 'admin@test.com', lower(hex(randomblob(32))), datetime('now', '+15 minutes'));

SELECT 'MAGIC_TOKEN=' || id FROM magic_tokens WHERE email = 'admin@test.com' ORDER BY created_at DESC LIMIT 1;"
```

Output sẽ có dạng: `MAGIC_TOKEN=dev-<hex>`

Mở trình duyệt: `http://localhost:5173/auth/verify?token=dev-<hex>`

Sau khi verify thành công, bạn sẽ được redirect về trang chủ với quyền admin.

## 9. Kiểm tra

```bash
# Typecheck
pnpm typecheck

# Lint
pnpm lint

# Test
pnpm test
```

## Xử lý lỗi thường gặp

| Vấn đề                                              | Nguyên nhân                                      | Giải pháp                                                                                |
| --------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `Couldn't find a D1 DB with the name 'ai_vocab_db'` | `database_name` trong `wrangler.toml` không khớp | Kiểm tra `wrangler.toml`, tên DB phải là `ai_vocab_db`                                   |
| `Unexpected fields found in dev field: "local"`     | `dev.local = true` không được hỗ trợ             | Xoá dòng `local = true` khỏi `[dev]`                                                     |
| `process is not defined` / `console is not defined` | File `.js` ngoài phạm vi ESLint                  | Dùng `--no-verify` khi commit, hoặc thêm file vào `files` glob trong `eslint.config.mjs` |
| Port 8787 đã được dùng                              | Có tiến trình khác đang chiếm port               | `lsof -ti :8787 \| xargs kill` hoặc `npx kill-port 8787`                                 |
