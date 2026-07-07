# Unified Brain Roadmap

This document outlines the short-term and long-term milestones for Unified Brain. For the current, active engineering state and technical debt, see [PROJECT_STATE.md](PROJECT_STATE.md).

## Completed

### M0 — Foundations (Shipped & Verified)
- Platform-issued JWT Authentication.
- Two logical Neo4j planes with separate session factories.
- Schema stamps (`ownerId`, `constitutionVersion`).
- Strict deny-by-default routing and identity gating.
- Safe seeding guardrails.

## Near Term — Remaining V1 Milestones

### M1 — Constitutional Assembly
- **Template Registry with CI Lint:** Every retrieval must be a registered, reviewed, parameter-bound query. Variable-length traversals are structurally rejected.
- **In-process Policy Decision Point (PDP):** Role-based and membership-based access evaluation before query execution.
- **Explainability Receipts:** Context packs carrying authorization decision IDs and policy versions.
- *Partner-visible outcome:* Explainable, auditable ContextPacks.

### M2 — The Bridge
- **Reasoning Declarations:** APIs require beneficiary and witness declarations, paired with a disclosure UI ("this reasoning will be witnessed by…").
- **Promotion Workflow:** Propose, org-scoped review, and approve-derives/reject-purges capabilities.
- **Consumption Stubs:** Retraction gating at the constitutional boundary.
- *Partner-visible outcome:* The promotion workflow, which is the product's core trust story.

### M3 — Pilot Hardening
- **Offboarding Runbook:** Sever memberships, verify the personal plane survives intact.
- **Audit Surfaces:** Provide reciprocal visibility to all actors.
- **Derogation Register Review:** Final alignment on derogations (D1-D5) with the design partner before real usage.

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
