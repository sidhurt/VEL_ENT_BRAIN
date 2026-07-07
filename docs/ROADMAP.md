# Unified Brain Roadmap

This document outlines the short-term and long-term milestones for Unified Brain. For the current, active engineering state and technical debt, see [PROJECT_STATE.md](PROJECT_STATE.md).

## Completed

### M0 — Foundations
- Platform-issued JWT authentication; strict deny-by-default routing and identity gating.
- Two logical Neo4j planes with separate session factories; schema stamps (`ownerId`, `constitutionVersion`).
- Traversal-leak fixes (directed fixed-shape queries); safe seeding guardrails.

### Client Brain core (V1 product)
- Per-client knowledge domains with **client walls** (org-membership-bound access, cross-client assembly inexpressible).
- Promotion lifecycle: propose → review → approve/purge, with `PromotionEvent` audit.
- **Document ingestion:** PDF/DOCX/TXT/MD upload → LLM extraction (specificity-tested, confidence-floored, evidence-quoted) → review queue.
- Client-scoped assembly + generation with ExplainabilityReceipts asserting the wall.
- **Google Sign-In** (verified identity) alongside the dev-login scaffold.

## Near Term — to dogfood launch

1. **Embeddings retrieval** — replace lexical ranking with Neo4j vector-index retrieval; the quality milestone the product's first impression depends on.
2. **Client Room UI** — the account manager's single screen: brain browser, ask-with-context with receipt, 10-second review actions, document upload. Includes the **dev-login cutover** to Google-only auth (`ALLOW_DEV_LOGIN=false`).
3. **Pilot hardening** — org roles (reviewer), founder dashboard v0, offboarding runbook, derogation-register review with the design partner.
4. **MCP connector** (post-dogfood) — expose client-aware assembly to employees' existing AI tools instead of competing with them.

Specs for each: [CLIENT_BRAIN_V1.md](CLIENT_BRAIN_V1.md).

## Mid Term — Earning Real Users

- **Real Identity:** OIDC/SSO for authentication, while keeping the constitutional rule that employment grants a membership, never an existence.
- **Physical Plane Separation:** Spin up a second Neo4j instance/database (a simple config change by design) to physically isolate the personal and organizational planes.
- **Org Roles:** Formalize reviewers and governance authors as org-plane data.
- **Witness Disclosure UI:** Turn Article 15 into a visible, manageable product feature.

## Long Term — Constitutional Destinations

These are directions the constitution commits to without requiring amendment:

- **Owner-anchored Identity:** Key-based authentication and recovery ceremonies, removing reliance on platform-issued JWTs.
- **Witness Minimization:** Reasoning migrating into constitutionally trusted compute (tenant-hosted, local, or attested) as model economics allow.
- **N-plane Federation:** Shared project planes, vendor/customer planes, and agent beneficiaries. The constitution already defines the rules (declared governance, declared beneficiary, authority never contagious).
- **External Stewardship:** The company eventually ceasing to be the sole interpreter of its own constitution (a maturity milestone, not a launch requirement).
