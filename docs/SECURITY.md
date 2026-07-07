# Security

The security model, the threat model it targets, and an honest register of current
derogations. Philosophy: **deny is the default, failures close, and every deviation
from the destination architecture is documented rather than hidden.** Enforcement
claims follow the project's own standard — *detectable, attributable, non-deniable* —
never "impossible."

## 1. Security model summary

| Layer | Mechanism | Detail |
|-------|-----------|--------|
| Identity | Google ID-token verification + platform JWT | [AUTHORIZATION.md](AUTHORIZATION.md) §1 |
| Route access | `requireAuth` on all API routes; identity only from token | 401 without token, 403 on identity mismatch |
| Admin surface | Deny-by-default allowlist; no production default; wipe endpoint disabled in production | |
| Data isolation | Ownership-bound, fixed-shape graph queries; client walls resolved through caller's own membership | [KNOWLEDGE_GRAPH.md](KNOWLEDGE_GRAPH.md) §5 |
| Knowledge lifecycle | Nothing becomes shared without explicit review; rejections are purged; reviews are audited (`PromotionEvent`) | |
| Receipts | Every assembly result lists exactly what entered and asserts the isolation boundary | [EXPLAINABILITY_RECEIPT.md](EXPLAINABILITY_RECEIPT.md) |
| Secrets | No credentials in source; server fails closed on missing `NEO4J_*` / `JWT_SECRET` (production); `.env` files untracked | |
| Destructive ops | Seed script refuses to run against a non-empty database without `SEED_ALLOW_WIPE=true` | |

## 2. Threat model (current scope: single-org dogfood)

| Adversary | Posture |
|-----------|---------|
| Curious insider (same org) | Personal planes structurally unreachable from org endpoints; client access requires membership; admin routes gated |
| Cross-client leakage (the agency case: competing client accounts) | Client walls — assembly is bound to exactly one client per request; the receipt asserts it per output |
| Malicious prompt author | Prompts influence *ranking only*, and ranking selects among already-authorized items; the attacker's influence is bounded by their own authorization |
| Graph poisoning via LLM extraction | Extracted candidates land in the proposer's own space; entry into shared knowledge requires human review at the promotion boundary |
| Stolen backend credentials | Full compromise reads the shared instance (see D1/D2). Plane credentials are separable by env when planes split |
| LLM provider | A **declared witness** (D3): context sent for generation transits OpenAI; disclosed, not hidden |

Out of scope until the relevant features exist: agent delegation (no agents),
multi-org federation (single tenant), mosaic/aggregation inference.

## 3. Derogation register

Deliberate, disclosed deviations from the destination architecture — each with an
exit path. This register is shown to design partners rather than hidden from them.

| # | Derogation | Current reality | Exit |
|---|-----------|-----------------|------|
| D1 | Planes share one Neo4j instance | Logical separation (ownership-bound queries) | Per-plane databases via `planes.ts` env mapping — config, not code |
| D2 | Operator can read data | No owner-held encryption | Owner-keyed enclaves (long-term) |
| D3 | External LLM witness | OpenAI processes assembled context | Configurable models today; tenant-hosted/attested compute later |
| D4 | Identity-asserted dev login still enabled in production | Needed by the Enterprise Console; gated by `ALLOW_DEV_LOGIN` | Google-only cutover when Client Room ships |
| D5 | Enforcement is application-tier | Query discipline + audit, no cryptographic proof | Template registry + PDP (next milestone), attestation (long-term) |

## 4. Incident history (kept deliberately)

Security posture is demonstrated by how incidents were handled, not by their absence:

- **Credential exposure.** Early commits hardcoded Neo4j credentials in
  `backend/src/db.ts`; they remain in git history. Fixed forward: credentials are
  env-only and the server fails closed without them. **Anyone granted repository
  access should be assumed able to read the historical credentials — rotate the
  database password before or upon sharing this repository.**
- **Destructive seed.** `npm run seed` once wiped a live database (the init script
  begins with `MATCH (n) DETACH DELETE n`). Fixed structurally: the seed now
  refuses non-empty databases unless explicitly forced. Lesson encoded: guardrails
  over documentation.
- **Admin default regression.** A hotfix once defaulted the production admin
  allowlist to a well-known id — a backdoor given credential-less login. Reverted;
  production has no default admin and never will while login is unverified.

Full narrative: [PROJECT_STATE.md](PROJECT_STATE.md) incident log.

## 5. Reporting

Private repository; report issues directly to the maintainer rather than via
public issue tracker.
