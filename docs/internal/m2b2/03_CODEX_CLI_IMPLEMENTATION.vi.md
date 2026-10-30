# Codex CLI — Tích hợp M2-B2 Evaluation Design (OFFLINE ONLY)

**Lệnh giao việc:** Đọc `README.vi.md`, `docs/01_OWNER_DECISION_AND_ACCEPTANCE.vi.md`, `docs/02_EVALUATION_DESIGN.vi.md` và toàn bộ `data/planning`. Chỉ triển khai **thiết kế/công cụ đo offline** trên recovery branch, tạo ZIP evidence để ChatGPT review. Không chạy model.

## 0. Ranh giới và điều kiện dừng

- Baseline kỳ vọng: `recovery/adaptive-coach-production-hardening-2026-10-29` tại `c5f61515b6ff363ef35ee5abb6474ddec5f549b1`, working tree sạch. Kiểm tra `git branch --show-current`, `git rev-parse HEAD`, `git status --porcelain` **trước khi sửa**. Nếu khác: **dừng**, chụp trạng thái và báo cáo; không reset, checkout, stash, rebase hoặc force.
- Không làm lại M0/M1/M2-A/M2-B1 đã nghiệm thu local. Không sửa runtime backend/frontend, quotas, migrations, CI, app schemas, AI provider config, E2E fixtures hoặc `.env` để tạo kết quả PASS.
- Cấm: model inference, paid/free provider calls, text-to-speech/speech-to-text, real mail, human review giả, phát hành dataset, push/merge/deploy, D1 remote, đọc/log secrets, sửa lịch sử Git. Không cài package mới nếu Node native đủ.
- Đừng tự duyệt `owner_*` hoặc nâng status `NOT_EVALUATED` thành PASS; một lệnh chạy thành công chỉ chứng minh contract.

## 1. Inventory và khôi phục provenance

Ghi UTC, OS, Node/pnpm, branch/SHA/clean status; kiểm tra tính toàn vẹn gói qua `sha256sum -c SHA256SUMS.txt`, chạy offline:

```bash
node tools/validate_design.mjs
node --test tools/selftest.mjs
node tools/report_readiness.mjs
```

Chạy lệnh từ **gốc gói ZIP đã giải nén**, không phải thư mục repo. Không tự dùng `curl`/`fetch`. So sánh SHA256 của 7 tài nguyên gốc với `data/planning/source_anchors.json` và B1 ZIP. Đọc mã nguồn hiện tại `backend/src/services/schemas.ts`, `backend/src/i18n/topics.ts`, `backend/src/routes/generate.ts`, `backend/src/services/ai.ts`, `backend/src/services/quiz.ts`, `backend/src/services/tts.ts`, `backend/src/services/stt.ts`, `frontend/src/api/client.ts`, `eval/m2b1/` để phát hiện drift. Nếu HEAD đúng nhưng schema drift, ngừng tích hợp và báo cáo.

## 2. Tích hợp riêng M2-B2, không ghi đè nguồn

- Đưa dữ liệu kế hoạch vào `eval/m2b2/`, tài liệu EN và VI vào `docs/internal/m2b2/` (hoặc đường dẫn nội bộ tương đương có lý do). Không ghi đè `eval/m2a`, `eval/m2b1`, dữ liệu lexical draft và source historical tests. Không đưa private owner closure vào README công khai.
- Giữ `data/source/` nguyên byte, `data/planning/scenario_decisions.proposed.jsonl` đủ 12 bản ghi, `pilot_plan.proposed.json` đủ 5/4/3 nhóm và số count 46 (ENVI16/VIEN30), `attempt_capture.empty.json` chỉ là template chưa chạy.
- Các `owner_topic_approval`, `owner_mode_approval` vẫn PENDING; `inference_authorization=NOT_AUTHORIZED` trên tất cả case. `reviewers=0`, `sample_count=0`, `semantic_quality=NOT_EVALUATED`. Không thêm kết quả giả vào report.
- Dùng pure `tools/attempt_contract.mjs` để thiết kế _nhận và thống kê_ record. Nó không có network/AI call. Chỉ chạy **synthetic in-memory** qua test; tuyệt đối không gọi app API. Gắn nhãn dữ liệu synthetic; không import synthetic test fixtures vào evaluation dataset hoặc đánh giá model.
- Đối chiếu các enum với **schema thực tế**, không chỉ sao chép các giá trị trong tài liệu. Nếu cần thêm test bundle pure schema như M2-B1, tránh service/provider imports.

## 3. Mở rộng kiểm thử contract nếu cần (không nới guard)

Tập trung vào: đổi trái phép intent, topic/mode, dữ liệu gốc và pin; 5/4/3 grouping; locale `en/vi` vs `uiLocale`; response `partial/returnedCount`, lỗi 429/503/timeout; fallback/cache không phải independent model sample; capture không tự điền chi phí, prompt/model revision, rating. Ghi red/green nếu sửa **logic tooling**; đừng thay đổi assertion chỉ để nhận PASS. Kiểm tra source không có lệnh network, secret access hay đoạn mã cho phép inference qua env flag ẩn.

## 4. Kết quả và Git

- Nếu chỉ nhập data/docs/tools mới: chạy targeted Node tests + CLI tools, Prettier/ESLint trong phạm vi thay đổi nếu đã cấu hình; kiểm tra source unchanged. Không gọi full suite lịch sử là PASS nếu không chạy. Nếu đụng runtime/CI/dependency (ngoài phạm vi) phải **dừng để xác nhận phạm vi** chứ không tự tiến hành.
- Chỉ tạo 1–2 commit local có ý nghĩa nếu thực sự tích hợp; giữ conventional commit và working tree cuối sạch. Không push/merge/rebase. Báo cáo Git diff stat, SHA/parents và sanitized patch; không để bản nháp/các ghi chú nội bộ lộ trong README public.
- Luôn lưu log RED và log FAIL cùng log GREEN, thời gian UTC start/end, exit code, commit SHA trước/sau, ghi rõ simulated vs historical vs newly executed. Đừng ghi `NOT_RUN` là PASS.

## 5. Evidence phải gửi ChatGPT

Xuất một ZIP `adaptive-coach-m2b2-design-evidence-<UTC>.zip` gồm `00_environment/` (ledger, versions), `01_git/` (sha, diffstat, sanitized patch), `02_source/` (7 input hashes, independent compare B1), `03_plan/` (12 decisions, 5/4/3 mapping, owner gates), `04_tests/` (targeted Node logs, negative tests), `05_safety/` (secret scan scope, no inference/network declaration), `06_summary/` (`EXECUTION_SUMMARY.md`, `STATUS.json`, `OPEN_FINDINGS.md`, `NEXT_ACTIONS.md`), root `SHA256SUMS.txt` và optional verification JSON. Không bao gồm `.git`, `.env`, `.dev.vars`, cookies, PAT/tokens, DB thật hay dữ liệu người học thật. Có SHA256 toàn ZIP để đối chiếu.

### Điều kiện thành công

`M2_B2_DESIGN_TECHNICAL_PASS` khi data/proposal/source integrity PASS, 15+ selftests PASS, không thay đổi runtime/protected files, report 0 attempts và 0 reviews, toàn bộ owner mapping/mode vẫn PENDING, không inference, Git sạch, evidence kiểm tra được. **Không tuyên bố `M2_B2_LIVE_PASS`, `M2_QUALITY_PASS` hoặc production readiness.** Sau đó dừng, gửi evidence cho chủ dự án/ChatGPT trước khi lên kế hoạch pilot thật.
