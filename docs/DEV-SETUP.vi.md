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
pnpm -r build
pnpm --filter @vocab/backend test:coverage
pnpm --filter @vocab/frontend test:coverage
pnpm --filter @vocab/frontend exec playwright install --with-deps chromium
pnpm --filter @vocab/frontend test:e2e
```

Playwright tự khởi động Vite và driver Miniflare với D1/KV mới trong RAM, migration/seed local và limiter native. Dừng dịch vụ khác trên cổng 5173/8787/8788 trước; không tái sử dụng backend hiện có. Mail chỉ được bắt local cho user tổng hợp, mọi outbound khác bị chặn; không có key AI thật. `pnpm test` chỉ chạy Vitest, không chạy Playwright. Coverage có `coverage-summary.json` trong thư mục coverage được Git bỏ qua của mỗi workspace. Test auth/mail/AI dùng mock; test Workers còn chạy D1/KV local. Kết quả này không chứng minh mail thật, chất lượng AI hay hành trình browser hoàn chỉnh.

## Trạng thái xác thực và bảo mật

Đã sửa serialize JSON hai lần và phạm vi limiter trong ngoại lệ hẹp để đóng M0. Fallback không có nhãn đúng ngôn ngữ bị từ chối. M0 vẫn cần nghiệm thu audit và credential. Chỉ bắt đầu M1 tổng thể khi được phép; magic-link dùng Origin từ request và có nhánh log token không an toàn. API secrets admin và tính nguyên tử khi chấm ôn tập cũng cần sửa ở M1. Không thử bằng email thật, credential nhà cung cấp hay secret production. Không dùng token từ console hoặc SQL chèn token thủ công để đăng nhập. Hướng dẫn SQL cũ dùng cột `magic_tokens.id` không tồn tại và không đáp ứng token hashing. Driver E2E chỉ bắt mail tổng hợp để kiểm tra request gửi link; toàn bộ fixture đăng nhập/lưu từ/ôn tập an toàn vẫn thuộc M1, chưa nghiệm thu.

## Giới hạn database và phát hành

Đã thử fresh migrations và nâng cấp legacy giả lập bằng D1 local. Migration lịch sử `0003_ai_generated_content.sql` / `0004_sm2_review.sql` trên main local khác tên `0003_migrate_env_to_db.sql` / `0004_seed_app_settings.sql` trên recovery. Phải bảo toàn identity lịch sử. Legacy còn cột `mastered_at` mà DB mới không có. Migration 0009 xóa bốn key settings cũ. Khi chưa biết lịch sử remote, cần kiểm kê riêng, backup và diễn tập đúng schema trước khi nâng cấp được phê duyệt.

Workflow deploy chỉ nhận kích hoạt thủ công và job deploy đang bị vô hiệu. Job phụ thuộc CI chất lượng dùng lại; bật deploy cần chủ dự án review, cấu hình môi trường thật và cho phép phát hành rõ ràng. Chưa chạy migration remote, deploy hay gọi AI trả phí.
