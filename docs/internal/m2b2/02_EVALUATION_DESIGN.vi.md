# M2-B2 — Thiết kế đánh giá chất lượng Anh ↔ Việt (VI)

**Trạng thái:** `PROPOSED_OWNER_REVIEW_PENDING`. **Không chạy model** trong M2-B2 design. Dữ liệu hiện tại: 32 lexical draft, 12 scenario proposal, 64 reviewer slots trống, 0 real outputs. Nguồn hợp đồng: M2-B1 evidence; endpoint `POST /api/generate` theo topic (`source`/`target` là mã ngôn ngữ, còn trong `pairs` là văn bản). Không có endpoint tạo riêng một từ theo context.

## A. Mục tiêu và những điều không được suy luận

Phân biệt 4 vấn đề: **(1) API đúng schema**; **(2) đủ số lượng, phản hồi ổn định, nguồn AI/fallback/cache rõ ràng**; **(3) chính xác/ngữ cảnh/tự nhiên/IPA qua human review**; **(4) phát âm âm thanh thực**. Thành công (1) hoặc (2) không chứng minh (3)/(4). Không tự chấm semantic qua so khớp chuỗi; không gọi STT transcript similarity là pronunciation score. Giữ TTS `vi/fr/th/de → en` là rủi ro trước khi quảng bá khả năng hỗ trợ.

## B. Hai lane độc lập

**Lane R: Reference curation.** 32 lexical draft chia 16 EN→VI và 16 VI→EN. Mỗi case cần 2 reviewer độc lập, tổng 64 lượt. Reviewer A/B không thấy đánh giá của nhau trước khi nộp. Đánh giá riêng `semantic_accuracy`, `context_alignment`, `naturalness`, `reference_suitability` theo 0–4; cờ `critical_error`, `language_direction_error`, giải thích, dialect/accent và thời điểm UTC. Reviewer thứ 3 xét bất đồng về cờ critical/direction hoặc lệch điểm ≥2. Giữ dữ liệu gốc, không trung bình hóa các bất đồng quan trọng. Đầu ra sau khi hoàn tất mới xét quyền/license và `GOLD_APPROVED`; hiện **0/64 COMPLETE** và `NOT_EVALUATED`.

**Lane M: Model topic-generation sampling.** Chỉ sau khi có phép riêng. Mỗi attempt gắn `scenario_id`, `attempt_id`, `request_sha256`, request đầy đủ (mã locale, topic, level, count, uiLocale, mode), application commit, model/revision nếu biết, prompt/config hash nếu biết, UTC, thời gian elapsed từ đồng hồ monotonic, HTTP status/error, `requestedCount`, `returnedCount`, `partial`, `cacheHit`, `isFallback`. Mỗi pair thực nhận có `sample_id=(attempt_id,pair_index)`; chú thích tham chiếu được tạo từ output thực, **không gán ngẫu nhiên** với các lexical case. Hai người chấm mỗi sample, phân biệt chi phí và chất lượng theo origin.

**Lane S: Speech** chưa nằm trong phạm vi; không dùng dữ liệu giọng nói cá nhân. Khuyến nghị kế hoạch riêng có consent và model/voice/language chứng thực.

## C. Thiết kế pilot từng cổng

**Stage 0 — owner gate:** ký duyệt từng mapping + mode, rubric, reviewer, quyền/license, sampling, model/revision, môi trường, USD hard cap, request cap, kill switch. Nếu thiếu một trong các điều kiện này thì **BLOCKED**; chương trình không có default budget.

**Stage 1 — pilot ứng viên:** 5 scenario exact (GEN-04/06/07/09/11), tối đa **5 attempts**, một request mỗi scenario, tối đa **46 requested pairs** nếu thực hiện đầy đủ. Chiều EN→VI có 16 requested pairs, VI→EN có 30; mẫu **không cân bằng** và chưa đại diện production. Đếm toàn bộ attempts, kể cả lỗi 429/503/timeout/partial. Tách fallback và cache khỏi AI model quality. Không thực hiện được cùng một prompt nhiều lần độc lập qua cache; GEN-11 repeat là kiểm tra cache/dedup chứ không phải replication của model. GEN-07 `count=1` là boundary test. GEN-09 fallback chỉ đo khi nguồn fallback thực sự xảy ra; không được tạo tình huống lỗi giả trên live provider để lấy điểm semantic.

