# ContextPack

The ContextPack is Unified Brain's core output contract: the structured,
pre-authorized context handed to an LLM (or any downstream consumer) for one
reasoning act. The Brain deliberately does **not** format prompts — it outputs
structure; prompt rendering belongs to the consumer (or to our own generation
wrapper when `executionMode: 'execute'`).

Two pack shapes exist, matching the two assembly paths.

## 1. Client Brain pack (V1 product)

`POST /api/clients/:clientId/enhance` with `{ "prompt": "...", "executionMode": "assemble" }`

```json
{
  "contextPack": {
    "clientId": "client-meridian-foods",
    "clientName": "Meridian Foods",
    "voice": [
      "Witty older-cousin tone; Hinglish is core; never corporate words like 'synergy'"
    ],
    "rules": [
      "Never claim health benefits — 'healthy', 'nutritious', 'guilt-free' banned by legal",
      "Price/discount posts require brand-manager approval before publishing"
    ],
    "facts": [
      { "title": "Hero SKU", "content": "Masala Twist Keri Chips, Rs 20 pack; Q3 launch: Chatpata Makhana line at Rs 99" }
    ],
    "learnings": [
      { "title": "Engagement peaks after 9 PM IST", "content": "Posting after 9pm consistently beats morning slots" }
    ]
  },
  "receipt": { "…": "see EXPLAINABILITY_RECEIPT.md" }
}
```

**Assembly semantics** (in `backend/src/clientBrain.ts`):
- `voice` and `rules` are **always included** — generation without brand voice and
  hard constraints is what makes AI output generic and unsafe.
- `facts` and `learnings` are ranked against the request (keyword + usage weight
  today; embeddings-based retrieval is the next quality milestone) and capped
  (6 facts, 4 learnings).
- Selected items are reinforced (`usageCount + 1`, `lastUsed`), feeding the memory
  evolution model.

With `executionMode: 'execute'` (default), the response additionally contains
`generatedOutcome` — the pack is rendered into a client briefing (voice → mandatory
rules → facts → learnings) and sent to the generation model.

## 2. Personal memory pack (original engine)

`POST /api/enhance` with `{ "prompt": "...", "executionMode": "assemble" | "execute" }`

```json
{
  "contextPack": {
    "identityContext": { "name": "Jane Doe", "roles": ["Financial Analyst"], "domains": ["Fintech"] },
    "projectContext": [ { "id": "proj-q1-earnings", "name": "Q1 Tech Earnings" } ],
    "taskContext":    [ { "id": "task-report", "name": "Quarterly reporting" } ],
    "styleContext":   [ "Concise, tables over prose" ],
    "policyContext":  [ { "id": "pol-tone", "ruleText": "All external docs use formal tone" } ]
  },
  "explainabilityReceipt": [ "…" ],
  "outcomeProfile": "Generic",
  "pipelineTrace": [ { "step": "Request Received", "time": 1783300000000 } ]
}
```

**Assembly semantics** (in `backend/src/graphService.ts`):
- Candidate memories are fetched through fixed, ownership-bound query shapes only.
- Policies bypass ranking entirely — mandatory context is forced in.
- Everything else is scored on intent match, memory state (`Active` > `Recent` >
  `Archived`), frequency, and recency; archived memories can reactivate on strong
  matches.

## 3. Guarantees

1. Nothing enters a pack that the authenticated principal was not authorized to
   reach — enforcement happens at query construction, not post-filtering.
2. A Client Brain pack contains exactly one client's knowledge, by construction.
3. Every pack ships with its receipt; a pack without provenance is a bug.
