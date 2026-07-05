# Unified Brain — V1 Production Architecture

**Derived from:** [CONSTITUTION.md](CONSTITUTION.md) v1.0 and decision AQ1 (Federated Constitutional Planes).
**Optimized for:** earning the first design partner. Every deviation from the constitutional
destination is recorded in the Derogation Register (§8) — disclosed, never silent.

---

## 1. Architecture summary

V1 implements Federated Constitutional Planes as **two plane types, one bridge type**:

```
┌──────────────────────┐         ┌──────────────────────┐
│   PERSONAL PLANE     │         │      ORG PLANE       │
│  (Neo4j instance P)  │         │  (Neo4j instance O)  │
│                      │         │                      │
│  cognition, drafts,  │ promo-  │  KnowledgeObjects,   │
│  candidates, personal│ tion    │  Policies, Projects, │
│  projects/tasks/     │ bridge  │  Teams, Memberships, │
│  styles, consumption │ ──────► │  PromotionProposals, │
│  stubs (provenance)  │         │  audit events        │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           └──────────┐          ┌──────────┘
                      ▼          ▼
              ┌──────────────────────┐
              │   ASSEMBLY ENGINE    │  ← sole holder of both plane credentials
              │  PDP → templates →   │
              │  compose → receipt   │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │  WITNESS (declared)  │  e.g. OpenAI — disclosed pre-reasoning
              └──────────────────────┘
```

**The one-sentence design:** authorization is computed *before* retrieval as a set of
pre-bound, registered query templates; the engine composes pre-authorized fragments and
can never filter over-authorized ones, because over-authorized retrieval is impossible
by construction.

## 2. Testable invariants

These are CI-enforceable. Each maps to constitutional articles.