**Stage 2 — exploratory, chỉ khi phê duyệt riêng:** GEN-01/02/05/08, báo kết quả dưới nhãn topic rộng. GEN-03/10/12 vẫn BLOCKED với mục tiêu original-intent cho đến khi chọn taxonomy mới hoặc định nghĩa mục tiêu hợp lệ khác. Không cộng exploratory vào KPI Stage 1.

**Sau pilot:** rà soát lỗi/độ phủ; đề xuất tiếp cohort phân tầng direction × level × topic × mode, có số request và ngân sách định lượng. Không suy rộng CI từ 5 scenario thành độ chính xác production; các cặp sinh cùng request có tương quan, không coi mọi pair là quan sát hoàn toàn độc lập.

## D. Chỉ số cần báo cáo với mẫu số rõ ràng

- `attempts_all`: tổng lần thử được phép và thực thi (bao gồm HTTP 429/503, lỗi mạng, timeout). Một retry là attempt mới với parent ID, không xóa attempt lỗi.
- `full_delivery_rate = count(HTTP 200 AND returnedCount==requestedCount)/attempts_all`. Nếu `attempts_all=0`, tỷ lệ là `null`, không phải 0%.
- `pair_yield = sum(returnedCount từ HTTP 200)/sum(request.count của tất cả attempt)`. Denominator phải bao gồm lỗi/partial.
- `fallback_deliveries`, `cache_deliveries`: đếm riêng, không tính thành inference độc lập. Một request HTTP 200 không tự chứng minh provider chính đã tạo câu trả lời.
- Semantic rubric: `semantic_accuracy`, `context_alignment`, `naturalness`, `example_fidelity`; `ipa_applicable`, `ipa_quality` chỉ khi IPA phù hợp và có bằng chứng; `critical_error` riêng. Chỉ báo cáo khi đủ human ratings; 0 reviews nghĩa là `NOT_EVALUATED`, không phải accuracy 0%/100%.
- Khi tính tỷ lệ và confidence interval, phải ghi tử số/mẫu số, tầng mẫu, số reviewer hợp lệ, disagreement/adjudication. Wilson 95% CI chỉ là một phương pháp ứng viên cho tỷ lệ nhị phân sau khi duyệt; không áp dụng sai giả định độc lập giữa các cặp cùng attempt.
- Ngưỡng `≥95%` semantic/context ≥3, `0 critical` là **candidate**; chưa dùng làm pass/fail gate. Cần quyết định số lượng mẫu và độ bất định trước.
- `latency_ms` lấy từ đồng hồ monotonic cho mỗi attempt; `captured_at_utc` cho provenance. `cost_usd`, usage tokens, provider revision, prompt hash phải là `null`/`UNKNOWN` nếu provider không cung cấp, không suy đoán.

## E. Bảo vệ dữ liệu và khả năng tái lập

Evidence nội bộ, không lưu API keys, bearer/cookies, magic links, user text/email, DB thật, file âm thanh, prompt chứa thông tin cá nhân. Hash nguồn/dữ liệu đã xác thực, seed nếu dùng cơ chế random, Node/pnpm/OS, application SHA, mã model và revision. Dữ liệu sample từ output thực chỉ lưu vào kho private đã được duyệt; không public dataset khi chưa xét license. Không thay AI runtime, quotas, CI, D1 hoặc bản gốc M2-A/M2-B1 trong bước thiết kế.

## F. Điều kiện nghiệm thu bản thiết kế

Có 12 decision objects bảo toàn intent và mã request, 5/4/3 nhóm đúng, 7 source anchors khớp ZIP đã cung cấp, plan 5 attempts/46 requested pairs (16/30), capture template toàn `null`/`NOT_RUN`, validator và synthetic negative tests PASS, `accuracy=null`, 0 real samples, không có network calls. **`M2_B2_DESIGN_PASS` không phải `M2_QUALITY_PASS`, không phải quyền inference.**
