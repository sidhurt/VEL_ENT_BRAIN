# Handoff Specs — Client Brain V1 completion

**Written 2026-07-07.** The Client Brain core (schema, ingestion/extraction, review
lifecycle, client-scoped assembly, receipts, walls) is BUILT and smoke-tested
end-to-end — see `backend/src/clientBrain.ts`, `backend/src/extraction.ts`, and the
`/api/clients/*` routes in `backend/src/index.ts`. These specs cover the four
remaining pieces to dogfood launch, written to be executed mechanically.

**Working agreement for any AI/engineer executing these** (learned the hard way):
1. Read every script before running it (`npm run seed` WIPES the DB; it is guarded, do not remove the guard).
2. Never hardcode a production default for anything security-related; fail closed.
3. Type-check both `backend/` and `frontend/` (`npx tsc --noEmit` from each dir) before every commit.
4. Any env value must be updated in ALL THREE places together: `backend/.env`, Vercel backend project, Vercel frontend project (VITE_ vars are build-time and PUBLIC in the bundle).
5. Test against constitution invariants I1–I10 in `docs/V1_ARCHITECTURE.md` §2.

---

## Spec 1 — Google Sign-In (replaces dev login in production)

**Why:** current login issues tokens without credential verification (Derogation D4).
Walls on spoofable identity aren't walls.

**Backend** (`backend/src/auth.ts`):
- Add `POST /api/auth/google`: body `{ credential }` (a Google ID token from the
  frontend). Verify with `google-auth-library`'s `OAuth2Client.verifyIdToken`
  against env `GOOGLE_CLIENT_ID`. On success: principal id = `email` (stable,
  human-readable), name = `name` claim. Issue the existing JWT via `issueToken`.
- Keep `POST /api/auth/login` but guard it: `if (NODE_ENV === 'production') return 403`
  unless env `ALLOW_DEV_LOGIN=true` (for staging demos only).
- Optional org auto-join: env `ORG_DOMAIN_MAP` (JSON: `{"velocity.in": "org-velocitymedia"}`);
  on first login, if email domain maps to an org, MERGE the user and attach to the
  org's default team (reuse `attachUserToEnterprise`).

**Frontend** (`frontend/src/lib/auth.ts` + a small login screen):
- Google Identity Services script, One Tap or button → get `credential` → POST to
  `/api/auth/google` → store token exactly as `loginAs` does today.
- `VITE_GOOGLE_CLIENT_ID` env (public by nature, fine in bundle).
- The EnterpriseBrain auto-`loginAs(VITE_ADMIN_PRINCIPAL)` flow dies when this lands;
  admin = Google-authenticated principal whose email is in `ADMIN_PRINCIPALS`.

**Acceptance:** production rejects `/api/auth/login`; a real Google account gets a
working session; `ADMIN_PRINCIPALS=founder@agency.com` gates admin routes.

## Spec 2 — Embeddings retrieval for Client Brain assembly

**Why:** `rankItems` in `clientBrain.ts` is keyword matching; creative professionals
judge output in seconds.

- On knowledge activation (`reviewKnowledge` approve path): compute an embedding of
  `title + ": " + content` via OpenAI `text-embedding-3-small`, store as
  `k.embedding` (Neo4j supports float array properties).
- Create a vector index (Neo4j 5 / Aura supports this):
  `CREATE VECTOR INDEX knowledge_embedding IF NOT EXISTS FOR (k:ClientKnowledge) ON (k.embedding) OPTIONS {indexConfig: {\`vector.dimensions\`: 1536, \`vector.similarity_function\`: 'cosine'}}`
- In `assembleClientContext`: embed the prompt, then replace `rankItems` for facts
  and learnings with `CALL db.index.vector.queryNodes('knowledge_embedding', 12, $promptEmbedding)`
  **filtered to `k.clientId` = this client AND `k.status='active'`** — the wall must
  hold inside the vector query. Easiest safe shape: store `k.clientId` on every
  knowledge node at creation (add to `proposeKnowledge`), and post-filter the vector
  hits by clientId + kind, then blend: `finalScore = 0.7 * similarity + 0.3 * normalized(usageCount)`.
- Voice and rules remain always-included (do not rank them).
- Backfill script for existing knowledge (guarded, idempotent).

**Acceptance:** a prompt about "Diwali pricing post" retrieves the pricing-approval
rule and Diwali learnings above unrelated facts; an item from another client NEVER
appears (write a test that plants a decoy client and asserts absence).

## Spec 3 — Client Room UI (the product's only daily screen)

**Why:** account managers need one page per client; everything else is secondary.

Routes (React Router): `/clients` (list) and `/clients/:clientId` (the Room).

**`/clients`:** cards from `GET /api/clients