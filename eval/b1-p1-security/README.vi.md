# B1-P1 — Thiết kế kiểm chứng bảo mật bằng mô phỏng offline

**Phạm vi:** IAR-02, IAR-03 và IAR-05. **Trạng thái:** chỉ thiết kế và kiểm thử SYNTHETIC / NON-OPERATIVE theo phê duyệt offline của chủ dự án. Mọi kết quả đều mang `operationalDecision: DENY`; module tích hợp luôn trả `runtimeAuthority: false`. Test PASS hoặc quan sát test-only đúng **không cấp quyền** gọi inference, tạo grant thực, kết nối provider, ghi D1 remote, thanh toán, triển khai hay sử dụng credential thực.

## Cách kiểm thử

Từ thư mục gốc repository (Node.js 22, không gọi dịch vụ bên ngoài):

```sh
node --test eval/b1-p1-security/test/*.test.mjs
node --test eval/authorization/test/*.test.mjs eval/b1-authorization/test/*.test.mjs eval/b1-p1-security/test/*.test.mjs
./node_modules/.bin/eslint eval/b1-p1-security
./node_modules/.bin/prettier --check eval/b1-p1-security
```

Thư mục P1 tách biệt và cùng cấp với B0, B1-P0; tuyệt đối không sửa hai cây đã PASS. Chạy PASS không đồng nghĩa được phép commit/push/deploy.

## IAR-02 — Chữ ký, trust root và danh tính giả lập

`contracts/synthetic-root.mjs` kiểm chứng chữ ký Ed25519 trên **non-grant paper envelope** từ B0. Root snapshot do test cung cấp, chứa hash public key, release digest, cờ revoked và epoch. Ed25519 key sinh tạm thời trong tiến trình test; không lưu hoặc đưa key vào evidence. Bởi snapshot do bên gọi tự khai báo, **đây chưa phải trusted root đã enrollment độc lập**; chữ ký khớp không tạo quyền thực thi. Chưa có grant schema thực, custody, proof of possession thật, attestation hay revocation store tin cậy.

`identity/synthetic-challenge.mjs` thử subject, audience, nonce, epoch, thời hạn theo _tick giả lập_ và danh sách nonce đã dùng trong bộ nhớ. Phép thử có thể phát hiện replay, lệch danh tính, quá hạn nhưng **chưa có trusted clock, replay ledger bền vững, mTLS/PoP thật**. Proof marker cố ý không mang yếu tố mật mã.

## IAR-03 — Ràng buộc chi phí W worst-case giả lập

`money/synthetic-worst-case.mjs` bắt buộc có bốn nhóm charge giả `input/output/hidden/tool` và phí cho từng lần gửi. Mỗi nhóm làm tròn riêng; cộng phí rồi nhân `maxSends` từ 1 đến 3, không mặc định rằng lỗi 429 hoặc retry được miễn phí. Tái sử dụng số nguyên microUSD có kiểm tra overflow của B0 và predicate `spent + holds + W <= cap` đồng thời ở project và grant. Thiếu thông tin giá, thiếu nhóm charge, sai model/revision, số không hợp lệ, giá bằng 0 không đủ chứng cứ, vượt cap sẽ fail closed.

**Giới hạn:** Giá và token đều tự đặt cho test, **không phải bảng giá hoặc hóa đơn của provider**. Chưa chọn model/revision, price version/region, mức USD owner phê duyệt, cam kết billing reasoning ẩn hoặc trạng thái billable của retry. Module không reserve tiền thật.

## IAR-05 — Mô hình sơ đồ egress/binding giả lập

`egress/synthetic-topology.mjs` chỉ đối chiếu sơ đồ tĩnh `runner → broker → provider/ledger/audit`, runner chỉ có binding `TEST_ONLY_BROKER`, không có global outbound hoặc connect. Nó từ chối đường nối trực tiếp runner/provider, binding mở rộng và unknown edge. Đây **không phải sandbox**: không chặn `fetch/connect` thật, chưa chứng minh Workers Paid/Dynamic Workers, chưa deploy hay cấu hình `globalOutbound: null`, chưa tồn tại broker runtime. Hàm fake adapter ném lỗi trước khi gọi callback được truyền vào.

## Điều kiện nghiệm thu và giới hạn

`contracts/synthetic-coordination.mjs` cho phép tổng hợp nhiều kết quả test-only để kiểm tra logic, nhưng luôn `DENY` và `runtimeAuthority: false`. Exception từ dữ liệu đưa vào phải fail closed. Evidence cần chứa logs gốc, SHA256, nhánh và commit, trạng thái Git và thiết bị; không chứa khóa/credential. **43 original Phase A negative specifications vẫn NOT_RUN**, không bị thay thế bởi các test mới.

| Gate   | Kết quả mô phỏng có thể kiểm chứng                    | Runtime thực |
| ------ | ----------------------------------------------------- | ------------ |
| IAR-02 | Paper signature, revoke/release/nonce/epoch synthetic | NOT_VERIFIED |
| IAR-03 | W nhân theo tất cả lượt gửi, giá/budget synthetic     | NOT_VERIFIED |
| IAR-05 | Static graph không cho bypass trên dữ liệu giả        | NOT_VERIFIED |

G1 chỉ **DESIGN-ONLY** cho GEN-04/06/07/09/11. GEN-09 không được tự tạo fallback; GEN-11 không được repeat. G2–G10 vẫn PENDING; M2-B2 đầy đủ và Phase C chưa được phê duyệt. Muốn có trusted root thật, chi phí provider, chạy sandbox, dùng D1 remote hay inference phải xin phê duyệt owner riêng. Một transaction nội bộ không thể bảo đảm exactly-once side effect bên provider.
