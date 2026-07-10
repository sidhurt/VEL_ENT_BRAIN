# Vision — Unified Brain

*Where this project has been, what it actually is, and where it goes next — conceptually and technically.*

---

## 1. The thesis, in one breath

AI should never reason from an empty page when the people and organizations behind it
already hold years of context. But the hard problem was never *retrieval* — it's
**legitimacy**: deciding what knowledge is *allowed* to participate in a given act of
reasoning, for a given person, under a given set of rules — and being able to *prove*
it afterward.

Unified Brain is the machinery for that decision. It assembles the highest-quality
context that can legitimately enter a reasoning act, enforces the boundaries that must
hold, and issues a receipt for every answer. It solves context deficiency **without**
solving it by surveillance.

---

## 2. Where we are today

The project crossed a real line: from an interesting architecture to a **working,
deployed, independently-verified product**.

**Shipped and live in production:**
- **The Client Room** — the customer-facing surface. One screen per client account:
  see what the system knows, teach it by uploading documents, review what gets in,
  and generate on-brand work with a receipt attached.
- **The Client Brain** — per-client knowledge in four kinds (voice, rules, facts,
  learnings), with **client walls**: assembly is bound to exactly one client per
  request, by query construction. Cross-client leakage is *inexpressible*, not filtered.
- **The promotion loop** — nothing enters shared knowledge by existing. Documents
  propose candidates; a human approves or rejects; approvals are audited, rejections
  are purged. Promotion, not discovery.
- **Receipts** — every generation states exactly what knowledge was used, why, and
  asserts the isolation boundary that held.
- **Real identity** — Google Sign-In, JWT-gated API, fail-closed admin controls.

**Locally complete, awaiting rollout:**
- **Semantic retrieval** — fact/learning ranking runs on embeddings, scoped inside
  the client wall (no global vector index that could cross tenants). The implementation
  and its isolated behavioral tests are complete; it still needs deployment, production
  backfill, and live validation before it can be called shipped.

**Independently verified.** An external AI agent, probing only the live app with no
source access, ran the same audit before and after this work and watched four
capabilities go from "not implemented" to "verified." Most importantly, it confirmed the
wall behaviorally: asked about one client's product from inside another client's context,
the model *refused*. The isolation isn't decoration — it reaches the output.

---

## 3. The conceptual vision

The deep idea is a small set of primitives that, once they exist and are cheap, make a
category of previously-blocked work possible:

- **Assemble** context that's relevant.
- **Govern** what may participate.
- **Isolate** knowledge that must not mix.
- **Promote** tentative knowledge into trusted knowledge, through human review.
- **Prove** provenance with an explainable receipt.

The two scarcest of these are **promotion** and **the receipt** — they're the trust
primitives, and trust is the entire gap between an AI demo and AI that's allowed to do
real work.

**Vocabulary that carries the idea:** the **Brain** is the intelligence — the knowledge
that makes the AI smart about a client. The **Room** is where a human enters and works.
*The Room is where you work; the Brain is what makes it smart.* You never log into a
Brain — you open a Room, and a Brain stands behind it.

