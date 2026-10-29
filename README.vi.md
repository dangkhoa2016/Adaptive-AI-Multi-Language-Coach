# Adaptive AI Multi-Language Coach

[English](README.md)

Monorepo pnpm gồm Vue 3 SPA, API Hono trên Cloudflare Workers, D1, cache KV và định nghĩa locale TypeScript dùng chung. Mã nguồn có sinh từ vựng, flashcard, quiz, ôn tập ngắt quãng, xác thực magic-link, settings admin và route TTS/STT. Việc có mã nguồn không chứng minh đã nghiệm thu production hay AI thật.

## Trạng thái kiểm chứng hiện tại

Vòng đóng M0 tiếp tục trên nhánh `recovery/adaptive-coach-production-hardening-2026-10-29`, từ baseline gốc `42f0d7d9cc261f83e627f112f976c34d2c3b7ddf` và HEAD review đầu `488121f4384bfa8a0738a871ff112ac9e20b0f6a`.

JSON auth chỉ serialize một lần; limiter chỉ áp dụng đúng các route POST; fallback chỉ trả cặp có nhãn ngôn ngữ rõ ràng. Đã đổi namespace cache để loại dữ liệu fallback cũ có thể sai ngôn ngữ. Browser test yêu cầu magic-link và luồng học hiện PASS qua HTTP Worker/D1/KV thật, có kiểm tra vượt quota, mail tổng hợp được bắt local và fixture en→vi. Điều này chưa chứng minh toàn bộ hành trình đăng nhập/lưu từ/ôn tập an toàn hoặc mail/AI thật.

**M0 chưa được nghiệm thu**: còn advisory công cụ phát triển cần chủ dự án quyết định và chưa xác minh việc rotate credential đã lộ. M1–M4 vẫn NOT_RUN. Kết quả mới, coverage, các lần thử thất bại, quyết định dependency và lệnh chạy trên commit cuối thực tế nằm trong gói evidence đóng M0 bên ngoài repo. Các phần trăm coverage cũ thuộc báo cáo vòng đầu, không dùng lại làm kết quả hiện tại.

Deploy tiếp tục bị vô hiệu. Vòng này không cho phép push, đọc/ghi DB remote, mail thật, inference tính phí hoặc truy cập dữ liệu production. Giữ kín ZIP gốc/backup riêng tư và rotate GitHub credential đã lộ.

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

