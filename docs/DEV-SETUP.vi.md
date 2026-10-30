# Phát triển local

Dùng Node **22.22.3** (`.nvmrc`, phạm vi `>=22.18.0 <23`) và **pnpm 11.1.3**. Dependencies đã khóa cần Node từ 22.18. Không dùng credential hay snapshot database production.

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @vocab/backend setup:local
pnpm --filter @vocab/frontend build
pnpm --filter @vocab/backend db:migrate:local
pnpm --filter @vocab/backend db:seed:local
```

`setup:local` chỉ tạo `backend/wrangler.toml` và `backend/.dev.vars` khi chưa tồn tại, giữ nguyên file hiện có. Hai file này được Git bỏ qua; hãy kiểm tra riêng trước khi dùng. Config sinh ra dùng ID giả cho local, có D1, KV, assets và rate limiter. Không deploy config này. Binding Workers AI không được bật ở local vì có thể gọi inference remote tính phí. Template triển khai có khai báo AI; kiểm chứng thật cần binding tài khoản và phê duyệt. Health check không chứng minh tính năng AI/audio hoạt động.

Chạy hai terminal:

```bash
pnpm dev:backend
```

```bash
pnpm dev:frontend
```

Mở `http://localhost:5173`. Vite chuyển `/api` tới `127.0.0.1:8787`. Kiểm tra `http://127.0.0.1:8787/health` và `/api/locales` (tám locale). Frontend build vào `assets/` ở root.

Khi kiểm chứng với DB dùng một lần, truyền `--persist-to` trỏ tới thư mục mới cho cả migration, seed và dev; dùng cùng đường dẫn tuyệt đối cho ba lệnh. Không tái sử dụng DB local hiện có. Không dùng `--remote` trong vòng review M0/M1.

## Kiểm chứng

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm --filter @vocab/backend test:provider-runtime
pnpm -r build
pnpm --filter @vocab/backend test:coverage
pnpm --filter @vocab/frontend test:coverage
pnpm --filter @vocab/frontend exec playwright install --with-deps chromium
pnpm --filter @vocab/frontend test:e2e
```

Regression provider native dùng workerd đang cài và outbound service tổng hợp để kiểm tra fetch thành công cùng từ chối redirect, không gọi mạng ngoài. CI chạy riêng bước này ngoài Vitest.

Playwright tự khởi động Vite và driver Miniflare với D1/KV mới trong RAM, migration/seed local và limiter native. Dừng dịch vụ khác trên cổng 5173/8787/8788 trước; không tái sử dụng backend hiện có. Mail chỉ được bắt local cho user tổng hợp, mọi outbound khác bị chặn; không có key AI thật. `pnpm test` chỉ chạy Vitest, không chạy Playwright. Coverage có `coverage-summary.json` trong thư mục coverage được Git bỏ qua của mỗi workspace. Test auth/mail/AI dùng mock; test Workers còn chạy D1/KV local. Kết quả không chứng minh mail thật hay chất lượng AI; Playwright chạy riêng hành trình browser tổng hợp hoàn chỉnh.

## Trạng thái xác thực và bảo mật

M1 được thực hiện theo yêu cầu tiếp tục sau vòng sửa dependency M0. Auth dùng `PUBLIC_APP_ORIGIN` tin cậy, consume token dạng hash bằng cập nhật có điều kiện và JWT có thu hồi session. Settings admin chỉ trả metadata; server luôn mã hóa secret thay thế. Chấm review cần `expectedVersion` và `idempotencyKey`; cập nhật thẻ và ghi lịch sử nằm trong cùng batch D1 nguyên tử. Xác minh credential được bỏ qua theo yêu cầu; không coi là đã rotate hay nghiệm thu production.

File `.dev.vars.example` mới có `PUBLIC_APP_ORIGIN=http://localhost:5173` và `ENVIRONMENT=local`. Setup giữ nguyên file hiện có: bổ sung riêng hai giá trị không bí mật này vào `.dev.vars` local nếu thiếu. Mở đúng hostname/cổng đã cấu hình; nếu phục vụ assets trực tiếp ở cổng khác phải dùng origin đó. Production cần origin HTTPS chuẩn và `ENVIRONMENT=production`; cookie HTTP chỉ được phép khi local rõ ràng trên loopback. Đổi `JWT_SECRET` làm mất hiệu lực mọi session; cần phối hợp rotate riêng tư. Logout thu hồi session hiện tại đến khi hết hạn.

