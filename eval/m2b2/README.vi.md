# Thiết kế M2-B2 nội bộ

Chỉ chạy offline, không gọi provider/model/app API, TTS/STT, mail hoặc chấm người thật. Bảy nguồn `data/source` giữ nguyên byte từ M2-B1. Kế hoạch có 5 MAIN_EXACT, 4 EXPLORATORY_APPROXIMATE, 3 BLOCKED_ORIGINAL_INTENT; 46 cặp (16 EN→VI /30 VI→EN) chỉ là count yêu cầu của pilot giả định, không phải output. Mọi topic/mode PENDING, inference NOT_AUTHORIZED, review/attempt/sample thật bằng0, ngữ nghĩa NOT_EVALUATED.

Chạy từ repository:

```sh
node eval/m2b2/tools/validate_design.mjs
node --test eval/m2b2/tools/selftest.mjs eval/m2b2/test/design.test.mjs
node --experimental-test-coverage '--test-coverage-include=eval/m2b2/tools/*.mjs' --test eval/m2b2/tools/selftest.mjs eval/m2b2/test/design.test.mjs
node eval/m2b2/tools/report_readiness.mjs
```

Giữ 16 test gốc và thêm33 test, chỉ dùng Node native và esbuild đã cài để kiểm tra schema thuần. Fixture synthetic chỉ có trong test/bản sao tạm, không nhập vào dataset hay tính thành sample model. Validator capture không thực thi inference, không xác minh chữ ký/phê duyệt và không chứng thực chi phí/revision do người gọi khai. AUTHORIZED_CAPTURE chỉ là nhãn khai báo, không phải cấp phép; summary ghi CLASSIFIED_ONLY. Summary synthetic ghi SYNTHETIC_ONLY; không cho gộp lẫn origin. Không tự điền chi phí, revision, prompt hash hay rating.

Giữ nguyên thời gian monotonic được khai báo, không lấy wall clock suy latency. Timestamp chỉ nhận UTC Z hợp lệ với không có phần lẻ hoặc đúng3 chữ số milliseconds. Validator chuẩn bị yêu cầu trạng thái plan/capture/metrics trống đúng thiết kế, không phải executor hoặc intake review hoàn tất. Metadata gốc có ngoại lệ format tại đúng một đường dẫn để giữ checksum. Nguồn runtime/CI/dependencies và M2-A/B1 giữ nguyên. Dừng sau ZIP để ChatGPT review; chưa được pilot thật hay công bố chất lượng/release.
