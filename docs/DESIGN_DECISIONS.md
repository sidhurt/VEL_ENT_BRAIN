# Design Decisions

The load-bearing decisions, ADR-style: what was decided, why, what it cost. Full
derivations live in [CONSTITUTION.md](CONSTITUTION.md) and
[design-history/](design-history/).

---

### DD-1 — Enforcement at query construction, never post-filtering
**Decision:** Authorization is expressed in the shape and bound parameters of every
graph query. There is no "fetch broadly, filter after" path anywhere.
**Why:** Post-filtering leaks through timing, cardinality, and error shape — and is
usually just wrong. If unauthorized data is never materialized, it cannot leak.
**Cost:** Query shapes are less flexible; new access patterns require new reviewed
queries rather than ad-hoc traversals. Accepted deliberately.

### DD-2 — The client account is the anchor entity, not the employee
**Decision:** V1 models knowledge around `Client` (the agency's client account),
not around the individual user the original prototype centered on.
**Why:** In the first market (marketing agencies), revenue, knowledge, and risk all
attach to client accounts. Employee-anchored memory answered a question agencies
weren't asking.
**Cost:** The original persona-onboarding surface became legacy. Kept operational
for the personal memory engine; superseded as the product's center.

### DD-3 — Promotion, not discovery
**Decision:** Knowledge becomes shared only through an explicit propose → review →
approve lifecycle. Rejected proposals are purged, and every decision writes an
immutable audit event.
**Why:** "Reachable" must never imply "shared." This is both the security model and
the product's quality-control mechanism — the review queue is where an account lead
protects their client's brain from noise.
**Cost:** Friction by design. Mitigated by making review a 10-second action rather
than a workflow.

### DD-4 — Client walls resolved through the caller's own membership
**Decision:** Access to a client is established by one query that walks from the
authenticated principal through their org membership to the client. Zero rows = 403.
**Why:** Agencies serve competing clients under confidentiality obligations. The
wall must be structural (inexpressible queries), not a filter — and the receipt
asserts it per output.
**Cost:** Every client operation pays one extra hop. Negligible at current scale.

### DD-5 — Voice and rules are always included in assembly
**Decision:** Brand voice and hard rules bypass ranking; only facts/learnings are
ranked against the request.
**Why:** The two dominant failure modes of AI content for agencies are generic
voice and rule violations. Both are eliminated categorically rather than
probabilistically.
**Cost:** Slightly larger packs. Correctness over token-count.

### DD-6 — Extraction confidence floor with evidence quotes
**Decision:** Document extraction discards items below confidence 70 and requires a
verbatim evidence quote per item; items that could apply to any brand are rejected
by prompt design ("the specificity test").
**Why:** The product dies in week one if extracted knowledge feels like generic
filler. Review exists to catch mistakes, but the extractor must not flood it.
**Cost:** Recall sacrificed for precision. Correct trade for a human-reviewed
pipeline.

### DD-7 — Planes as separation of authority, not infrastructure
**Decision:** Personal and org planes are distinct authority domains with their own
session factories and env-mapped connections — currently pointing at one instance.
**Why:** The guarantee that matters is *no query spans planes*; physical topology
is a deployment decision that must be changeable without touching product code.
**Cost:** Logical-only isolation today (Derogation D1, [SECURITY.md](SECURITY.md)).

### DD-8 — Fail closed, everywhere
**Decision:** Missing env → server refuses to start. Missing/invalid token → 401.
Identity mismatch → 403. Unknown admin → 403 with no production default. Non-empty
database → seed refuses. Unsupported file → 422.
**Why:** Every incident this project has had came from an open default. The
constitution's phrasing: the default loser is the consumer of knowledge, never the
owner.
**Cost:** Occasional lockouts (a mismatched admin id once blanked the console).
Lockouts are recoverable; leaks are not.

### DD-9 — Honest derogations over silent gaps
**Decision:** Every deviation from the destination architecture is documented in a
derogation register with an exit path, and shown to reviewers and design partners.
**Why:** Trust is the product. A repository that hides its gaps invites the
assumption that it hides worse.
**Cost:** Reviewers see the gaps. That is the point.

### DD-10 — The Brain outputs structure, not prompts
**Decision:** ContextPack (+ receipt) is the product boundary; prompt formatting
belongs to consumers (or to our own thin generation wrapper).
**Why:** Keeps the Brain model-agnostic and lets it serve future consumers (other
tools, MCP clients, agents) without owning their prompt strategies.
**Cost:** Consumers must render context themselves; our own wrapper exists as the
reference implementation.