| Đường dẫn                        | Mục đích                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `backend/src/`                   | Route Hono, auth, settings, review, dịch vụ AI/audio                           |
| `backend/migrations/`            | Migration tiến về trước; bảo toàn identity lịch sử                             |
| `backend/wrangler.template.toml` | Template triển khai cần chủ dự án review                                       |
| `frontend/src/`                  | View Vue, store, composable, API client                                        |
| `frontend/e2e/`                  | Browser test Playwright và driver toàn hệ thống dùng một lần, tách khỏi Vitest |
| `packages/shared/src/`           | Kiểu dùng chung và tám locale                                                  |
| `assets/`                        | Kết quả build frontend được Git bỏ qua, Worker phục vụ qua assets binding      |
| `idea-and-plan/`                 | Lộ trình sản phẩm lịch sử; không phải evidence kiểm chứng                      |

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm -r build
pnpm --filter @vocab/frontend test:e2e
```

CI chạy typecheck, lint, định dạng, Vitest và build. E2E có lệnh riêng tự khởi động backend dùng một lần và frontend, cần Chromium cùng thư viện hệ thống. Workflow deploy chỉ kích hoạt thủ công, phụ thuộc CI chất lượng dùng lại; job deploy bị vô hiệu trong khi chờ chủ dự án phê duyệt và cấu hình môi trường.

## Kiến trúc và API

Browser → API client Vue → proxy `/api` của Vite khi phát triển hoặc Worker khi triển khai → route Hono → D1/KV. Frontend build vào `assets/` ở root, được phục vụ qua `ASSETS`. Backend chọn locale bằng `Accept-Language` hoặc `?lang=`, hỗ trợ tám locale en, vi, ja, ko, th, zh, fr, de. Locale giao diện không đồng nghĩa chất lượng AI/audio đã được kiểm chứng cho từng ngôn ngữ.

Sinh từ vựng đọc model/endpoint và cấu hình API key mã hóa trong D1, chỉ gọi nhà cung cấp HTTP khi có key, sau đó dùng fallback có nhãn ngôn ngữ phù hợp. Khóa KV gồm ngôn ngữ, chủ đề, cấp độ, số lượng, chế độ và ngày. Route audio dùng Workers AI qua `AI`; config local không bật binding remote có thể tính phí này.

| Nhóm API           | Endpoint chính                                                                       | Ranh giới hiện tại                                              |
| ------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Metadata công khai | `/health`, `/api/locales`, `/api/topics`, `/api/docs`                                | Không trừ quota AI/auth                                         |
| Học tập            | POST `/api/generate`, `/api/quiz`, `/api/tts`, `/api/stt`                            | Chung limiter API native; giữ hành vi guest                     |
| Xác thực           | POST `/api/auth/request`, `/api/auth/verify`, `/api/auth/logout`; GET `/api/auth/me` | Limiter cho POST auth; me cần session; còn hardening bảo mật    |
| Từ vựng/ôn tập     | `/api/vocab/*`, `/api/review/*`                                                      | Cần session; nghiệm thu nguyên tử/đồng thời/phân quyền thuộc M1 |
| Quản trị           | `/api/admin/*`                                                                       | Có kiểm tra auth/admin trong mã; sửa lộ secrets thuộc M1        |

Các bảng D1 gồm user, magic token đã hash, từ đã học, cấu hình nhà cung cấp email, settings hệ thống, chủ đề, fallback, lịch sử nội dung AI, lựa chọn model AI, lịch sử ôn tập, sự kiện vượt quota và audit. Bảo toàn mười hai migration lịch sử. Main local và recovery khác identity 0003/0004; legacy còn `mastered_at` và index mà DB mới không có. Migration 0009 chủ động xóa bốn key settings. Xem tài liệu setup về giới hạn backup/diễn tập.

## Cấu hình và bảo mật

| Binding             | Mục đích                                                           |
| ------------------- | ------------------------------------------------------------------ |
| `ASSETS`            | Tệp Vue đã build                                                   |
| `DB`                | Lưu trữ quan hệ D1                                                 |
| `CACHE`             | Cache KV cho cặp từ, khóa theo phiên bản/ngày, TTL 24 giờ          |
| `RATE_LIMITER_API`  | 10 POST học tập mỗi 60 giây trong template/driver local            |
| `RATE_LIMITER_AUTH` | 3 POST auth mỗi 60 giây trong template/driver local                |
| `AI`                | Binding audio Workers AI cho triển khai; generator local không bật |

`JWT_SECRET` và `ENCRYPTION_KEY` là Worker secrets; `.dev.vars` local được Git bỏ qua, chứa giá trị tổng hợp từ setup hoặc giữ nguyên file có sẵn. Không dùng giá trị mẫu cho staging/production. Nhà cung cấp mail và settings sinh từ nằm trong D1; xử lý response/audit admin vẫn còn phát hiện M1. Mã còn rủi ro log token, Origin, replay và cập nhật review không nguyên tử. Kiểm tra role, helper mã hóa hoặc unit test PASS chưa chứng minh các lỗi này đã được xử lý.

## Fixture browser và vận hành

Cài Chromium/thư viện hệ thống bằng `pnpm --filter @vocab/frontend exec playwright install --with-deps chromium`, rồi chạy `pnpm --filter @vocab/frontend test:e2e`. Dừng dịch vụ đang dùng cổng 5173/8787/8788 trước: driver không tái sử dụng server, tạo D1/KV mới trong RAM, áp dụng migration/seed được theo dõi, chỉ bắt request Resend tổng hợp và chặn outbound khác. Driver không đọc `.dev.vars`, DB remote hay key nhà cung cấp thật. Kết quả Playwright máy đọc được có annotation HTTP status; không xuất nội dung mail, magic token hay cookie.

Phát hành thật cần chủ dự án phê duyệt, cấu hình môi trường và lịch sử migration riêng tư, xử lý/chấp nhận rủi ro bảo mật, nghiệm thu M1, diễn tập staging/restore và các bước M2–M4 sau đó. Vòng này chưa nghiệm thu deploy hay rollback remote. Chất lượng ngôn ngữ audio đầy đủ, accessibility, offline/mobile và gamification mở rộng còn chưa được kiểm chứng hoặc thuộc tương lai; roadmap lịch sử ở `idea-and-plan/`.
