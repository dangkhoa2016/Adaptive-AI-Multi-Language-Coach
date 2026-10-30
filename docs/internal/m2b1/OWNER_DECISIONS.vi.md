# Bảng quyết định cần chủ dự án duyệt

M2_B1_OWNER_MAPPING_APPROVAL=PENDING. M2_B2_NOT_RUN / NOT_AUTHORIZED. Semantic quality NOT_EVALUATED.

| Scenario | Original topic     | Proposed topic | Match       | Mode   | Owner decision | Execution |
| -------- | ------------------ | -------------- | ----------- | ------ | -------------- | --------- |
| GEN-01   | daily conversation | daily_life     | APPROXIMATE | mix    | PENDING        | NOT_RUN   |
| GEN-02   | daily conversation | daily_life     | APPROXIMATE | mix    | PENDING        | NOT_RUN   |
| GEN-03   | transport          | travel         | APPROXIMATE | mix    | PENDING        | NOT_RUN   |
| GEN-04   | food               | food           | EXACT       | mix    | PENDING        | NOT_RUN   |
| GEN-05   | workplace          | work           | APPROXIMATE | phrase | PENDING        | NOT_RUN   |
| GEN-06   | technology         | technology     | EXACT       | mix    | PENDING        | NOT_RUN   |
| GEN-07   | travel             | travel         | EXACT       | word   | PENDING        | NOT_RUN   |
| GEN-08   | everyday topics    | daily_life     | APPROXIMATE | mix    | PENDING        | NOT_RUN   |
| GEN-09   | food               | food           | EXACT       | mix    | PENDING        | NOT_RUN   |
| GEN-10   | family             | daily_life     | APPROXIMATE | mix    | PENDING        | NOT_RUN   |
| GEN-11   | travel             | travel         | EXACT       | mix    | PENDING        | NOT_RUN   |
| GEN-12   | business           | work           | APPROXIMATE | mix    | PENDING        | NOT_RUN   |

Duyệt hoặc chặn từng mapping/mode, kể cả exact. Với approximate: chấp nhận rõ phần mất đặc hiệu, mở tính năng topic riêng hoặc BLOCKED; kiểm tra cấu trúc không phải phê duyệt. Quyết định riêng rubric/ngưỡng/sample size, hai người chấm độc lập và adjudicator, quyền công bố/license, liên kết sampling và ngân sách/model/môi trường inference. Audio cần phép riêng. Giữ O-03–O-08 của M1 đang mở.
