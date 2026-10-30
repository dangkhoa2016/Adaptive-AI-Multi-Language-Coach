# Phase B0: non-operative offline model

This directory is an offline, synthetic, deny-only Phase B0 model retained for independent review.
It is not an execution grant, runtime broker, provider adapter, operational cache or ledger.
`denyOperational` returns DENY for every input without inspecting caller properties.

## Accepted wire grammar

`parseStrictJson(Uint8Array)` parses canonical JSON syntax: a root object, no null,
only integer tokens 0..2147483647, no duplicate decoded keys at any depth, strict
UTF-8 without BOM/lone surrogates, raw bytes <=65536, container depth <=16,
and decoded UTF-8 bytes per string/key <=4096. Output objects have null prototypes.
JCS serialization uses UTF-16 lexicographic key order. This bounded syntax API
is not a closed grant schema and confers no authority.

`parseNonGrantEnvelope` closes that syntax to only the Closure paper payloads:
`{}` or exactly `{a: integer, b: integer}`. `frameNonGrant` accepts only those
canonical byte payloads and returns ASCII(ADAPTIVE_COACH_PHASE_C_S0_EXECUTION_V1),
NUL, U64BE(payload byte length), UTF8(JCS(payload)). These objects cannot be
execution envelopes. All full grant envelopes, keys and signature fields are
rejected. No signing, verification, key generation, enrollment, trust root,
TTL, trusted clock or mTLS implementation is present. Generic syntax permits
Unicode; the closed non-grant grammar has no string values. Future grant ASCII
and field grammar/crypto interoperability remain deferred and are not validated
by the generic syntax parser.

## Exact money and immutable state

Micro-USD canonical decimal strings are 0..9223372036854775807 and parse to BigInt.
Arithmetic is checked, including intermediates; rational rounding is ceiling.
`canReserve` checks project and grant S + all supplied holds + W <= B together
as a pure predicate. Test units/prices are invented; no provider schedule exists.

`createModel` freezes a TEST_ONLY project/scope/grant configuration.
`transition` returns frozen values with `operationalDecision: DENY` for every
outcome. CT01 consumes one logical INITIAL key across grants, without an attempt.
CT02 records a synthetic fixture hit with no hold/slot/outbound allocation.
CT03 can only model an independently bounded cache miss: one hypothetical W,
slot and outbound allocation, without another initial. CT04 terminally denies
missing/invalid proof or capacity. CT05 preserves the original key and any
existing W/slot on ambiguity, halting future admission without retry.

TEST_ONLY markers are invented model parameters, not authenticated evidence.
Claim/policy/dispatch/settlement event ordering is sequential value computation,
not durable storage, concurrent transactions, capability invocation or proof of
physical send fencing. KILL/REVOKE retain outstanding W. Only pre-intent no-send
model proof or synthetic final settlement frees slots; allocations/claims are
never refunded. A charge above W records the actual breach separately and HALTs;
the recorded spent field is not an invoice ledger. UNKNOWN never auto-unhalts.
Restoring a new model cannot prove continuity; no persistence adapter is provided.

## Verification and remaining gates

Only run the six exact Node test paths authorized by the owner. Real RED/GREEN
logs and full untracked patch are exported outside this repository. Static source
inspection is limited and is not a runtime sandbox or actual provider/network
isolation. B0 establishes no real cost cap, provider W, exactly-once send,
trusted cache provenance/content rights, production authority or privacy proof.

Five historical D-02 references are copied byte-for-byte, design-only and not
an execution allowlist. GEN-09 stays initial-only without induced fallback;
GEN-11 stays initial-only without repeats/warming. Supplemental B0-CACHE-01..09
and other tests do not execute the original 43 future negative specifications;
those remain NOT_RUN. IAR-02/03/05 unresolved; G1 design-only, G2-G10 pending;
M2-B2 owner signoff PENDING. Phase B1/C implementation, deployment, inference
and execution grants remain NOT_AUTHORIZED. This Phase B0 local commit grants
no runtime authority. No real learner data, keys, signatures or grants are fixtures.
