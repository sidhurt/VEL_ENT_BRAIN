# Unified Brain — History & Evolution

This document tracks the repository evolution, engineering reviews, cleanup summaries, hardening efforts, and architectural decisions over time.

For the original constitutional derivations, see `docs/design-history/`.

---

## 2026-07-06 — Milestone 0 (M0) Rollout Incidents

The M0 transition focused on Identity & Plane Foundations. The following incidents and subsequent hardening efforts occurred:

1. **The Database Wipe Footgun:**
   - **Incident:** `npm run seed` executed `neo4j-init.cypher`, whose first statement wiped the entire database via a `DETACH DELETE` query. It was run against the live Aura instance and destroyed real data (which was subsequently recovered via an Aura snapshot).
   - **Resolution:** The seed script was rewritten to count nodes and refuse to run against a non-empty database unless `SEED_ALLOW_WIPE=true` is explicitly set in the environment.

2. **The Production Admin Gate 403 Lockout:**
   - **Incident:** The production admin gate returned `403 Forbidden` for the Enterprise Console because the `ADMIN_PRINCIPALS` environment variable in Vercel didn't match the frontend console's hardcoded login principal.
   - **Hotfix Attempt (Reverted):** An AI assistant hotfixed this by hardcoding a fallback to `enterprise-admin` in production. This was quickly identified as a massive security backdoor, as login is currently unauthenticated (Derogation D4). Anyone on the internet could type `enterprise-admin` and get full admin access.
   - **Resolution:** The backdoor was reverted. The console principal was made configurable via `VITE_ADMIN_PRINCIPAL`. Production now strictly fails closed if variables are unset.

3. **Admin User-Provisioning Overwrite:**
   - **Incident:** Admin user-provisioning silently overwrote the admin's own graph. M0 moved identity to the JWT token, but the frontend was still using the personal onboarding endpoint to provision *other* users. Since the frontend was logged in as the admin, the backend ignored the form body and just reprovisioned the admin over and over.
   - **Resolution:** Fixed by creating a dedicated `POST /api/admin/provision-user` endpoint.

*Lesson learned and codified: Seeds must programmatically guard against non-empty databases. Admin identity must be injected configuration, never a hardcoded default.*

---

## The Derogation Register (V1)

These are honest deviations from the constitutional destination established during the V1 architecture phase. Each is disclosed, bounded, and has a stated exit path.

| # | Derogation | Constitutional destination | V1 reality | Exit path |
|---|-----------|---------------------------|------------|-----------|
| **D1** | Personal planes share one instance, partitioned logically by `ownerId` | Per-principal physical sovereignty | Query-construction + audit tier | Physical/crypto separation at scale |
| **D2** | Operator can technically read personal plane | Article 10 operator-constrained via owner keys | Access separation, audit logging, explicitly disclosed | Owner-held encryption keys |
| **D3** | External LLM witness (e.g. OpenAI) | Article 18 witness minimization | Named, disclosed, zero-retention contract | Tenant-hosted / locally attested models |
| **D4** | Platform-issued identity | Owner-anchored + recovery ceremony | JWT/OIDC; export survives suspension by process | Key-anchored identity |
| **D5** | Enforcement is application-tier | Article 25 "detectable, attributable, non-deniable" at architecture tier | Template registry + audit stream provide detectability/attribution | Progressive hardening per milestone |
