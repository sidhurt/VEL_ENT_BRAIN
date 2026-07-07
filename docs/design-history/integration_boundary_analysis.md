# Integration Boundary Analysis: Unified Brain vs. Velocity

This document evaluates two potential integration models for connecting the Velocity Prompt Engine (Sidebar Extension) with the Unified Brain backend.

## The Models

- **Model A (The Context Provider):** Velocity requests a `ContextPack` from the Unified Brain, but Velocity's Prompt Engine remains responsible for formatting the context and executing the prompt rewrite via its existing LLM APIs.
- **Model B (The Blackbox Enhancer):** Velocity forwards the raw prompt to the Unified Brain. The Unified Brain retrieves context, performs the prompt rewriting itself, and returns the finalized prompt to Velocity.

---

## Evaluation Criteria

### 1. Separation of Concerns
- **Model A (Winner):** Clean architectural lines. The Unified Brain is strictly a **Memory & Governance Engine** (Graph traversal, scoring, decay). Velocity is strictly an **Execution & Formatting Engine** (LLM streaming, UI injection, prompt engineering). 
- **Model B:** Blurs the lines. The Brain would suddenly need to understand LLM-specific prompting syntax (e.g., Anthropic XML tags vs. OpenAI system prompts), token limits, and prompt engineering logic, making it a monolithic bottleneck.

### 2. Existing Velocity Architecture
- **Model A (Winner):** Velocity already has a highly complex, battle-tested Python backend for prompt enhancement (`api.thinkvelocity.in/dev/test/enhance/stream`). Model A simply augments this existing pipeline by giving it a `ContextPack` to include in its request.
- **Model B:** Requires completely ripping out or duplicating the existing Python enhancement pipeline and migrating it into the Node.js/Neo4j Unified Brain. This is a massive, unnecessary refactor.

### 3. Enterprise Governance Requirements
- **Tie:** Both models successfully enforce governance. In Model A, the Brain forcefully injects 10,000-point Policies into the `ContextPack` which Velocity must append. In Model B, the Brain enforces it during rewriting. Model A is slightly better because Velocity's enterprise guardrail APIs (`/backend/guardrail/check`) are already built to run in the extension layer before enhancement.

### 4. Scalability
- **Model A (Winner):** Extremely scalable. The Unified Brain only executes lightning-fast Neo4j graph traversals (milliseconds) and returns JSON. Velocity's Python infrastructure handles the long-running LLM streams.
- **Model B:** The Unified Brain would become responsible for holding long-lived SSE connections and waiting for LLM responses, significantly increasing the compute load and memory overhead on the graph server.

### 5. Future Maintainability
- **Model A (Winner):** If Velocity wants to support a new AI platform (e.g., Llama 3), only the Velocity Prompt Engine needs to update its formatting logic. The Brain remains completely agnostic to the end-platform. 
- **Model B:** Any change in LLM models, token limits, or formatting strategies requires deploying updates to the Unified Brain, violating the single-responsibility principle.

---

## Final Recommendation: Model A

**I strongly recommend proceeding with Model A.**

The Unified Brain should act purely as a headless **Just-In-Time Context Provider**. 

By adopting Model A, the integration boundary is a simple JSON API contract (`ContextPack`). Velocity remains in charge of how the prompt is rewritten, while the Brain guarantees that Velocity is always equipped with the smartest, most relevant slice of user history and enterprise policy.
