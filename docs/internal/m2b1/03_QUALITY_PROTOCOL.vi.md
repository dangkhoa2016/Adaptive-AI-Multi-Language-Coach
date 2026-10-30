# M2-B1 — Quy trình đánh giá chất lượng Anh ↔ Việt (BẢN ĐỀ XUẤT)

## 1. Mục tiêu và phân tầng bằng chứng

**Lane A — Kiểm tra hợp đồng dữ liệu:** 32 lexical draft có cấu trúc hợp lệ, 12 proposed generation requests đúng enum, 64 reviewer slots đầy đủ. PASS ở Lane A không đồng nghĩa bản dịch đúng. Chỉ lane này được tự động chạy trong M2-B1.

**Lane B1 — Thẩm định nguồn tham khảo:** 32 lexical cases có ngữ cảnh và các bản dịch tham khảo do dự án soạn. Hai người đánh giá độc lập xác minh mỗi case (nghĩa phù hợp ngữ cảnh, chiều ngôn ngữ, tự nhiên, danh sách biến thể chấp nhận và bản dịch sai điển hình). 32 × 2 = 64 lượt review, không tính một người chấm lại chính mình. Sau bất đồng cần người thứ ba adjudicate. **Hiện tại 0/64 COMPLETE, 32/32 DRAFT_UNREVIEWED**. IPA không có dữ liệu trong lexical draft; tuyệt đối không tự tạo IPA hoặc chấm IPA từ bản nháp.

**Lane B2 — Chấm sample model:** Chỉ được thực hiện ở giai đoạn được chủ dự án phê duyệt gọi model. Dữ liệu model trả là tập `pairs`, không phải phản hồi riêng cho `bank`/`charge`...; phải thu `scenario_id`, `sample_id`, `generated_pair_index`, `source_locale`, `target_locale`, `model_revision`, `prompt_hash`, cấu hình, thời điểm và cờ `isFallback/cacheHit/partial`. Hai reviewer độc lập chấm từng sample. `source`/`target` trong pair là _text_, còn `source`/`target` trong request là _mã locale_.

**Lane C — Âm thanh:** TTS/STT thật, phát âm/trọng âm và chất giọng chỉ được lập kế hoạch, chưa thực thi. `computeSimilarity` chỉ là độ giống transcript, không được gọi là điểm phát âm. Mapping TTS `vi/fr/th/de → en` vẫn là vấn đề phải giải quyết trước khi tuyên bố hỗ trợ.

## 2. Rubric 0–4, có giải thích cụ thể

| Điểm | Ý nghĩa                                                                   |
| ---- | ------------------------------------------------------------------------- |
| 0    | Sai nghiêm trọng, đảo nghĩa, sai chiều ngôn ngữ hoặc nội dung gây hại     |
| 1    | Sai phần quan trọng, không dùng được để học                               |
| 2    | Một phần đúng nhưng cần sửa đáng kể                                       |
| 3    | Đúng/ngữ cảnh phù hợp, chấp nhận được, chỉ lỗi nhỏ                        |
| 4    | Chính xác, tự nhiên, phù hợp bối cảnh/trình độ, có thể dùng như ví dụ tốt |

**Reference curation:** chấm `semantic_accuracy`, `context_alignment`, `naturalness`, `reference_suitability`; `critical_error` và `language_direction_error` cần được đánh giá riêng. Bản dịch trong `accepted_reference_translations` chỉ là biến thể gợi ý, không phải bộ đáp án duy nhất. Không được dùng so khớp chuỗi để tự chấm semantic score.

**Model sample:** dùng `semantic_accuracy`, `context_alignment`, `naturalness`, `example_fidelity`, `ipa_quality` (null nếu không áp dụng hoặc chưa có bằng chứng). Kiểm tra ví dụ tiếng nguồn/đích có đúng chiều, diễn đạt tự nhiên và đúng nghĩa, IPA tương ứng từ ngữ và accent được công bố. `ipa_applicable` phải được chốt độc lập theo ngôn ngữ/trường, không coi IPA rỗng mặc định là lỗi. Kiểm tra CEFR là dimension riêng cần rubric có chuẩn; đừng tự suy từ độ dài câu.

Báo cáo `critical_error` true nếu sai chiều ngôn ngữ, sai nghĩa gây hiểu lầm nặng, ví dụ đảo phủ định, đổi số lượng/nội dung rủi ro, hoặc đáp án quiz sai mà không thể phân giải. Ghi bằng chứng lý do. Đánh giá theo từng target/source và ngữ cảnh thực tế; không tự động loại tiếng Việt có dấu hoặc biến thể hợp lệ.

## 3. Độc lập, adjudication và provenance

- Người A và B làm độc lập, không xem kết quả của nhau trước khi nộp; dùng `reviewer_id` ổn định nhưng không chứa tên/email riêng tư trong ZIP.
- Mọi lượt hoàn thành phải có reviewer thực, thời điểm UTC, ít nhất một đánh giá có giải thích; 64 slot hiện tất cả là `PENDING`/null, không được điền giả.
- Bất đồng về critical flag, language direction, hoặc chênh điểm ≥2 phải được adjudicate bởi người thứ ba, không âm thầm lấy điểm trung bình. Công bố tỷ lệ bất đồng theo dimension và số case có consensus.
- Giữ mẫu lỗi/chấm thấp để phản biện; không cherry-pick mẫu tốt. Cần xem xét quyền sử dụng/pub license trước khi đăng công khai.
- Không đánh dấu dataset `GOLD_APPROVED` trước khi có hai lượt thẩm định đủ điều kiện và giải quyết bất đồng, cùng owner phê duyệt.

## 4. Báo cáo và ngưỡng đạt

Báo cáo đầu tiên phải nêu số case, số lượt review hoàn thành, tỷ lệ coverage, số bất đồng, số adjudicated, số reviewer độc lập, tần suất lỗi critical, và phần chưa đánh giá. **Nếu chưa có sample model/human review thì chất lượng `NOT_EVALUATED`, không ghi 0% accuracy hay 100% quality.**

Mức gợi ý để thảo luận _sau pilot_ (CHƯA được áp dụng làm gate): 0 sai chiều ngôn ngữ nghiêm trọng; ≥95% sample được human review có semantic+context ≥3 với mẫu đủ đa dạng; mọi sai nghĩa nghiêm trọng được sửa hoặc loại; không claim phát âm nếu chưa có audio benchmark. 32 lexical draft không đủ để suy rộng accuracy production; cần xác định số lượng mẫu, cấu trúc phân tầng theo level/topic/direction và confidence interval trước khi đặt KPI chính thức.

## 5. Giới hạn cần ghi trong kết quả

12 proposed requests chưa được chạy; `topic` chỉ là broad category nên không bảo đảm khớp focus. Backend có thể trả `partial=true` hoặc 503; không loại mẫu thất bại khỏi mẫu số. TTS/STT provider/audio, AI latency/cost, semantic quiz uniqueness và chất lượng IPA đều `NOT_RUN/NOT_EVALUATED` trong M2-B1.