`AI_PROVIDER_ORIGINS` là cấu hình triển khai tin cậy tùy chọn, gồm các origin HTTPS cách nhau bằng dấu phẩy, mặc định `https://api.openai.com`. Sửa endpoint trong D1 không thể cấp quyền tin cậy cho origin mới. PATCH settings chỉ cho `AI_KEYS` (mảng JSON), `AI_ENDPOINT_URL`, `AI_MODEL_NAME`, `AI_MODEL_OPTIONS` (`max_output_tokens`, `temperature`, `top_p`). AI_KEYS plaintext/hỏng trong DB cũ bị từ chối; thay qua API admin đã xác thực, GET không trả lại secret. Giá trị audit cũ bị ẩn khi trả response nhưng vẫn giữ trong DB, cần quy trình cleanup/rotate được phê duyệt riêng.

Giữ truy cập guest. Quota D1 dùng chung mỗi ngày cho generate/quiz/TTS/STT: guest20, tài khoản100, toàn hệ thống500, ngoài limiter native theo phút. Gửi auth tối đa3 lần/email chuẩn hóa/giờ và200 lần toàn hệ thống/giờ. Hết quota trả429 cùng Retry-After; lỗi storage không cho vượt quota. Quota tính cả cache hit và cần chủ dự án review trước phát hành. JSON tối đa64KiB, audio STT5MiB, text học2000ký tự. HTTP provider tối đa15s tổng,5s/lần, tối đa3 lần khi key bị từ chối rõ ràng; response tối đa256KiB, không retry khi chưa rõ request đã được nhận. Speech có deadline10s và không retry; invocation bên dưới có thể chạy tiếp vì binding không hỗ trợ hủy. Mapping ngôn ngữ audio cũ giữ nguyên, chờ kiểm chứng chất lượng M2.

Driver Playwright chạy Vue đăng nhập thật, sinh EN→VI, lưu đúng locale, chấm ôn tập và kiểm tra lịch sử bằng tài khoản tổng hợp. Capture riêng trên loopback chỉ giữ link trong RAM và đọc một lần; không log/xuất token. Không dùng token console hoặc SQL thủ công để đăng nhập; recipe SQL cũ dùng cột `magic_tokens.id` không tồn tại và thiếu hashing. Không dùng email thật hoặc credential nhà cung cấp cho vòng review.

## Giới hạn database và phát hành

Đã thử fresh migrations và nâng cấp legacy giả lập bằng D1 local. Migration lịch sử `0003_ai_generated_content.sql` / `0004_sm2_review.sql` trên main local khác tên `0003_migrate_env_to_db.sql` / `0004_seed_app_settings.sql` trên recovery. Phải bảo toàn identity lịch sử. Legacy còn cột `mastered_at` mà DB mới không có. Migration 0009 xóa bốn key settings cũ. Migration bổ sung0013–0015 thêm version/replay review, thu hồi session và quota có expiry; không sửa file lịch sử. Khi chưa biết lịch sử remote, cần kiểm kê riêng, backup và diễn tập đúng schema trước khi nâng cấp được phê duyệt.

Workflow deploy chỉ nhận kích hoạt thủ công và job deploy đang bị vô hiệu. Job phụ thuộc CI chất lượng dùng lại; bật deploy cần chủ dự án review, cấu hình môi trường thật và cho phép phát hành rõ ràng. Chưa chạy migration remote, deploy hay gọi AI trả phí.
