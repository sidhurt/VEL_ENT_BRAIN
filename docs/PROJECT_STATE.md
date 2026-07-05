# Unified Brain — Project State & Direction

**As of: 2026-07-06** · Companion documents: [CONSTITUTION.md](CONSTITUTION.md) (the philosophy, ratified v1.0) · [V1_ARCHITECTURE.md](V1_ARCHITECTURE.md) (the engineering derivation)

This document is the single entry point for understanding what Unified Brain is,
what exists today, and where it is going. It is written for a mixed audience —
founder, future engineers, and design partners.

---

## Part 1 — What Unified Brain is

### The problem: context deficiency

Every AI interaction today begins from an information vacuum, while the humans and
organizations behind it hold years of accumulated context — projects, policies,
relationships, decisions, style, history. The hard problem is not *retrieving* that
context. It is **legitimacy**: deciding what context may lawfully participate in a
given act of reasoning, for a given principal, at a given moment.

### The product

**Unified Brain is a constitutional context operating system.** Its single
responsibility is answering:

> Given this principal, at this moment, under these policies, what is the
> highest-quality context that can legitimately participate in reasoning?

It assembles that context into a ContextPack, injects it into an LLM interaction,
and produces an ExplainabilityReceipt proving why every item was included.

### What it is deliberately NOT

- **Not a second brain** — personal persistent context is an enabled capability, not the identity.
- **Not an enterprise wiki** — institutional memory is an enabled capability, not the identity.
- **Not a knowledge marketplace** — possibly a future application, not the philosophy.

### The philosophy in nine sentences

The full 26-article constitution is in [CONSTITUTION.md](CONSTITUTION.md). Its spine:

1. **Legitimacy constrains utility.** No reasoning process is entitled to context merely because it would improve the answer. Deny is the default.
2. **Ownership precedes governance.** Individuals own their cognition; organizations own organizational knowledge. Governance regulates interaction between owners — it never redefines ownership.
3. **Promotion, not discovery.** Knowledge becomes organizational only through a deliberate, reviewed act — never because it was reachable, typed at work, or useful.
4. **Consumption grants use, plus obligations — never ownership.** Reading org knowledge creates provenance obligations on derivatives; it never entitles the org to the reader's thinking.
5. **The enclave is absolute where it exists.** Un-promoted cognition is readable by no one — not admins, not legal process, not ThinkVelocity. Tenants choose *whether* a cognition space exists, never how sovereign it is. No fake enclaves; no secret panopticons.
6. **Witnessing is a constitutional act.** Every party able to observe reasoning (including LLM providers) must be named, disclosed, and revocable. The platform's long-term direction is minimizing required witnesses.
7. **Every reasoning act declares its beneficiary before execution.** Agents are instruments, not principals; authority is never contagious.
8. **Metadata is classified by what it reveals**, not how it is implemented. Derivative counts, timing, and activity levels of cognition *are* cognition.
9. **Enforcement honesty.** The platform claims no impossibilities — it commits to making violations detectable, attributable, and non-deniable, and the burden of proof always rests with the stronger party.

### Two deployment models (one constitution)

- **Enterprise Knowledge Workspace** — everything produced is organizational from inception; no cognition enclave; fully disclosed. For organizations requiring total visibility.
- **Enterprise Cognition Workspace** — a constitutionally protected personal enclave exists; promotion is the only bridge into org knowledge. The org knowingly accepts that un-promoted cognition is outside its sight.

An organization may pick either. It may never buy a weakened enclave.

---

## Part 2 — The architecture (derived, not invented)

Decision AQ1: **Federated Constitutional Planes.** The graph is not one brain — it is
a federation of sovereign planes connected by governed bridges.

- **Personal plane** — cognition, drafts, candidates, personal memory. Owned by the person; survives employment.
- **Org plane** — promoted KnowledgeObjects, policies, projects, teams, memberships. Owned by the organization.
- **The promotion bridge** — the only crossing. Propose (owner-consented) → review (org governance) → approve derives a *new* org-owned object (the original cognition never transfers) / reject purges the proposal.
- **The Assembly Engine** — the only component allowed to span planes. Core invariant: **it composes pre-authorized fragments; it never filters over-authorized ones.** Authorization is computed *before* retrieval as registered, parameter-bound query templates. Post-filtering is the failure mode this entire design exists to kill.

Planes are a separation of **authority**, not necessarily infrastructure: today both
map to one Neo4j instance (disclosed as Derogation D1); the code cannot tell, so the
physical split later is a config change, not a rewrite.

Full detail, ten testable invariants (I1–I10), threat model, and contracts:
[V1_ARCHITECTURE.md](V1_ARCHITECTURE.md).

---

## Part 3 — State of the implementation (today)

### Stack

React/Vite frontend · Express/TypeScript backend · Neo4j Aura (graph) ·
OpenAI gpt-4o-mini (reasoning witness) · Vercel (auto-deploy on push to GitHub).

### Shipped — Milestone M0 (identity & plane foundations) ✅

