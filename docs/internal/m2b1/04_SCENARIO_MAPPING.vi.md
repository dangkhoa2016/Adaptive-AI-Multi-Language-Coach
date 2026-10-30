# M2-B1 — Bảng ánh xạ 12 scenario Anh ↔ Việt (bản đề xuất)

## Nguồn schema

Theo M2-A evidence (`02_contract/M2_CONTRACT_INVENTORY.md`, `SCENARIO_MAPPING.md`), `POST /api/generate` nhận `source`, `target`, `topic`, `level`, `count`, `uiLocale`, `mode`.

- `source`, `target`, `uiLocale`: `en`, `vi`, `ja`, `ko`, `th`, `zh`, `fr`, `de`.
- `topic`: `travel`, `food`, `work`, `education`, `health`, `technology`, `shopping`, `entertainment`, `daily_life`, `nature`.
- `level`: `A1`, `A2`, `B1`, `B2`; `count`: số nguyên 1–50; `mode`: `word`, `phrase`, `mix`.
- `uiLocale` được cố định `en` trong mọi request đề xuất nhằm tách UI locale khỏi chiều học từ vựng; việc sử dụng `en` không biến `source`/`target` thành tiếng Anh.
- Tất cả `mode` được đề xuất mới, **không phải lựa chọn gốc đã được owner duyệt**. `mix` là default hiện hành; `phrase` ở GEN-05 phục vụ collocations; `word` ở GEN-07 phục vụ minimum count.

| Case   | Ý định topic gốc   | Topic đề xuất | Mức khớp    | Mode đề xuất | Cảnh báo                                      |
| ------ | ------------------ | ------------- | ----------- | ------------ | --------------------------------------------- |
| GEN-01 | daily conversation | daily_life    | APPROXIMATE | mix          | Topic rộng hơn hội thoại                      |
| GEN-02 | daily conversation | daily_life    | APPROXIMATE | mix          | Giữ VI→EN, topic vẫn rộng                     |
| GEN-03 | transport          | travel        | APPROXIMATE | mix          | Không bảo đảm phương tiện                     |
| GEN-04 | food               | food          | EXACT       | mix          | Mode chưa duyệt                               |
| GEN-05 | workplace          | work          | APPROXIMATE | phrase       | Không bảo đảm collocations hợp lệ             |
| GEN-06 | technology         | technology    | EXACT       | mix          | Chưa chứng minh nghĩa chuyên ngành            |
| GEN-07 | travel             | travel        | EXACT       | word         | Kiểm tra count=1                              |
| GEN-08 | everyday topics    | daily_life    | APPROXIMATE | mix          | Không tương đương toàn bộ everyday            |
| GEN-09 | food               | food          | EXACT       | mix          | Fallback không chứng minh chất lượng          |
| GEN-10 | family             | daily_life    | APPROXIMATE | mix          | Rủi ro không ra mục family                    |
| GEN-11 | travel             | travel        | EXACT       | mix          | Hai lần generate không bảo đảm mẫu giống nhau |
| GEN-12 | business           | work          | APPROXIMATE | mix          | Work không đồng nghĩa business                |

**Đếm:** 5 EXACT / 7 APPROXIMATE. Có 12 JSON request đúng dạng schema **đề xuất**, nhưng **0 request được phê duyệt để gọi model**, 0 lần gọi thực tế. Với các mapping APPROXIMATE, đề xuất chủ dự án chọn: chấp nhận độ lệch topic, thêm topic mới trong một tính năng riêng, hoặc đánh dấu scenario `BLOCKED` thay vì âm thầm tuyên bố intent được đáp ứng.

## Khoảng trống đánh giá

32 lexical cases theo ngữ cảnh (`bank` financial vs riverbank...) **không tương ứng một-một** với `POST /api/generate` tạo một tập từ theo `topic`. Không được gán lỗi/success lexical case cho output chưa từng lấy mẫu. M2-B2 cần thiết kế chiến lược lấy mẫu, liên kết từng cặp sinh ra với `sample_id`, `scenario_id`, version model/prompt trước khi human review.
