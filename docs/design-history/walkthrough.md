# Walkthrough: Memory Relevance Engine

The Unified Brain's Phase 2 evolution is complete. The system has successfully transitioned from a static configuration store into a **dynamic, relevance-driven memory engine**. 

Crucially, the system now respects the architectural boundary you set: **The Unified Brain owns context selection and lifecycle; the Prompt Engine owns prompt formatting.**

## What Changed

### 1. Organic Evolution (No Interaction Endpoint)
We avoided creating a rigid, artificial `POST /api/interact` loop. 
Instead, memories naturally evolve when they participate in the system via the `POST /api/enhance` (Context Assembly) endpoint. When a memory node is matched and selected for a Context Pack, the system automatically:
- Increments its `usageCount`
- Updates its `lastUsed` timestamp
- Recalculates its `memoryState` (e.g., reactivating an `Archived` project)

### 2. Context Ranking Engine
The Context Assembly endpoint now runs a multi-factor ranking algorithm to filter out noise and only deliver the most potent context.
The `dynamicScore` is calculated based on:
- **Intent Match:** Heavy weighting if the prompt contains words matching the memory's content.
- **Active Association:** `Active` memories receive a higher baseline score than `Recent` ones.
- **Frequency & Recency:** Bonus points for memories that are used often, or were used in the last 24-hours to 7-days.
- **Archival Filtering:** `Archived` memories are strictly excluded *unless* they trigger a strong direct intent match, in which case they are selected and immediately reactivated.

### 3. Upgraded Explainability Receipt
The `/api/enhance` endpoint no longer returns a formatted `[SYSTEM]: You are assisting...` string. It now outputs pure structured JSON designed for the downstream Prompt Engine. 

The `ExplainabilityReceipt` has been significantly enhanced. Instead of a flat list, the API now returns the *why*:
```json
{
  "node": { "type": "Project", "content": "Global AI Summit Coverage" },
  "reasons": ["Matched intent", "Active state", "Used recently"],
  "confidence": "High"
}
```

### 4. Time Simulation (`/api/simulate-time`)
For demonstration and evaluation purposes, a new simulation endpoint was added. This allows us to artificially age the memory graph by advancing timestamps without waiting days. 
- Calling `/api/simulate-time` with `{ "days": 10 }` will push untouched `Active` projects into the `Recent` layer.
- Pushing it past 30 days will drop them into the `Archived` layer.

## How to Test the Engine

1. **Seed the Graph:** Run `npm run seed` or use the Neo4j cypher script to reset the database. The initial edges are now pre-populated with `usageCount`, `lastUsed`, and `memoryState`.
2. **Context Assembly:** Call `POST /api/enhance` with a specific prompt (e.g., `"draft an article about the upcoming smartphone reviews"`). You will see the smartphone project score highly. If you check the Neo4j graph, you will notice its usage metadata increased organically.
3. **Age the Graph:** Call `POST /api/simulate-time` with `days: 40`.
4. **Reactivation:** Call `POST /api/enhance` again with the same prompt. You will see the system detect the `Archived` smartphone project, include it in the Context Pack, and successfully reactivate its state back to `Active`.

> [!TIP]
> The `/api/cards/:userId` endpoint also returns the dynamic `memoryState`, allowing your frontend to visually sort and group memories into Active/Recent/Archived tiers effortlessly.