**Why this matters beyond one product:** everyone in the market does permission-aware
*retrieval* ("can this user see this document?"). Almost no one does legitimacy-aware
*assembly* ("should this knowledge participate in this reasoning act, given who owns it
and how it was governed?"). That distinction is the durable idea.

---

## 4. Product direction — reality upward, not ideal-state downward

This is built by a small team with a real distribution channel (Totem / Velocity and
their ecosystem of Indian agencies, studios, and SMBs), not by a funded platform chasing
the Fortune 500. So the operating goal is **learning velocity through real deployments**,
not maximum theoretical ambition.

**The wedge is the agency.** Agencies serve competing clients under confidentiality
obligations — which is exactly the problem the walls + receipts solve *natively*. "Provable
isolation between the clients you serve" is something horizontal AI tools structurally
cannot offer. The Client Brain is the beachhead; it is deliberately **not** claimed as the
final company.

**The discipline that keeps a lab honest:** every deployment should carry a written
hypothesis and a kill/graduate criterion. The one number that matters right now is
**reuse of promoted knowledge** — after the novelty fades, do users keep drawing on the
Brain to produce work? If yes, the compounding-knowledge thesis is alive. If no, the
promotion loop is ceremony. That is the experiment the whole product exists to run.

**What we refuse to build:** a better chatbot; a horizontal "governance platform" with no
wedge; anything that requires educating a market about a category it has no budget for.
The legacy Enterprise/Jarvis engine stays parked, not extended.

---

## 5. Technical direction

**Near term — sharpen the core loop.**
- Retire keyword ranking fully once embeddings prove out; tune the match threshold on real
  usage.
- Knowledge lifecycle: archive/retire stale rules and facts (approved knowledge is
  currently permanent — the four kinds imply different lifecycles).
- Close the explainability gap: receipts show what was *used*, not what was *considered and
  dropped*. Add the "considered but rejected" view.
- Sign-out and session handling are in; move toward Google-only auth and turn off the dev
  login scaffold in production.

**Mid term — trust becomes provable, not just asserted.**
- A formal template registry + policy decision point: every retrieval a registered,
  parameter-bound query, so authorization is auditable per request and receipts can carry a
  decision id and policy version.
- Org-level roles (reviewer, knowledge owner) as first-class graph data.
- Deprecate or migrate the legacy engine so the codebase reads as one product.
- Meet users where they already work: expose client-aware assembly through MCP so existing
  AI tools become client-aware, instead of asking anyone to adopt a new chat app.

**Long term — the destination the primitives point at.**
- Physical plane separation (per-tenant isolation as a config change, not a rewrite — the
  abstraction is already there).
- The Brain as a compounding, human-verified knowledge asset that a competitor cannot clone,
  because it's the accreted product of the customer's own curation.
- Optionality toward regulated knowledge work, where "prove what the AI was allowed to use"
  stops being a nice-to-have and becomes a mandate — carried by the same primitives.

---

## 6. Why it compounds (the moat)

The defensibility is **not** the philosophy and **not** the elegance. It's two things that
grow with use:

1. **The approved-knowledge asset** — a proprietary, human-verified, provenance-stamped
   corpus that a competitor can't replicate, because it's the output of the customer's own
   review labor.
2. **Sitting in the path** — being the place trusted knowledge is assembled and the record of
   what happened, not a tool bolted on the side.

The constitution and the receipts are how you *earn the right* to hold that position and
*keep* it honestly. They're the reason a customer trusts you with the asset in the first place.

---

## 7. Honest risks — what must be true

- **Distribution is the gating constraint**, not technology. The channel (Totem/Velocity)
  gets us to real users; scaling past it is unsolved and may need a commercial partner.
- **The lab must graduate something.** "We're learning" cannot become the new "we're
  architecting." Reuse-of-promoted-knowledge is the metric that forces the question.
- **The legacy engine is confusing to outsiders** — two audits got lost in it before finding
  the real product. It should be deprecated or removed before serious external review.
- **Output quality is judged in seconds by professionals with taste.** Retrieval and
  extraction quality is the survival milestone, not a polish item.

---

## 8. Guiding principles

- **Legitimacy constrains utility.** If it can't participate legitimately, it doesn't
  participate — even if it would help.
- **Promotion, not discovery.** Reachable never means shared.
- **Prove, don't assert.** Every answer carries its receipt.
- **Fail closed.** Every incident this project had came from an open default.
- **Ship to learn.** Write down what would prove you wrong before you build — that single
  habit is the difference between discovering a product and architecting one forever.

---

*The Brain was real before it was reachable. Today it's both. The next chapter is making one
real organization's work provably better with it — and letting that, not the philosophy, earn
the right to keep building.*
