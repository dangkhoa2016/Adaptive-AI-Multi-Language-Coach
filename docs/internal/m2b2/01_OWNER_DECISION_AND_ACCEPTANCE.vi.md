# Adaptive AI Multi-Language Coach — Biên bản nghiệm thu M2-B1 và quyết định M2-B2 (VI)

**Ngày:** 2026-10-30  
**Nguồn:** M2-B1 evidence `adaptive-coach-m2b1-offline-evidence-20261030T040632Z.zip` và nhật ký Codex CLI cùng phiên.  
**HEAD được kiểm tra trong evidence:** `c5f61515b6ff363ef35ee5abb6474ddec5f549b1`, nhánh `recovery/adaptive-coach-production-hardening-2026-10-29`.

## Quyết định trong phạm vi được giao

Người dùng yêu cầu thực hiện phương án được ChatGPT đề xuất sau review M2-B1. Ghi nhận **OWNER_ACCEPTED_LOCAL_ONLY** cho **M2-B1 offline preparation** (37/37 Node contract, 492/492 Vitest, 4/4 Playwright, provenance và checksum theo evidence). Đây là biên bản diễn giải quyết định qua hội thoại, **không phải chữ ký điện tử** hay bảo chứng production. Không thay đổi commit đã PASS.

**M2-B2 EVALUATION DESIGN: AUTHORIZED_OFFLINE_ONLY.** Được viết tài liệu, thiết kế/kiểm tra contract, tạo fixture **synthetic** trong bộ test. **Chưa** cho phép chạy model, inference trả phí, TTS/STT, email, push/merge/deploy, D1 remote, công bố dataset hoặc chấm giả dữ liệu.

## Đề xuất phân nhóm 12 scenario (không tự động duyệt topic/mode)

| Nhóm                        | ID                                     | Chính sách đề xuất                                                                     | Trạng thái phê duyệt từng scenario |
| --------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------- |
| **MAIN_EXACT**              | GEN-04, GEN-06, GEN-07, GEN-09, GEN-11 | Pilot chính, chỉ sau quyết định riêng                                                  | PENDING                            |
| **EXPLORATORY_APPROXIMATE** | GEN-01, GEN-02, GEN-05, GEN-08         | Đo riêng theo topic rộng, không gán ý định ban đầu là đã đạt                           | PENDING                            |
| **BLOCKED_ORIGINAL_INTENT** | GEN-03, GEN-10, GEN-12                 | Không đưa vào benchmark ý định gốc; muốn đo phải thiết kế taxonomy hoặc mục tiêu riêng | PENDING                            |

- **Mọi mode** (bao gồm `mix`, GEN-05 `phrase`, GEN-07 `word`) chỉ là proposal, vẫn `owner_mode_approval=PENDING`.
- Năm case exact gồm GEN-04 10 cặp VI→EN, GEN-06 20 cặp VI→EN, GEN-07 1 EN→VI, GEN-09 5 EN→VI, GEN-11 10 EN→VI. Nếu thực hiện đúng **một** request mỗi case và trả đủ: **46 cặp** (16 EN→VI / 30 VI→EN). Đây là **trần theo count yêu cầu**, không phải 46 output thật hay 46 đánh giá độc lập.
- GEN-09 kiểm tra nguồn fallback: một response fallback (nếu xảy ra) không phải mẫu từ model chính. GEN-11 kiểm tra tính lặp/cache: cache hit không tạo một inference độc lập. Các phép đo phải phân tầng.

## Các quyết định vẫn cần chủ dự án chốt riêng

1. Duyệt topic/mode **từng scenario**, và định nghĩa mục tiêu riêng cho các mapping approximate; đặc biệt GEN-03/10/12.
2. Duyệt rubric 0–4, tiêu chí critical error, chọn hai reviewer **có thật, độc lập**, adjudicator và quy trình đồng thuận; không điền giả 64 slot đang trống.
3. Kiểm tra quyền sở hữu/quyền công bố, license và phạm vi lưu trữ private của 32 draft lexical cases. Không tự gọi đây là GOLD_APPROVED.
4. Chọn model/provider và version kiểm chứng được, môi trường isolated, hard cap ngân sách USD, số lần gọi tối đa, cách tắt khẩn và chính sách dữ liệu. Mọi giá trị hiện `PENDING`/`null`.
5. Duyệt thiết kế sampling, lượng mẫu theo chiều/ngữ cảnh/trình độ, cách báo khoảng tin cậy, tiêu chí chấp nhận; đề xuất 95%/0 critical **chưa phải acceptance gate**.
6. TTS/STT/audio, người ghi âm và quyền riêng tư cần quyết định **riêng**.

**Những vấn đề tồn đọng không được biến thành PASS:** 0/64 human reviews; 0/12 scenario runs; model samples 0; semantic/IPA `NOT_EVALUATED`; âm thanh `NOT_RUN`; M1 O-03–O-08 còn mở; production `NOT_AUTHORIZED`. Lỗi lưu cặp AI trước khi route cắt về `count` thuộc backlog kỹ thuật riêng, không tự sửa trong nhiệm vụ thiết kế này.

## Quy tắc tiến giai đoạn

`DESIGN_PASS` chỉ chứng minh công cụ và mẫu biểu. Muốn chạy **bất cứ inference nào**, cần một phê duyệt riêng nêu rõ model, version, ngân sách, số lượng request, phương án quan sát, đường dẫn evidence và điều kiện dừng. Không coi sự đồng ý soạn thiết kế là phê duyệt inference.
