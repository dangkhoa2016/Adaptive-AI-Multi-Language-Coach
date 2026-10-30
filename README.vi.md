# Adaptive AI Multi-Language Coach

[English](README.md)

Monorepo pnpm gồm Vue 3 SPA, API Hono trên Cloudflare Workers, D1, cache KV và định nghĩa locale TypeScript dùng chung. Mã nguồn có sinh từ vựng, flashcard, quiz, ôn tập ngắt quãng, xác thực magic-link, settings admin và route TTS/STT. Việc có mã nguồn không chứng minh đã nghiệm thu production hay AI thật.

## Trạng thái kiểm chứng hiện tại

M1 hardening tiếp tục theo yêu cầu chủ dự án trên `recovery/adaptive-coach-production-hardening-2026-10-29`, từ HEAD dependency M0 `be1417bf8dc94f9bfc9f0eb87c44383e9eee6b8e`. M0 đã qua gate kỹ thuật; nghiệm thu vẫn là quyết định riêng của chủ dự án. Credential verification tiếp tục được bỏ qua theo yêu cầu.

M1 bổ sung origin/CSRF tin cậy, token một lần chống race, thu hồi session, settings admin chỉ metadata và secret mã hóa, review nguyên tử với version/idempotency, quota D1 bền vững, giới hạn payload/provider và cache tách theo cấu hình model. Browser fixture chạy đăng nhập→sinh ENVI→lưu từ→chấm ôn tập qua Vue/Worker/D1/KV thật, chỉ dùng mail tổng hợp trong RAM. Kết quả gate trên commit cuối và các lần thử thất bại nằm trong evidence M1 bên ngoài repo; không dùng lại coverage cũ.

M2–M4 chưa chạy. Deploy vẫn bị vô hiệu; không push, đọc/ghi DB remote, gửi mail thật hay gọi inference tính phí. Không coi kiểm thử local là nghiệm thu production hoặc chất lượng ngôn ngữ AI/audio. Dependency giữ plugin Cloudflare1.4.8/esbuild0.28.2 từ vòng sửa advisory, không che audit. Không công bố ZIP/backup có credential; tình trạng rotate chưa xác minh.

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

CI chạy typecheck, lint, định dạng, Vitest, regression provider trên runtime native và build. E2E có lệnh riêng tự khởi động backend dùng một lần và frontend, cần Chromium cùng thư viện hệ thống. Workflow deploy chỉ kích hoạt thủ công, phụ thuộc CI chất lượng dùng lại; job deploy bị vô hiệu trong khi chờ chủ dự án phê duyệt và cấu hình môi trường.

## Kiến trúc và API

Browser → API client Vue → proxy `/api` của Vite khi phát triển hoặc Worker khi triển khai → route Hono → D1/KV. Frontend build vào `assets/` ở root, được phục vụ qua `ASSETS`. Backend chọn locale bằng `Accept-Language` hoặc `?lang=`, hỗ trợ tám locale en, vi, ja, ko, th, zh, fr, de. Locale giao diện không đồng nghĩa chất lượng AI/audio đã được kiểm chứng cho từng ngôn ngữ.

Sinh từ vựng đọc model/endpoint và cấu hình API key mã hóa trong D1, chỉ gọi nhà cung cấp HTTP khi có key, sau đó dùng fallback có nhãn ngôn ngữ phù hợp. Khóa KV v3 gồm ngôn ngữ, chủ đề, cấp độ, số lượng, chế độ, ngày và hash snapshot endpoint/model/options; cache giữ nhãn fallback. Route audio dùng Workers AI qua `AI`; config local không bật binding remote có thể tính phí này.

| Nhóm API           | Endpoint chính                                                                       | Ranh giới hiện tại                                         |
| ------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Metadata công khai | `/health`, `/api/locales`, `/api/topics`, `/api/docs`                                | Không trừ quota AI/auth                                    |
| Học tập            | POST `/api/generate`, `/api/quiz`, `/api/tts`, `/api/stt`                            | Limiter native + quota D1 guest/tài khoản/toàn hệ thống    |
| Xác thực           | POST `/api/auth/request`, `/api/auth/verify`, `/api/auth/logout`; GET `/api/auth/me` | Origin cấu hình, token một lần, quota, session có thu hồi  |
| Từ vựng/ôn tập     | `/api/vocab/*`, `/api/review/*`                                                      | Scoped theo user; grade nguyên tử, CAS/version, replay key |
| Quản trị           | `/api/admin/*`                                                                       | Auth/admin; metadata, secret mã hóa, audit không giá trị   |

