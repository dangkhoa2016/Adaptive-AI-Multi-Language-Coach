# Tài nguyên nội bộ M2-B1 offline

DRAFT_UNREVIEWED; quyền công bố/license chờ chủ dự án quyết định. Dữ liệu nguồn được giữ bất biến, proposal không thay thế ý định gốc. Có 32 case, 12 proposal và 64 ô A/B trống; không có output model hoặc review thật.

Chạy từ thư mục repository:

```sh
node eval/m2b1/tools/validate_plan.mjs
node eval/m2b1/tools/selftest.mjs
node eval/m2b1/tools/report_pending.mjs
node --experimental-test-coverage '--test-coverage-include=eval/m2b1/tools/*.mjs' --test eval/m2b1/test/plan.test.mjs
```

Dùng Node/pnpm đã có, không thêm dependency. Kiểm thử bundle schema request thuần từ backend bằng esbuild đã cài, không gọi route/provider và không thực thi proposal. Coverage chỉ phản ánh tooling offline; bộ hồi quy ứng dụng `pnpm test` vẫn riêng biệt.

Validator chuẩn bị chỉ chấp nhận ô review PENDING/null; COMPLETE luôn bị từ chối, không phải luồng nạp review hoàn tất. Hash nguồn được ghim độc lập với manifest. Metadata gốc được miễn format tại đúng một đường dẫn để giữ checksum; không sửa tài nguyên M2-A.

Protocol, pipeline và bảng quyết định EN/VI nằm riêng tại `docs/internal/m2b1/`. 5 mapping exact, 7 approximate, tất cả chờ duyệt. Template capture trống không tính là sample. Không có điểm ngữ nghĩa, IPA hoặc phát âm; chưa được chuyển M2-B2.