| # | Invariant | Enforced by | Articles |
|---|-----------|-------------|----------|
| I1 | No single query traverses both planes | Separate drivers/credentials; template lint | AQ1 rider |
| I2 | Every retrieval executes a **registered template** with PDP-bound parameters; no dynamic Cypher in assembly | Template registry + CI lint | 2, AQ1 |
| I3 | Nothing enters a ContextPack without an `authorizationDecisionId`; missing decision ⇒ excluded (fail closed) | Engine assertion + receipt schema | 2 |
| I4 | Org-plane writes occur only via the promotion bridge or org-authorized mutations | Route-level guards; org driver not exposed elsewhere | 6, 7 |
| I5 | Every reasoning act declares beneficiary + witness set pre-execution; missing ⇒ HTTP 422 refusal | Request schema validation | 15, 16 |
| I6 | User-facing receipts contain approvals only; denials go to a separate audit stream | Receipt builder | 19 |
| I7 | Personal-plane data never appears in any org-visible endpoint, log, or metric | Endpoint review + log lint | 10, 19, 20 |
| I8 | Every bridge crossing is audited with reciprocal visibility (owner sees org's view of the event) | Promotion service | 21 |
| I9 | Rejected promotion proposals are purged from the org plane, content and all | Promotion service + retention test | 7, 10 |
| I10 | Every persisted object carries `constitutionVersion`; every decision carries `policyVersion` | Schema defaults + write-path assertion | 23 |

## 3. Plane schemas

### 3.1 Personal plane (instance P)

All nodes carry `ownerId` (principal), `constitutionVersion`, `createdAt`.
V1 hosts all personal planes in one instance, partitioned by `ownerId`;
every registered template MUST bind `ownerId = $principalId` (lint-enforced).

```
(:Cognition {id, ownerId, kind: 'candidate'|'draft'|'note'|'artifact',
             content, summary, status, promotedTo?, constitutionVersion, createdAt})
(:Project|:Task|:Domain|:Style {id, ownerId, ...})        // existing memory nodes, stamped
(:ConsumptionStub {id, ownerId, orgId, knowledgeObjectId,  // provenance WITHOUT cross-plane queries
                   classification, obligations, consumedAt})
(:Cognition)-[:DERIVED_FROM {observedAt}]->(:ConsumptionStub)
(u-edges: WORKS_ON, PERFORMS, EXPERT_IN, HAS_STYLE with memoryState/usageCount/lastUsed — unchanged)
```

`ConsumptionStub` holds *references and classifications only*, never org content.
This is how Article 8 obligations enforce at the boundary: promotion review reads
stubs, not org data, and needs no cross-plane query (I1 preserved).

### 3.2 Org plane (instance O)

```
(:Organization {id, name, deploymentModel: 'knowledge'|'cognition', constitutionVersion})
(:Team)-[:BELONGS_TO]->(:Organization)
(:OrgPrincipal {principalId})-[:MEMBER_OF {role, grantedAt, grantedBy}]->(:Team)
(:Organization|:Team)-[:ENFORCES]->(:Policy {id, ruleText, scope, classification})
(:Organization)-[:OWNS]->(:Project {id, name, classification})
(:KnowledgeObject {id, type, content, summary, classification, authority,
                   status, provenanceHash, derivedFromOwner, promotedAt,
                   promotionDecisionId, constitutionVersion})
(:PromotionProposal {id, proposerId, contentSnapshot, stubRefs, status,
                     proposedAt})            // purged on rejection (I9)
(:PromotionEvent {id, proposalId, reviewerId, decision, timestamp})   // audit, retained
(:KnowledgeObject)-[:REFERENCES|:COMPLIES_WITH|:RELATES_TO]->(org-plane nodes only)
```

Note: the org plane stores **principal references**, never principals. Identity lives
in the identity service (§6). `OrgPrincipal` is the org's view of a membership, which
is exactly what offboarding deletes.

## 4. Authorization model

**Paradigm:** ReBAC core (the org graph *is* the relationship store: membership, team,
grant edges) + role gates on governance actions (promotion review, policy authoring,
member admin). No standalone Zanzibar service in V1 — the PDP is an in-process module
with its own test suite and versioned policy data, extractable to a service later.

**Flow per reasoning act:**

1. AuthN middleware verifies JWT → `principalId`. Caller-supplied identity is dead.
2. Request carries a `ReasoningDeclaration` (beneficiary, purpose, witnessSet, orgContext).
   Missing/invalid ⇒ 422 (I5).
3. **PDP** resolves: memberships + roles (org plane, one scoped query), deployment model,
   witness lawfulness (declared set ⊆ configured lawful witnesses for all participating
   principals), and emits an `AuthorizationDecision` — a list of `AuthorizedTemplate`s
   with **fully bound parameters**. The engine cannot add, alter, or unbind parameters.
4. **Engine** executes templates verbatim against the respective plane drivers
   (parallel), composes the ContextPack, ranks *within* the authorized set, attaches
   per-item `{templateId, decisionId, policyVersion}` receipt entries.
5. Denials (refused witnesses, unauthorized org context, missing grants) are written to
   the audit stream, never to the user receipt (I6).

**Why this solves the original traversal problem for V1:** there are no ad-hoc or
variable-length traversals to police. Every traversal is a fixed, reviewed shape that
was authorized *before* execution — enforcement during traversal is achieved by making
unauthorized traversal inexpressible, not by filtering results. The current
`fetchAllMemories` UNION templates port almost directly into the registry.

### 4.1 Contracts (TypeScript)

```ts
interface ReasoningDeclaration {
  beneficiaryId: string;              // required; no default (Article 16)
  purpose: 'assemble' | 'execute';
  witnessSet: WitnessId[];            // required when purpose = 'execute' (Article 15)
  orgContext?: { orgId: string };
}

interface AuthorizationDecision {
  decisionId: string;
  allowedTemplates: AuthorizedTemplate[];
  witnesses: { approved: WitnessId[]; refused: WitnessId[] };
  policyVersion: string;
  constitutionVersion: string;
  issuedAt: number;
}

interface AuthorizedTemplate {
  templateId: string;                 // must exist in the registry
  plane: 'personal' | 'org';
  params: Record<string, string | number>;  // fully bound by PDP
  reveals: RevelationClass[];         // declared at registration, reviewed
}

interface ContextPackItem {
  id: string; type: string; content: string;
  authorizationRef: { decisionId: string; templateId: string; policyVersion: string };
}
```

### 4.2 Template registry rules (CI lint)

- Template declares: plane, bound-parameter schema, revelation classes, max depth.
- MUST bind the partition parameter (`ownerId` on personal; `orgId` on org).
- MUST NOT contain variable-length expansions (`[*..n]`) unless individually
  whitelisted with a written justification and depth bound.
- MUST NOT reference the other plane's labels.
- Registry changes require review; the registry file is the authorization surface.

## 5. The promotion bridge

Two-phase, application-level, owner-initiated:

1. **Propose** (owner action): snapshot of the cognition content + consumption-stub
   references is written to `(:PromotionProposal)` in the org plane. The crossing is
   consensual and explicit (Article 7). Cognition in the personal plane is untouched.
2. **Review** (org role: reviewer): the existing Trust Queue UI becomes this — scoped
   to the org and role (fixing the currently unscoped `fetchTrustQueue`). Obligations
   on referenced stubs are evaluated here (unresolved retraction ⇒ block, Article 8).
3. **Approve** ⇒ new `(:KnowledgeObject)` with provenance hash; proposal archived to
   `(:PromotionEvent)`. **Reject** ⇒ proposal content purged (I9), event retained.
4. Both outcomes are visible to the proposer (Article 21).

Retraction: org marks a KnowledgeObject retracted ⇒ assembly templates exclude it and
future promotions referencing its stub are blocked. Derivative tombstoning inside
personal planes is *not* attempted (Article 14 — the platform only governs observed
chains at the boundary).

## 6. Identity (V1 pragmatic call — AQ2 derogation)

V1 uses **platform-issued identity** (JWT; email+OIDC), with org membership as
org-plane data, never as identity. Employment grants a membership record — offboarding
deletes `MEMBER_OF` edges and bridge grants, and the personal plane remains accessible
because login never depended on the org. The constitutional destination
(owner-anchored keys, recovery ceremony) is deferred: a design partner pilot does not
need self-sovereign identity, and V1's enclave is audit-tier anyway (§8). Export
survives platform account suspension as a support-process guarantee in V1 (Article 3),
not yet a cryptographic one.

## 7. V1 threat model (design-partner scope)

| Adversary | V1 posture |
|-----------|------------|
| Curious insider (same org) | Org-plane access via grants + bound templates; personal planes structurally invisible to all org endpoints (I7) |
| Malicious prompt author | Prompt influences *ranking only*, and ranking selects among pre-authorized items — influence is bounded by the principal's own authorization (the constitution neutralized this class) |
| Org admin overreach | No endpoint reads personal plane with org credentials; deployment model visible to all members (Article 12) |
| Graph poisoning via LLM extraction | Contained by the bridge: extracted candidates land in the proposer's personal plane; org entry requires human review (the constitution contained this class) |
| Cross-org leak | One design partner in V1; org scoping is parameter-bound in every org template; planes make personal↔org structural |
| Stolen backend credentials | Plane credentials are separate secrets; partial compromise is partial. Full compromise reads both planes — see Derogation D2 |
| LLM provider | Declared witness, disclosed pre-reasoning; zero-retention contract tier (Derogation D3) |

Deferred beyond V1: agent delegation / confused deputy (no agents in V1), mosaic
aggregation, multi-org federation, subject rights.

## 8. Derogation register (show this to the design partner)

Honest deviations from the constitutional destination. Each is disclosed, bounded, and
has a stated exit.

| # | Derogation | Constitutional destination | V1 reality | Exit path |
|---|-----------|---------------------------|------------|-----------|
| D1 | Personal planes share one instance, partitioned by `ownerId` | Per-principal sovereignty | Query-construction + audit tier | Physical/crypto separation at scale |
| D2 | Operator can technically read personal plane | Article 10 operator-constrained via owner keys | Access separation, audit logging, disclosed | Owner-held encryption keys |
| D3 | External LLM witness (e.g. OpenAI) | Article 18 witness minimization | Named, disclosed, zero-retention contract | Tenant-hosted / attested models |
| D4 | Platform-issued identity | Owner-anchored + recovery ceremony | JWT/OIDC; export survives suspension by process | Key-anchored identity |
| D5 | Enforcement is application-tier | Article 25 "detectable, attributable, non-deniable" at architecture tier | Template registry + audit stream provide detectability/attribution | Progressive hardening per milestone |

## 9. Migration from current repo

Delete/replace: caller-asserted `userId` (all routes) → JWT middleware; `fetchGraphData`
undirected `[*0..3]` → per-plane scoped visualization templates; unscoped
`fetchTrustQueue` → org+role-scoped promotion review; `/api/admin/clear` → dev-only
guard. Port: `fetchAllMemories` UNION arms → registered templates (personal-plane arms
to instance P, org arms to instance O); Trust Queue UI → promotion review; artifact
persistence → personal plane by default, org plane only via bridge.

## 10. Milestones

- **M0 — Foundations (wk 1–2):** JWT authn; two Neo4j instances + separate drivers;
  schema stamps (`ownerId`, `constitutionVersion`); delete unsafe endpoints. *Partner-visible:* login.
- **M1 — Constitutional assembly (wk 3–4):** template registry + lint; PDP module;
  fail-closed engine; receipts with decision ids. *Partner-visible:* explainable, auditable ContextPacks.
- **M2 — Bridge (wk 5–6):** ReasoningDeclaration in API + witness disclosure UI;
  promotion propose/review/purge; consumption stubs + retraction gating.
  *Partner-visible:* the promotion workflow — the product's core trust story.
- **M3 — Pilot hardening:** offboarding runbook (delete memberships, sever grants,
  verify I7), audit surfaces, derogation register review with partner.

## 11. Open engineering risks

1. **Two-instance cost/ops** vs. multi-database (needs Aura tier check). Fallback that
   preserves I1: one instance, two databases, two drivers; last resort: label-prefixed
   separation (weakens I1 to lint-tier — avoid).
2. **PDP-in-process** risks policy/app tangling — mitigated by module boundary, own
   test suite, versioned policy data; extraction to a service is mechanical later.
3. **Latency:** +1 in-process PDP pass (ms) and two parallel DB round-trips; assembly
   stays well under 100ms at pilot scale. Revisit at 10⁶ nodes.
4. **The real risk:** building constitution machinery instead of product. Mitigation is
   the milestone ordering — every milestone lands a partner-demoable trust feature.
