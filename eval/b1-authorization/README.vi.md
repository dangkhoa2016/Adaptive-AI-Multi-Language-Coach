# Phase B1-P0 — Mô hình bảo mật offline, synthetic, không có quyền vận hành

**Trạng thái: TEST_ONLY / luôn DENY khi vận hành.** Thư mục này không chứa grant thực, bộ cấp quyền thực thi, runtime broker, provider adapter, audit bền vững, sandbox Cloudflare hoặc dịch vụ có thể deploy. Không được xem đây là cơ chế bảo vệ production.

## Phạm vi và chạy lại

Chỉ có 16 file B1-P0 mới nằm dưới `eval/b1-authorization/`. Không sửa B0 hiện hữu, `backend/**`, D1/KV, cấu hình Cloudflare, workflow, package/lockfile. Chạy Node tests offline:

```sh
node --test eval/b1-authorization/test/*.test.mjs
node --test eval/authorization/test/*.test.mjs
```

Baseline branch recovery commit `b8296256d9414cf5327573fb01793663527928c6`. Log, hash SHA256, trạng thái git nằm ngoài repository công khai. Chưa có chủ trương commit/push từ kết quả mô hình.

## Các ranh giới tuyệt đối

- `grant-wire.mjs`: sử dụng lại parser B0 cho **non-grant paper grammar** (chỉ `{}` hoặc `{"a":1,"b":2}`). Không parse grant, không signing authority; framing chỉ là byte test.
- `release-binding.mjs`: so sánh hai digest giả; không đo release bằng trusted CI attestation. Digest bên gửi đưa tới không tạo thẩm quyền.
- `verify-test-only.mjs`: Node crypto kiểm tra chữ ký của key Ed25519 tạm thời do test tự sinh; test public key không phải enrolled trust root; chữ ký test đúng vẫn **không cho phép inference**.
- `pop-test-only.mjs`: kiểm tra marker subject/nonce giả, không có mTLS, PoP thực, trusted clock hoặc replay ledger.
- `finite-w-gate.mjs`: giá và đơn vị giả TEST_ONLY, cộng input/output/hidden units với 1–3 lượt send giả. Chưa chứng minh billable worst-case W của provider thực, hard cap USD hoặc chọn model/revision.
- `serialized-simulator.mjs`: mô phỏng version/CAS, một INITIAL cho scenario, reserve song song project+grant, PREPARE→ACK giả→DISPATCH mô phỏng, KILL/REVOKE/UNKNOWN và settlement giả. Không có durable storage hoặc atomicity qua mạng.
- `anchor-simulator.mjs`: hash chain bộ nhớ, **không phải independent durable audit anchor**. `negative-capabilities.mjs` kiểm tra tên capability thuần túy, **không chặn thực tế** `fetch`, `connect` hay binding Cloudflare, và không gọi callback outbound.

## Các điều kiện bắt buộc

Mọi module trả `operationalDecision: 'DENY'`. Dù test ghi `TEST_ONLY_RESERVED` hoặc `TEST_ONLY_MODELED_DISPATCH`, đó chỉ là trạng thái giả, không có outbound, chi phí, quyền truy cập dữ liệu hoặc persist. Fake anchor không tạo ACK đáng tin cậy. UNKNOWN luôn giữ W và halt. Không suy diễn continuity sau restore.

## Quyết định đã bảo lưu

Năm design pins GEN-04/06/07/09/11 mới là **owner-approved design-only**. GEN-09 không được tự tạo fallback; GEN-11 không có repeat. Bảy scenario khác vẫn pending. **43 negative specs Phase A gốc vẫn NOT_RUN**; B1 tests không thay thế chúng. Kết quả B0 41/41 PASS là một nhóm riêng. IAR-02 trust roots/PoP, IAR-03 hard USD W thực và IAR-05 no-bypass egress vẫn NOT_VERIFIED. G1 design-only, G2–G10 pending; M2-B2 full signoff, Phase C và deploy vẫn NOT_AUTHORIZED.

## Giới hạn tính đúng đắn

Static check tên capability không phải sandbox. Cloudflare Dynamic Workers `globalOutbound: null` là khả năng theo tài liệu, chưa kiểm chứng trên tài khoản/runtime thực. Durable Object SQL transaction không bao trùm lệnh gửi provider bên ngoài. Test signatures/serialized model không chứng minh thẩm quyền hoặc physical exactly-once. Tuyệt đối không quảng bá prototype thành lớp bảo mật production.
