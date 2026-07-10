# Client Brain V1 — Build Status & Handoff Spec

**As of 2026-07-06.** Derives from [PRODUCT strategy](PROJECT_STATE.md) (agency-first) and
[CONSTITUTION.md](CONSTITUTION.md). This is the V1 product core: the **client account**
is the anchor entity, not the employee.

---

## Part A — What is BUILT and TESTED (this session)

Backend, live-DB verified end-to-end. Two new modules, one route block. No engine rewrite.

- **`backend/src/clientBrain.ts`** — the product core.
  - Schema: `(:Organization)-[:HAS_CLIENT]->(:Client)-[:HAS_KNOWLEDGE]->(:ClientKnowledge)`; `(:Client)-[:HAS_EVENT]->(:PromotionEvent)`.
  - `ClientKnowledge.kind ∈ {voice, rule, fact, learning}`, `status ∈ {proposed, active}`.
  - **Client walls:** every function calls `requireClientAccess` / `resolveOrg`, which resolve the client through the *caller's own* `MEMBER_OF→BELONGS_TO→HAS_CLIENT` chain. A client outside the caller's org returns 403. Cross-client assembly is inexpressible — no query spans two clients.
  - **Promotion lifecycle:** `proposeKnowledge` → `getReviewQueue` → `reviewKnowledge(approve|reject)`. Approve activates (+ optional reviewer edits); **reject DETACH DELETEs** the item (Invariant I9, no rejected content retained). Both write a `PromotionEvent`.
  - **Assembly + receipt:** `assembleClientContext` always includes `voice` + `rule` (generation is generic without them), ranks `fact`/`learning` against the prompt, reinforces `usageCount`/`lastUsed`, and emits a **receipt** listing every item used with a reason plus the wall assertion.
  - **Generation:** `generateForClient` wraps assembly in an agency-specific briefing (voice, hard rules that override everything, facts, learnings) and returns outcome + receipt.

- **`backend/src/extraction.ts`** — the quality bottleneck, engineered against the "generic filler" failure mode.
  - `extractClientKnowledge(text, clientName, sourceName)` → structured `KnowledgeItem[]`.
  - System prompt enforces a **specificity test** ("would this be wrong/useless for a different brand?"), the four-kind taxonomy, ≤60-char titles, ≤350-char self-contained content, confidence ≥70 floor, and a verbatim evidence quote per item.
  - Chunks long docs (9k chars, 600 overlap), dedupes by normalized title keeping highest confidence.

- **Routes** (in `backend/src/index.ts`, all behind auth): `POST/GET /api/clients`, `GET /api/clients/:id/brain`, `POST /api/clients/:id/knowledge`, `POST /api/clients/:id/ingest`, `GET /api/clients/:id/review-queue`, `POST /api/knowledge/:id/review`, `POST /api/clients/:id/enhance`.

### Test evidence (live DB, gpt-4o-mini)
Created client "Meridian Foods" → ingested a 2.2k-char brand deck → **11 candidates extracted**
(4 rules incl. "health claims forbidden", "competitor mentions prohibited"; voice; audience/SKU
facts; a 9pm-engagement learning) → reviewed (10 approved, 1 mis-binned item rejected & purged) →
generated 3 launch captions. **Result: output was in-voice (Hinglish, witty), contained no banned
health words, named no competitor** — i.e. the client's hard rules were honored automatically. An
outsider principal got **403 on brain, enhance, and list** — walls verified.

### Known quality gaps (honest)
- Extraction over-merges occasionally (one "Learnings from campaigns" catch-all item — caught in review, which is the point of review). A stronger extraction model (`EXTRACTION_MODEL` env) will sharpen titles; the pipeline is model-swappable.
- Some titles are still generic ("Hero SKU defined"). Content is specific; titles need a second pass. Low priority — reviewers read content.

---

## Part B — What to BUILD NEXT (specs precise enough to hand to any model)

Ordered by launch-blocking priority. None require engine changes.

### B1 — File parsing for ingestion ✅ BUILT & TESTED (2026-07-06)
`POST /api/clients/:id/ingest-file` (multipart field `file`, 15MB cap, in-memory —
serverless-safe). PDF via `pdf-parse` v2 (`PDFParse` class API — note: v1 examples
online are wrong for this package version), DOCX via `mammoth`, TXT/MD passthrough.
Parsing lives in `backend/src/fileParsing.ts`; feeds the existing
`extractClientKnowledge` → `proposeKnowledge` path. Text capped at 60k chars;
<100 extractable chars → 422 (catches scanned/image-only PDFs); unsupported
extensions → 422. **Tested end-to-end:** generated PDF uploaded through the API →
5 correctly-classified candidates in the review queue. Remaining nice-to-haves:
PPTX support (`officeparser`), OCR for scanned PDFs — both post-dogfood.