- **Platform-issued JWT identity.** Every `/api` route (except health/login) requires a token. Identity comes from the token, never from the caller's body or params — caller-asserted `userId` is eliminated across all routes.
- **Self-scope enforcement.** Any route addressing `:userId` returns 403 unless it matches the authenticated principal.
- **Admin gating.** Admin routes are deny-by-default in production (`ADMIN_PRINCIPALS` allowlist); dev mode is permissive with a logged warning. The graph-wipe endpoint is additionally disabled outright in production.
- **Plane authority layer** (`backend/src/planes.ts`). Personal/org session factories with env-mapped infrastructure; startup logs which mode is active.
- **Traversal-leak fixes.** The undirected variable-length graph query that exposed colleagues' personal subgraphs is replaced with six directed fixed-shape templates. The trust queue, previously visible to any caller across all orgs, is scoped to the reviewer's organization.
- **Constitution stamps.** New Artifacts and Candidates carry `ownerId` and `constitutionVersion` (Invariant I10 begins).
- **Frontend auth.** Token interceptors; the workspace authenticates as its user; the enterprise console authenticates as the admin principal.

Earlier hardening (pre-M0): hardcoded database credentials removed from source
(fail-fast on missing env), dead components deleted, duplicate routes consolidated.

### Verified

Both codebases type-check clean. Live smoke test: health 200 unauthenticated,
protected routes 401 without token, 403 on identity mismatch, token issuance and
authenticated data access working.

### Deployed

Vercel auto-deploys on push. Required production env vars: `JWT_SECRET`,
`ADMIN_PRINCIPALS`, `NEO4J_URI/USER/PASSWORD`, `OPENAI_API_KEY`. Env var changes
require a redeploy to take effect.

### Known tensions & open items (honest register)

| # | Item | Status |
|---|------|--------|
| 1 | **Neo4j password rotation.** The database password currently in use is the same one that was exposed in git history. Stripping it from source did not un-expose it. | ⚠️ **Rotate in the Aura console, then update `backend/.env` and Vercel env, then redeploy. Highest-priority open item.** |
| 2 | **Dev-grade login (Derogation D4).** Anyone can obtain a token for any principal id — no password/OIDC yet. Mitigations: unguessable admin id, Vercel deployment protection recommended. | Acceptable for guided demos only; OIDC required before any external user |
| 3 | **Admin console constitutional tension.** The per-user Graph and Evolution tabs let an org admin view personal context — an Article 19 violation. They now 403 by design. | Founder decision pending: remove the tabs, or re-scope them to org-plane data |
| 4 | **Subject rights** (constitutional gap). Cognition is protected for its *originator*; its *subject* (a person mentioned in it) has no protections yet. | Open constitutional question, deliberately deferred |
| 5 | Planes share one Neo4j instance (Derogation D1); operator can technically read data (D2); external LLM witness (D3). | Disclosed derogations with stated exit paths — see V1_ARCHITECTURE.md §8 |

---

## Part 4 — Where to take it

### Near term — remaining V1 milestones

- **M1 — Constitutional assembly.** Template registry with CI lint (every retrieval is a registered, reviewed, parameter-bound query — the authorization *vocabulary*, kept small); in-process Policy Decision Point; fail-closed assembly; receipts carrying authorization decision ids and policy versions. *Partner-visible: explainable, auditable ContextPacks.*
- **M2 — The bridge.** Beneficiary and witness declarations in the API with a disclosure UI ("this reasoning will be witnessed by…"); the promotion workflow — propose, org-scoped review, approve-derives/reject-purges; consumption stubs and retraction gating. *Partner-visible: the promotion workflow, which is the product's core trust story.*
- **M3 — Pilot hardening.** Offboarding runbook (sever memberships, verify personal plane survives), audit surfaces with reciprocal visibility, derogation-register review with the design partner.

### Mid term — earning real users

- **Real identity (OIDC/SSO for authentication)** while keeping the constitutional rule: employment grants a membership, never an existence — offboarding must never lock a person out of their own cognition.
- **Physical plane separation** (second Neo4j instance/database) — a config change by design.
- **Org roles** (reviewer, governance author) as org-plane data.
- **Witness disclosure and revocation UI** — turning Article 15 into a visible product feature.

### Long term — the constitutional destinations

These are directions the constitution commits to without requiring amendment:

- **Owner-anchored identity** with recovery ceremony (keys, not accounts).
- **Witness minimization** — reasoning migrating into constitutionally trusted compute (tenant-hosted, local, attested) as model economics allow.
- **N-plane federation** — shared project planes, vendor/customer planes, agent beneficiaries — the constitution already defines the rules (declared governance, declared beneficiary, authority never contagious); the architecture is named for it.
- **External stewardship** — the company eventually ceasing to be the sole interpreter of its own constitution (a maturity milestone, not a launch requirement).

### The strategic posture

The constitution is the product's deepest design document, **not its marketing
narrative**. The immediate objective is not to win an argument about AI governance —
it is to earn a first design partner by proving a concrete claim: an AI product that
knows your context *and can prove every piece of it entered legitimately* is more
valuable to an enterprise than one that merely knows more. Legitimacy constrains
utility — and the bet is that trust compounds while indiscriminate context gathering
does not.

---

## Document map

| Document | Role |
|----------|------|
| [CONSTITUTION.md](CONSTITUTION.md) | The law — 26 articles, ratified v1.0, entrenched core |
| [V1_ARCHITECTURE.md](V1_ARCHITECTURE.md) | The engineering derivation — invariants, schemas, contracts, threat model, derogations, milestones |
| PROJECT_STATE.md (this) | The state and the direction |
