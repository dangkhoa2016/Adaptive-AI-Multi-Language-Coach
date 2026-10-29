# Adaptive AI Multi-Language Coach

[English](README.md)

Monorepo pnpm gồm Vue 3 SPA, API Hono trên Cloudflare Workers, D1, cache KV và định nghĩa locale TypeScript dùng chung. Mã nguồn có sinh từ vựng, flashcard, quiz, ôn tập ngắt quãng, xác thực magic-link, settings admin và route TTS/STT. Việc có mã nguồn không chứng minh đã nghiệm thu production hay AI thật.

## Trạng thái kiểm chứng hiện tại

Vòng khôi phục ngày 2026-10-29 bắt đầu từ `42f0d7d9cc261f83e627f112f976c34d2c3b7ddf` trên nhánh `recovery/adaptive-coach-production-hardening-2026-10-29`.

- **M0: FAIL**. Đã cài Chromium cùng thư viện hệ thống và chạy browser tests: cả luồng xác thực và luồng học đều thất bại tại kiểm tra trạng thái thành công. Chưa bắt đầu M1 theo điểm dừng bắt buộc trong kế hoạch hardening.
- Vitest mới: **165 test backend + 160 test frontend PASS**. Coverage dòng: backend **89.82%**, frontend **52.79%**. Test auth/mail/AI dùng mock; test Workers còn chạy D1/KV local.
- Cài đặt frozen lockfile, typecheck, lint và build PASS. Lint còn 65 cảnh báo có sẵn; build có cảnh báo chia chunk locale.
- Mười hai migration D1 mới, nâng cấp legacy giả lập local, kiểm tra integrity và khôi phục snapshot độc lập PASS. Lịch sử remote chưa rõ và khác biệt schema fresh/legacy vẫn cần review.
- Dependency audit còn lỗ hổng ở cả thư viện runtime và công cụ phát triển. Auth, xử lý secrets admin, tính nguyên tử khi ôn tập và giới hạn API cần test hồi quy ở M1. Chưa đủ điều kiện khẳng định sẵn sàng production.
- Deploy bị vô hiệu. Không push, sửa DB remote, gửi mail thật hay gọi AI tính phí. Chưa chạy M2–M4.

Gói evidence bên ngoài repo chứa timestamp/exit code lệnh, coverage mới, kiểm kê migration, phát hiện bảo mật từ mã nguồn và log E2E thất bại. Không chia sẻ archive mã nguồn gốc hay backup riêng tư vì chứa Git và dữ liệu secret local. Cần thu hồi/rotate GitHub credential đã được nêu trong báo cáo che giá trị.

## Thiết lập local

Dùng **Node 22.22.3** và **pnpm 11.1.3**. Xem [thiết lập và kiểm chứng local](docs/DEV-SETUP.vi.md) để biết cách cô lập DB dùng một lần, cài browser và giới hạn xác thực hiện tại.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @vocab/backend setup:local
pnpm --filter @vocab/frontend build
pnpm --filter @vocab/backend db:migrate:local
pnpm --filter @vocab/backend db:seed:local
```

Chạy `pnpm dev:backend` và `pnpm dev:frontend` ở hai terminal. SPA dùng cổng 5173 và chuyển `/api` tới cổng 8787. Script tạo config giữ nguyên config và secrets hiện có. Config sinh ra chỉ dùng local, không bật Workers AI remote.

## Cấu trúc và kiểm tra

| Đường dẫn                        | Mục đích                                                                  |
| -------------------------------- | ------------------------------------------------------------------------- |
| `backend/src/`                   | Route Hono, auth, settings, review, dịch vụ AI/audio                      |
| `backend/migrations/`            | Migration tiến về trước; bảo toàn identity lịch sử                        |
| `backend/wrangler.template.toml` | Template triển khai cần chủ dự án review                                  |
| `frontend/src/`                  | View Vue, store, composable, API client                                   |
| `frontend/e2e/`                  | Browser test Playwright, tách khỏi Vitest                                 |
| `packages/shared/src/`           | Kiểu dùng chung và tám locale                                             |
| `assets/`                        | Kết quả build frontend được Git bỏ qua, Worker phục vụ qua assets binding |
| `idea-and-plan/`                 | Lộ trình sản phẩm lịch sử; không phải evidence kiểm chứng                 |

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm -r build
pnpm --filter @vocab/frontend test:e2e
```

CI chạy typecheck, lint, định dạng, Vitest và build. E2E có lệnh local riêng, hiện chưa qua gate review. Workflow deploy chỉ kích hoạt thủ công, phụ thuộc CI chất lượng dùng lại; job deploy bị vô hiệu trong khi chờ chủ dự án phê duyệt và cấu hình môi trường.