### B2 — Google Sign-In ✅ BUILT (2026-07-07) — needs one human click-test
- Backend: `POST /api/auth/google` verifies the Google ID token (`google-auth-library`,
  audience = our client ID), MERGEs `(:User {id: 'g-'+sub})` with name/email/provider,
  issues the platform JWT. Negative paths tested (422 no credential, 401 garbage).
- Frontend: `GoogleSignIn.tsx` (official GIS button), `loginWithGoogle()` in `lib/auth.ts`,
  wired into the Jarvis entry screen above a "dev access" divider. `loadWorkspace` no
  longer dev-logins over an existing verified token.
- Dev login is now **disabled in production unless `ALLOW_DEV_LOGIN=true`** (set on
  Vercel — required by the admin console until the Client Room ships Google-only;
  flipping it to false is the B4 cutover step).
- OAuth client: `754202982237-k1v6n4u2kihs0g68am5164nq4p5ku88r` (project "unified
  brain"); origins: localhost:5173 + frontend-theta-seven-91.vercel.app. Consent
  screen is in **Testing** mode — add teammates as test users until published.
- Remaining: human click-test of the real Google flow (can't be automated headlessly);
  new Google users have no org membership until attached (`/api/enterprise/attach-user`) —
  the Client Room onboarding flow should absorb this.

### B3 — Embeddings retrieval ✅ IMPLEMENTED (backfill required on deployment)
Semantic retrieval is intentionally client-wall-safe: it never uses a global Neo4j vector
index. Instead, the existing client-scoped query fetches only the active knowledge for the
authorized client, then cosine similarity is computed in application memory over that
already-walled set.

- On approval, `fact` and `learning` items embed `title + content` using
  `text-embedding-3-small` (or `EMBEDDING_MODEL`) and persist the vector on the
  `ClientKnowledge` node. Voice and rules remain always included and do not need ranking.
- `assembleClientContext` embeds the request, blends cosine similarity with a small capped
  prior-use boost, and records `receipt.retrieval = 'semantic'`. If the provider is unavailable
  or any active candidate still lacks an embedding, it safely uses the complete keyword ranker
  and records `'keyword-fallback'`; generation and client walls remain available.
- Existing knowledge: run `cd backend && npm run backfill:client-embeddings` after deployment
  (optional `EMBEDDING_BACKFILL_BATCH_SIZE`, default 50). It updates only active facts and
  learnings missing an embedding for the configured model, so it is safe to resume or rerun
  after changing models.
- Acceptance: a prompt about festive packaging retrieves a semantically relevant fact or
  learning even where it has no lexical overlap. Client rules remain present regardless.

### B4 — Client Room UI (≈1.5–2 weeks) — the only screen account managers open
Strip-mine Jarvis/EnterpriseBrain for components. Three views:
1. **Client list** — cards from `GET /api/clients` (name, industry, active-knowledge count, pending-review badge). "New client" + "Upload document" actions.
2. **Client Room** — the centerpiece. Brain browser grouped by kind (voice/rules/facts/learnings); an **ask-with-context** box calling `/enhance` that renders the output **and the receipt** ("built from Meridian's brain — 4 rules, brand voice; no other client's data"); a review-queue panel with **10-second approve/reject** buttons (this must be a fast inline action, not a separate page — the M0 lesson was that queue UX makes or breaks adoption).
3. Upload modal → `/ingest-file` → drops into the review queue.
- Delete from product surface: neural graph, memory-evolution panels, persona onboarding forms, org/team CRUD.

### B5 — MCP connector (post-dogfood, ≈1 week)
Expose client-aware assembly as an MCP server so employees' existing Claude/ChatGPT become client-aware without a new app. One tool: `get_client_context(clientId, prompt)` → returns the ContextPack + receipt. Rides the standard instead of competing with it. Only after Client Room proves the loop.

---

## Part C — Refuse to build (V1)
General chatbot · project management · analytics dashboards · WhatsApp integration (correct year-2 move, scope trap in year 1) · custom model hosting · enterprise procurement theater (SOC2/SSO matrices) until someone outside the Velocity ecosystem asks with a check.

## Part D — Six-month sequence
M1 (done-ish): Client Brain core + extraction ✅ → **B1 file parsing + B2 Google auth**.
M2: **B3 embeddings + B4 Client Room** → dogfood on Velocity's own accounts.
M3: receipts-as-confidence polish + founder dashboard v0 → first external Totem client.
M4–M6: deployments 2–3, per-client-brain pricing test, cross-client agency-playbook (explicit governed promotion), then revisit the category/GTM story with 3 live agencies as proof.

## Operational reminders (from the M0 incident log)
- **Rotate the Neo4j password** — still the exposed-in-git one. Client-confidential data is about to live here.
- `npm run seed` wipes the DB (guarded now: needs `SEED_ALLOW_WIPE=true`).
- New env knobs: `EXTRACTION_MODEL`, `GENERATION_MODEL` (default `gpt-4o-mini`; raise extraction model for quality).