Các bảng D1 gồm user, magic token đã hash, từ đã học, cấu hình nhà cung cấp email, settings hệ thống, chủ đề, fallback, lịch sử nội dung AI, lựa chọn model AI, lịch sử ôn tập, sự kiện vượt quota và audit. Bảo toàn mười hai migration lịch sử;0013–0015 chỉ thêm schema cho M1. Main local và recovery khác identity 0003/0004; legacy còn `mastered_at` và index mà DB mới không có. Migration 0009 chủ động xóa bốn key settings. Xem tài liệu setup về giới hạn backup/diễn tập.

## Cấu hình và bảo mật

| Binding             | Mục đích                                                           |
| ------------------- | ------------------------------------------------------------------ |
| `ASSETS`            | Tệp Vue đã build                                                   |
| `DB`                | Lưu trữ quan hệ D1                                                 |
| `CACHE`             | Cache KV cho cặp từ, khóa theo phiên bản/ngày, TTL 24 giờ          |
| `RATE_LIMITER_API`  | 10 POST học tập mỗi 60 giây trong template/driver local            |
| `RATE_LIMITER_AUTH` | 3 POST auth mỗi 60 giây trong template/driver local                |
| `AI`                | Binding audio Workers AI cho triển khai; generator local không bật |

`JWT_SECRET` và `ENCRYPTION_KEY` là Worker secrets; `.dev.vars` local được Git bỏ qua, chứa giá trị tổng hợp từ setup hoặc giữ nguyên file có sẵn. Không dùng giá trị mẫu cho staging/production. Settings AI nằm trong D1; API admin chỉ trả metadata và buộc mã hóa AI_KEYS. PUBLIC_APP_ORIGIN/ENVIRONMENT là cấu hình origin tin cậy, AI_PROVIDER_ORIGINS cấp quyền origin provider ngoài D1. Xem hướng dẫn local để bổ sung vào config hiện có. Secret/audit legacy có thể cần thay thế/cleanup riêng; kiểm thử không xác minh rotate credential.

## Fixture browser và vận hành

Cài Chromium/thư viện hệ thống bằng `pnpm --filter @vocab/frontend exec playwright install --with-deps chromium`, rồi chạy `pnpm --filter @vocab/frontend test:e2e`. Dừng dịch vụ đang dùng cổng 5173/8787/8788 trước: driver không tái sử dụng server, tạo D1/KV mới trong RAM, áp dụng migration/seed được theo dõi, chỉ bắt request Resend tổng hợp và chặn outbound khác. Driver không đọc `.dev.vars`, DB remote hay key nhà cung cấp thật. Kết quả Playwright máy đọc được có annotation HTTP status; không xuất nội dung mail, magic token hay cookie.

Phát hành thật cần chủ dự án phê duyệt, cấu hình môi trường và lịch sử migration riêng tư, xử lý/chấp nhận rủi ro bảo mật, nghiệm thu M1, diễn tập staging/restore và các bước M2–M4 sau đó. Vòng này chưa nghiệm thu deploy hay rollback remote. Chất lượng ngôn ngữ audio đầy đủ, accessibility, offline/mobile và gamification mở rộng còn chưa được kiểm chứng hoặc thuộc tương lai; roadmap lịch sử ở `idea-and-plan/`.

## Bộ công cụ test Worker

Test backend import `cloudflareTest` từ phiên bản chính xác `@cloudflare/vitest-plugin@1.4.8`, dùng `@cloudflare/vitest-plugin/types`. Vitest giữ4.1.12; M1 bổ sung fixture an toàn và quota bền vững mà không đổi dependency. esbuild trực tiếp0.28.2 đáp ứng peer range của Vite đang cài và dùng cho bundler E2E dùng một lần.

Plugin nhà cung cấp dùng Wrangler4.153.0/Miniflare5 nội bộ. CLI local giữ Wrangler4.105.0 và fixture browser giữ Miniflare4.20260625.0. Mục `packageExtensions` giới hạn đúng phiên bản cấp Workers Types5 thật cho Wrangler nội bộ của plugin, còn TypeScript ứng dụng và CLI local giữ Types4. Peer được đáp ứng đúng scope, không bỏ qua kiểm tra peer hay che audit. Kiểu JSON binding mới của Miniflare cần type alias object đóng cho fixture tệp SQL hiện có; dữ liệu và validation giữ nguyên.

Gói evidence M1 ghi gate trên HEAD đã commit sạch, báo cáo review và các giới hạn còn mở. Dừng để chủ dự án review trước M2–M4 hoặc triển khai.
