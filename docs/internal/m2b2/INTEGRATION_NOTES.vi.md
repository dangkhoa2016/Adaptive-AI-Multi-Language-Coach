# Giới hạn tích hợp và bằng chứng

Đã xác nhận đúng recovery branch, baseline c5f61515b6ff363ef35ee5abb6474ddec5f549b1 và cây sạch. Manifest, 16 selftests và CLI gốc chạy từ thư mục gói trước khi nhập. Bảy nguồn khớp độc lập với ZIP M2-B1 đã kiểm SHA256 và tài nguyên B1 trong Git. Đã đọc/inventory schema và route/AI/quiz/TTS/STT/client thực tế, không có drift.

Tích hợp riêng eval/m2b2 và tài liệu EN/VI nội bộ. Không sửa app runtime/CI/dependencies/migrations/E2E hoặc eval M2-A/B1. Chỉ thêm một dòng miễn format metadata nguồn bất biến theo convention B1 để giữ checksum; không bỏ qua code/test. Các module mới import console/process rõ ràng, không sửa cấu hình ESLint gốc.

TDD với33 test mới +16 gốc: quan sát28 FAIL/21 PASS, sau sửa tooling49 PASS. Guard kiểm toàn bộ trạng thái capture/metrics/lane trống, prereq cần đủ và pending, HEAD gốc, NFC; ID scenario có thật, HTTP status hợp lệ, UTC đúng lịch, success/error nhất quán, token usage không âm và không có điểm phát âm. Summary giữ nhãn synthetic và từ chối gộp origin. Không sửa/nới assertion gốc. Test schema bundle đúng module thuần, không gọi route/provider.

AUTHORIZED_CAPTURE là nhãn người gọi khai, không phải xác nhận phép thật/chi phí/model identity. Validator chưa kiểm phê duyệt scenario/request thực tế hoặc semantic pair schema; chỉ kiểm cấu trúc capture đã định nghĩa. Timestamp có thể kiểm hình thức/calendar, nhưng không chứng minh latency được đo thật; không suy wall clock thành monotonic. Fixture synthetic chỉ ở test/bản sao tạm, không đi vào dataset. Review/attempt/sample thật vẫn0.

Theo chỉ dẫn mới chỉ chạy targeted Node/coverage/CLI/lint/format và integrity Git trên HEAD cuối. Full install/typecheck/Vitest/build/E2E/D1/provider synthetic/audit lịch sử là NOT_RUN ở nhiệm vụ này; không gọi lại thành PASS mới. Giữ mọi log FAIL/RED cùng GREEN trong ZIP.

Các finding cũ vẫn mở: lưu AI trước cap count, ánh xạ TTS vi/fr/th/de→en sai cho claim hỗ trợ, thiếu reference ghi âm, text similarity không chấm phát âm, quyền/license/budget/reviewer và rủi ro vận hành M1. Không đọc secrets/.env/dữ liệu người học. Không network/inference/mail/push/merge/deploy/D1 remote. Scan chỉ có phạm vi source/export được mô tả, không chứng nhận bảo mật tuyệt đối. Dừng để ChatGPT/chủ dự án review trước pilot.

Review độc lập không thấy finding chặn. Lint phát hiện phép gán đầu không dùng trong helper sao chép selftest nhập; đã bỏ phép gán, không đổi assertion gốc. Giữ log lint lỗi cùng mọi lượt đỏ/xanh.
