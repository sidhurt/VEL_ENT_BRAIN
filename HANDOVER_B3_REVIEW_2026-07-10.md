# Handover — B3 semantic retrieval: pre-rollout review and backfill fix

**Purpose:** Use this as the starting context for the next session. It supersedes
`HANDOVER_B3_2026-07-10.md`, which described the B3 implementation as rollout-ready;
this session found and fixed a bug that would have broken the production backfill.
Both earlier handovers remain unchanged as history.

---

## Current state

The Client Room remains live at `/` and `/clients`. B3 semantic retrieval is
implemented locally, **reviewed, fixed, and behaviorally tested**, but still
**not committed, not deployed, and not backfilled in production**. Nothing in this
session touched the live database or Vercel.

## What this session did

### 1. Fixed: backfill would have crashed on its first production query

`backend/src/backfillClientEmbeddings.ts` passed the batch size as `LIMIT $batchSize`
with a plain JavaScript number. Verified directly against the installed
`neo4j-driver` 6.1.0 packstream source (`packstream-v1.js`): any plain JS `number`
parameter is packed as a **float**, and Neo4j rejects floats in `LIMIT`. The script
would have thrown immediately when run against production.

- **Fix:** wrap the parameter with `int()` imported from `neo4j-driver`.
- **Why it was missed:** the previous session verified only `tsc --noEmit` and the
  build; the script never executed against a database.
- **Lesson:** this was the only parameterized `LIMIT` in the codebase and the only
  place needing `neo4j.int()`. Any future Cypher that parameterizes `LIMIT`/`SKIP`
  must do the same.

### 2. Cleaned up: phantom sort key

The backfill's batch query ordered by `k.promotedAt`, a property never written
anywhere in the codebase (only `promotedBy` and `reviewedAt` exist). Removed it.
Resume order remains deterministic via `ORDER BY k.reviewedAt ASC, k.id ASC`.

### 3. Reviewed clean — no changes needed

- **Backfill safety for the live DB:** the script only `SET`s `embedding`,
  `embeddingModel`, and `embeddedAt` on `ClientKnowledge` nodes; it re-checks the
  "not yet embedded for this model" condition inside the write; the loop provably
  terminates (embedded items drop out of the next batch; an OpenAI failure exits
  with code 1 and the run is safely resumable).
- **Walls intact:** cosine ranking runs in application memory over one client's
  already-walled query result. No global vector index exists or is needed.
- **Fallback correct:** missing `OPENAI_API_KEY`, dimension/model mismatch, or a
  partially-backfilled candidate set all fall back to the complete keyword ranker,
  with `receipt.retrieval: 'keyword-fallback'`.
- **Approval resilient:** knowledge promotion still succeeds if embedding fails,
  returning `embeddingStatus: 'unavailable'` for later backfill.

## Verification completed this session

```bash
cd backend
npm test       # type-check + isolated semantic/fallback/backfill-parameter tests — passed
npm run build  # production TypeScript build — passed after fixes
```

Driver packing behavior was confirmed by reading
`backend/node_modules/neo4j-driver-bolt-connection/lib/packstream/packstream-v1.js`
(line ~87: `typeof x === 'number'` → `packFloat`), not from memory.

## Production rollout (unchanged, now actually unblocked)

1. Commit the working tree (sidhurt is the sole git persona; no Claude attribution)
   and deploy the backend with `OPENAI_API_KEY` configured. Optionally set
   `EMBEDDING_MODEL`; changing the model later requires re-running the backfill.
2. Run the backfill against the production backend environment:

   ```bash
   cd backend
   npm run backfill:client-embeddings
   ```

   Batches of 50 by default; override with `EMBEDDING_BACKFILL_BATCH_SIZE`
   (maximum 500). Safe to resume: it only writes items with no embedding for the
   configured model.
3. Smoke-test `POST /api/clients/:id/enhance` with `executionMode: 'assemble'` for a
   permitted client. Confirm `receipt.retrieval` is `semantic` after backfill and
   that `receipt.walls` still identifies exactly that client.
4. Test a request whose relevant fact/learning has no significant word overlap with
   the prompt. Confirm the semantically relevant item appears in `receipt.itemsUsed`.
5. Verify a principal outside the client's organization still receives 403. Do not
   test isolation by adding a global vector index.

## Files changed (cumulative, uncommitted)

| File | Change |
|---|---|
| `backend/src/clientBrain.ts` | (Prior session) Embedding client, activation-time persistence, wall-scoped cosine ranking, lexical fallback, receipt retrieval mode. Reviewed clean this session. |
| `backend/src/backfillClientEmbeddings.ts` | (Prior session) New resumable batch backfill. **(This session)** `int()` wrap on `LIMIT` param; removed phantom `promotedAt` sort key. |
| `backend/src/clientBrainRetrieval.ts` | Pure, testable semantic/keyword ranking behavior. |
| `backend/src/backfillClientEmbeddingsCore.ts` | Testable backfill query and Neo4j integer parameter construction. |
| `backend/src/clientBrain.behavior.test.ts` | Covers semantic selection, keyword fallback, and integer `LIMIT` binding. |
| `backend/package.json` | Adds `npm run backfill:client-embeddings`. |
| `docs/CLIENT_BRAIN_V1.md` | Corrects the old vector-index plan; records the safe implementation. |
| `README.md` | Documents backfill and current retrieval behavior. |

## Remaining backlog (unchanged)

1. **Explainability — why excluded:** add a `consideredButRejected` receipt field for
   candidates that ranking considered but did not select.
2. **Knowledge lifecycle:** archive/delete active knowledge without bypassing
   auditability.
3. **Legacy cleanup:** mark/remove `/api/enhance`, `/api/graph`, `/api/trust/*`, and
   the no-op `attach-user` route.
4. **Google-only cutover:** disable `ALLOW_DEV_LOGIN` after account-manager
   onboarding no longer needs the dev-login scaffold.

## Existing product context

- Demo client: **Meridian Foods** in **Velocity Media**; authorized demo users include
  `user-siddharth`, `user-emma`, and `user-michael`.
- The Room is where users work; the Brain is the client-specific intelligence behind it.
- Handover chain: `HANDOVER.md` → `HANDOVER_B3_2026-07-10.md` → this file.
