# Phase B1-P0 — Offline, synthetic, non-operative security model

**Status: TEST_ONLY / operational DENY always.** This directory contains no execution grant, real authorization issuer, runtime capability broker, model provider adapter, audit persistence, Cloudflare sandbox or deployable service. It is not a production security control.

## Scope and reproducibility

The B1-P0 scope is the 16 new files only under `eval/b1-authorization/`. Existing Phase B0 artifacts, `backend/**`, Cloudflare settings, D1/KV, workflows, lockfiles and package scripts must remain unchanged. Node's built-in test runner executes without network:

```sh
node --test eval/b1-authorization/test/*.test.mjs
node --test eval/authorization/test/*.test.mjs
```

Use a clean recovery branch at commit `b8296256d9414cf5327573fb01793663527928c6` as baseline. Store raw results, SHA256 and git status outside the public repository. No Git commit or push is implied by implementing these files.

## Explicit non-authority boundaries

- `contracts/grant-wire.mjs` delegates to B0's **non-grant** closed paper grammar (`{}` or `{"a":1,"b":2}`); `framePaperBoundary` has no signer, grant parser or trusted root. Wire vectors use B0's `domain || NUL || U64BE(length) || canonical JSON` and are not a grant.
- `contracts/release-binding.mjs` compares two fake hex digests; neither digest is measured by an attestation authority. Caller-supplied digests are never authority.
- `crypto/verify-test-only.mjs` uses Node crypto to observe a signature from a test-only ephemeral Ed25519 key; test public keys are injected by the harness and are not an enrolled trust root. Successful test signature verification **never** authorizes a model call. Keys never leave the test process.
- `identity/pop-test-only.mjs` compares non-cryptographic fake subject/nonce markers; no real PoP, PKI, mTLS, replay storage, clock or revocation registry.
- `money/finite-w-gate.mjs` uses invented `TEST_ONLY` rates and explicit input/output/hidden-unit maxima multiplied by 1–3 possible sends; no selected provider/model/revision, billable-unit proof or USD cap. Outputs are hypothetical microUSD only.
- `ledger/serialized-simulator.mjs` models optimistic version fencing, one initial per scenario, synthetic reserve/project+grant holds, PREPARE→fake ACK→modeled DISPATCH, KILL/REVOKE/UNKNOWN and fake settlement. No atomic inter-process transaction, crash recovery, remote audit anchor or actual outbound send.
- `audit/anchor-simulator.mjs` is a local in-memory hash chain, **not** independent or durable audit trust. `egress/negative-capabilities.mjs` performs a pure allowlist check and never intercepts platform `fetch`, `connect` or service bindings. It deliberately throws before calling a supplied outbound callback.

## Operational invariants

Each exported observation/state transition yields `operationalDecision: 'DENY'`. For malformed data, tests use rejection or fail-closed observations. Synthetic `TEST_ONLY_RESERVED` or `TEST_ONLY_MODELED_DISPATCH` are **model outcomes only**, not authorization to reserve real funds, send network requests or persist learner data. A valid fake anchor ACK is not a real anchor. A failed/ambiguous outbound receipt must retain its hold and halt; restore continuity cannot be assumed.

## Protected decisions and unverified gates

Five exact design pins for GEN-04, GEN-06, GEN-07, GEN-09, GEN-11 remain **owner-approved design only**; GEN-09 permits no induced fallback and GEN-11 permits no repeat. Seven other GEN scenarios are pending. The original 43 Phase A future negative specifications remain **NOT_RUN**, notwithstanding any B1 negative tests. Historical Phase B0 41/41 synthetic tests are a separate result. IAR-02 root+PoP, IAR-03 finite actual W and IAR-05 enforced no-bypass egress remain **NOT_VERIFIED**. G1 design-only, G2–G10 pending; M2-B2 full signoff, Phase C inference and deployment are **NOT_AUTHORIZED**.

## Threat-model limitations

Static capability names are not an enforcement boundary. Without a proof from the actual Cloudflare account and runtime, Dynamic Workers `globalOutbound: null` is a documented potential topology, not acceptance. SQLite Durable Object transactions do not include external provider side effects. Test-only signature verification and value-model serialization cannot prove trustworthy release enrollment or exactly-once physical dispatch. Do not rebrand these tests as production protections.
