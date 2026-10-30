# Đề xuất pipeline đánh giá offline

Trạng thái: ĐỀ XUẤT, chờ chủ dự án duyệt mapping/mode, rubric, người chấm và thiết kế lấy mẫu. Gói không có bộ thực thi inference. Chỉ tự động chạy kiểm tra cấu trúc. API tạo tập từ theo topic; `source`/`target` của request là mã locale, còn của pair là văn bản. Không gửi lexical case như prompt riêng cho một từ.

## Lane thẩm định reference

Giữ nguyên 32 case DRAFT_UNREVIEWED. Có 64 ô A/B, chưa gán người chấm thật. Sau khi được duyệt, mỗi case cần hai người đủ điều kiện, độc lập, dùng ID giả danh ổn định, thời gian UTC và giải thích. Không đưa tên/email riêng tư vào evidence. Người B không xem kết quả A trước khi nộp. Chấm riêng semantic_accuracy, context_alignment, naturalness, reference_suitability theo 0–4 cùng cờ critical/direction. Validator chuẩn bị hiện tại chỉ nhận ô PENDING/trống; luồng nhận review hoàn tất cần hợp đồng kiểm chứng riêng sau khi được duyệt.

Mỗi case chỉ hoàn tất review khi có đủ A/B từ hai người độc lập. Tính disagreement mỗi dimension bằng số case có điểm khác nhau chia số case đủ hai review hợp lệ; công bố cả tử/mẫu và case còn thiếu. Nếu bất đồng cờ critical/direction hoặc chênh điểm ≥2, cần người thứ ba adjudicate; giữ điểm gốc, ID/thời gian/lý do/kết luận của adjudicator, không âm thầm lấy trung bình. Báo riêng số review, consensus, adjudication. Khi chưa có cặp review, tỷ lệ và chất lượng là null/NOT_EVALUATED. Lexical draft không có IPA đã xác minh, không tự điền IPA hoặc điểm IPA.

## Lane lấy mẫu model tương lai — M2-B2 chưa được phép

Cần duyệt toàn bộ mapping/mode và quyết định riêng về môi trường, ngân sách, model trước mọi lần gọi. Topic exact không chứng minh output đúng; approximate làm mất tính đặc hiệu transport/family/business. Chốt thiết kế phân tầng theo chiều, level, topic, chính sách lặp và độ bất định; không tự ghép output topic ngẫu nhiên vào reference lexical.

Mỗi lần thử phải có `scenario_id`, `attempt_id`, request nguyên bản, `source_locale`, `target_locale`, `uiLocale`, `requestCount=request.count`, application SHA, thời gian UTC, model revision hoặc UNKNOWN, trạng thái nhận diện model, SHA256 prompt chính xác và cấu hình công khai không chứa secrets. Mỗi pair có `sample_id` ổn định, `generated_pair_index` bắt đầu từ 0, văn bản gốc và hai ô review độc lập. Ghi `HTTP_status`, `error_code`, `cacheHit`, `isFallback`, `partial`, `requestedCount`, `returnedCount`; metadata thiếu phải để null/ghi nhận thiếu, không bịa. Lần lỗi không có pair thì sample_id/index null. Template trống không phải model sample.

Giữ tất cả attempt kể cả 503, timeout và partial. Mẫu số availability là **mọi attempt được phép**, không lọc chỉ response tốt. Báo full/partial/503/lỗi khác và cache/fallback theo từng tầng. Coverage item so tổng count yêu cầu với tổng trả về; báo riêng item distinct hợp lệ và số thiếu/bị loại mà vẫn giữ output gốc. Chất lượng ngữ nghĩa dùng sample đủ review hợp lệ nhưng luôn kèm coverage trên mọi sample/attempt; không gộp fallback/cache thành thành tích AI. Hiện không có mẫu số tỷ lệ chất lượng vì chưa có attempt/sample/review.

Rubric model gồm semantic_accuracy, context_alignment, naturalness, example_fidelity, ipa_quality; IPA applicability phải quyết định riêng và ghi accent/dialect. IPA null không mặc định là lỗi. CEFR cần rubric hiệu chuẩn riêng. So khớp chuỗi với bản dịch nháp không phải chấm ngữ nghĩa.

## Báo cáo và điều kiện tiếp tục

`node eval/m2b1/tools/report_pending.mjs` xuất report skeleton thật: 0/64 review, 0/12 scenario runs, 0 model samples; accuracy và IPA null. Ngưỡng 95%/0 critical chỉ là candidate sau pilot, chưa được áp dụng. Cần duyệt sample size, độ bất định, rubric, người chấm, quyền công bố/license và mọi chi phí. Không ghi GOLD_APPROVED hay M2 QUALITY PASS.

TTS vi/fr/th/de → en không hợp lệ để công bố hỗ trợ các ngôn ngữ đó. STT chỉ so transcript, không chấm phát âm/trọng âm. Không gọi TTS/STT/provider/audio thật. Vẫn giữ finding persistence có thể lưu output chưa cap trước route; không sửa runtime trong giai đoạn này.
