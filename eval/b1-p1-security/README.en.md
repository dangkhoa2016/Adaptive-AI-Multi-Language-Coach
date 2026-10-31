# B1-P1 — Offline security proof-design experiments

**Scope:** IAR-02, IAR-03 and IAR-05. **Status:** SYNTHETIC / NON-OPERATIVE / OWNER APPROVED FOR OFFLINE DESIGN ONLY. All returned observations include `operationalDecision: DENY`, and the composition explicitly returns `runtimeAuthority: false`. A positive test-only observation **never** authorizes inference, an execution grant, network egress, billing, a production deployment or D1 remote access.

## Run the tests

From the repository root (Node.js 22; no third-party service calls):

```sh
node --test eval/b1-p1-security/test/*.test.mjs
node --test eval/authorization/test/*.test.mjs eval/b1-authorization/test/*.test.mjs eval/b1-p1-security/test/*.test.mjs
./node_modules/.bin/eslint eval/b1-p1-security
./node_modules/.bin/prettier --check eval/b1-p1-security
```

The new directory is a sibling of B0 and B1-P0. Neither protected subtree should be edited. No commit, push or deployment is implied by a successful run.

## IAR-02: Synthetic root/signature/identity

`contracts/synthetic-root.mjs` verifies an Ed25519 signature over B0's **non-grant paper envelope** via a caller-provided TEST_ONLY public-key snapshot with a key fingerprint, revocation flag, release digest, and epoch. Test fixture keys are ephemeral, generated in-process only; no private/public key material is committed or exported. The root snapshot is controlled by the test caller, **not independently enrolled or authenticated**; thus a matching signature has no security authority. No production grant grammar, signer issuance, PoP key custody or release attestation exists.

`identity/synthetic-challenge.mjs` compares fake subjects, audience, nonce, epoch and time ticks against an in-memory used-nonce list. It models replay/expiry rejection but neither has a trusted clock nor a durable replay ledger. The proof is deliberately a **non-cryptographic marker**, not PoP or mTLS. Wrong signer/release/epoch, revoked root, malformed payload, replay and stale challenge fail closed.

## IAR-03: Synthetic worst-case exposure W

`money/synthetic-worst-case.mjs` requires a closed, invented price schedule and known upper bounds for four invented charge categories: input, output, hidden and tool; plus a per-send fee. Each category rounds independently and the sum is multiplied by `maxSends` (1–3), conservatively treating every send as potentially billable. B0's checked microUSD integer arithmetic and joint project/grant `spent + holds + W <= cap` predicate are reused. Unknown field, missing price, unspecified billable dimension, zero units, mismatched model/revision, unsafe integer, overflow or exceeded cap are rejected.

**Limits:** TEST_ONLY fabricated units/prices are not a provider quote. There is no real selected model revision, regional billable schedule, provider confirmation about retries/hidden reasoning or real numeric owner USD cap. The test result does not create a reservation or charge money.

## IAR-05: Synthetic egress boundary

`egress/synthetic-topology.mjs` validates a closed graph for `runner → broker → provider/ledger/audit`, a runner with only fake `TEST_ONLY_BROKER` binding, `globalOutbound: none`, and `connectAvailable: false`. Direct runner/provider and extra binding edges are rejected. This is a **static graph observation only**: it does not enforce Cloudflare Dynamic Workers `globalOutbound: null`, prevent true `fetch/connect`, remove actual service bindings, check account Workers Paid eligibility or implement a broker. The fake adapter rejects the call without invoking a supplied callback.

## Composition, evidence and remaining gates

`contracts/synthetic-coordination.mjs` combines all synthetic observations but still returns `operationalDecision: DENY` and `runtimeAuthority: false`; unexpected input exceptions fail closed. Use negative-test logs and SHA256 of the exact source/fixture/commit as provenance. Do not claim a runtime PASS because tests are green. Original 43 Phase A negative-test specifications remain NOT_RUN and are **not replaced** by these P1 tests.

| Gate   | Offline claim                                                            | Runtime status |
| ------ | ------------------------------------------------------------------------ | -------------- |
| IAR-02 | Paper signature, revocation, release, nonce/epoch failures modeled       | NOT_VERIFIED   |
| IAR-03 | Invented complete tariffs and worst-case W, joint cap arithmetic modeled | NOT_VERIFIED   |
| IAR-05 | Closed static graph and bypass patterns rejected                         | NOT_VERIFIED   |

G1 remains design-only for GEN-04/06/07/09/11, not a runtime approval. GEN-09 has no induced fallback and GEN-11 no repeats. G2–G10 remain PENDING. M2-B2 full signoff and Phase C remain NOT_AUTHORIZED. Any real signing keys/trust-root enrollment, paid resource, provider request, D1 remote use, egress or deploy need a **separate explicit owner approval**. A provider-side effect cannot be made transactional with a local ledger merely by passing these tests.
