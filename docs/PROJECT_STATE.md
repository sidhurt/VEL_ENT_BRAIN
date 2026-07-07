# Project State — Unified Brain

**Last Updated:** 2026-07-06

This document serves as the active engineering journal. It tracks exactly where development currently stands, current decisions, and technical debt. 

*For the high-level roadmap and historical evolutions, see [ROADMAP.md](ROADMAP.md) and [HISTORY.md](HISTORY.md).*

---

## Current Milestone: M0 (Identity & Plane Foundations)
**Status:** Shipped & Verified ✅

The goal of M0 was to lay the foundational identity controls, separate the planes logically within the single database instance, and lock down unauthorized traversals.

### Completed (M0 Rollout)
- **Platform-issued JWT identity:** Every `/api` route (except health/login) requires a token. Caller-asserted `userId` is eliminated across all routes.
- **Self-scope enforcement:** Any route addressing `:userId` returns 403 unless it matches the authenticated principal.
- **Admin gating:** Admin routes are deny-by-default in production (`ADMIN_PRINCIPALS` allowlist). The graph-wipe endpoint is disabled in production.
- **Plane authority layer:** (`backend/src/planes.ts`). Personal/org session factories with env-mapped infrastructure.
- **Traversal-leak fixes:** Undirected variable-length queries replaced with directed fixed-shape templates.
- **Frontend Auth:** Token interceptors added. Workspace authenticates as the user, Enterprise console authenticates as the admin principal (`VITE_ADMIN_PRINCIPAL`).
- **Seed Guardrails:** `seed.ts` now counts nodes and refuses to run against a non-empty database unless `SEED_ALLOW_WIPE=true` is explicitly set.

### Known Issues & Technical Debt
- **Derogation D4 (Platform-issued identity):** Anyone can obtain a token for any principal ID in development because there is no password/OIDC yet. Mitigations: unguessable admin ID in production, and Vercel deployment protection recommended.
- **Admin Console Constitutional Tension:** The per-user Graph and Evolution tabs in the Enterprise Console technically let an org admin view personal context (an Article 19 violation). They currently 403 by design. Founder decision pending: remove tabs or re-scope them to org-plane data only.
- **Derogation D1 (Single Database Instance):** Planes share one physical Neo4j instance, partitioned logically by `ownerId`.
- **Subject Rights (Constitutional Gap):** Cognition is protected for its *originator*; its *subject* (a person mentioned in it) has no protections yet. Deliberately deferred.

### Current Decisions
- **Configurable Admin Identities:** We explicitly rejected defaulting `ADMIN_PRINCIPALS` to a well-known ID like `enterprise-admin` in production because, without OIDC passwords, it acts as a public backdoor. The console principal is now configurable via `VITE_ADMIN_PRINCIPAL`.
- **Guardrails > Documentation:** The database wipe incident proved that documenting a footgun is insufficient. `seed.ts` now programmatically prevents accidental wipes.

## Next Milestone: M1 (Constitutional Assembly)
**Status:** Planning phase

The immediate next objective is to formalize the template registry with CI linting, introduce an in-process Policy Decision Point (PDP), and generate explainability receipts that carry authorization decision IDs and policy versions.

### Open Questions
- **Two-instance cost/ops:** Do we migrate to a multi-database Neo4j deployment for M1 to physically satisfy Derogation D1, or do we maintain logical separation until pilot scale?
- **PDP extraction:** Do we build the PDP in-process first (monolith), or spin it out into a Zanzibar-like sidecar service immediately?
