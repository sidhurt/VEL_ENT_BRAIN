# ThinkVelocity Unified Brain MVP & Specifications

This repository contains the implementation and architectural specifications for the ThinkVelocity Unified Brain assignment.

## Submission Deliverables

The assignment deliverables have been met across the codebase and explicitly detailed in the accompanying design specifications:

1. **Codebase:** Backend API demonstrating the Context Ranking Engine and dynamic memory evolution.
2. **Graph Schema:** Provided in `neo4j-init.cypher`, covering both Personal Brain and Company Brain initialization, including the `[:REPLACES]` rollback architecture.
3. **Design Specifications:**
   - [Form-to-Graph Mapping](file:///C:/Users/lenovo/.gemini/antigravity-ide/brain/65b16ef0-3f22-4f76-b241-82b7a1e4c024/form_to_graph_mapping.md): Defines the exact mappings, overlap, and Consumer-to-Enterprise handoff precedence.
   - [Brain Seeding Specification](file:///C:/Users/lenovo/.gemini/antigravity-ide/brain/65b16ef0-3f22-4f76-b241-82b7a1e4c024/brain_seeding_specification.md): Defines the Edge Weight Model, seeded vs inferred knowledge, retrieval logic, and storage/privacy boundaries.
   - [Company Brain Specification](file:///C:/Users/lenovo/.gemini/antigravity-ide/brain/65b16ef0-3f22-4f76-b241-82b7a1e4c024/implementation_plan.md): Defines Admin forms, policy encoding, governance, versioning/rollback, and enterprise privacy compliance.

## Setup Instructions

### Prerequisites
- Node.js (v20+)
- Docker & Docker Compose (for Neo4j)

### 1. Start the Graph Database
From the root directory, start the Neo4j instance:
```bash
docker compose up -d
```
*Wait ~15 seconds for Neo4j to initialize.*

### 2. Start the Backend API & Seed the Graph
In a new terminal window:
```bash
cd backend
npm install
npm run seed  # Runs Cypher queries to setup Consumer & Enterprise schemas + metadata
npm run dev
```

### 3. Evaluate the Relevance Engine
The backend operates the **Memory Relevance Engine**. It relies on `usageCount`, `lastUsed`, and `memoryState` to organically evolve context.
To test it, run the automated integration test:
```bash
cd backend
npx tsx test-engine.ts
```

This test demonstrates:
1. Fetching the initial graph state.
2. Firing an intent-based prompt via `/api/enhance`.
3. Verifying that the Context Ranking Engine accurately selects relevant `Archived` context and dynamically reactivates it to `Active`.
4. Simulating time passing via `/api/simulate-time`.
5. Verifying that unused context organically decays back into the `Archived` layer.

## Architecture Highlights

1. **Dynamic Relevance vs Static Caching:** Context is assembled Just-In-Time by a ranking algorithm evaluating Intent, Frequency, and Recency.
2. **Organic Evolution:** There is no manual "interact" button. The graph naturally increases edge weights when an enhancement uses a node.
3. **Decoupled Prompt Formatting:** The Unified Brain strictly outputs a `ContextPack` JSON and an `ExplainabilityReceipt`. It delegates string formatting to the downstream Prompt Engine.
4. **Explainability Receipt:** Every enhancement returns a structured receipt detailing exactly *what* was selected, *why* it was selected (e.g., "Matched intent", "Used recently"), and the system's *confidence* score.

## Technology Stack
- **Graph DB:** Neo4j (via Docker)
- **Backend API:** Node.js, Express, TypeScript, `neo4j-driver`
