# THINKVELOCITY UNIFIED BRAIN
# BRAIN SEEDING SPECIFICATION

This specification outlines the data acquisition, retrieval mechanics, and lifecycle management for the Unified Brain. It defines how raw user input evolves into highly relevant prompt templates, addressing the assignment's core architectural questions.

---

## PHASE 1 — FORM DESIGN

The onboarding experience for the Personal Brain acts as the initial "seed" for the graph. It is designed to capture the highest-value context with the lowest friction.

### Section 1: Core Identity
| Field Name | Field Type | Why it exists | Target Graph Concept | Importance |
| :--- | :--- | :--- | :--- | :--- |
| **Full Name** | Free Text | Humanizes the AI interactions and provides basic identity. | `User` node property | High-value |
| **Current Role / Title** | Free Text (with autosuggest) | Provides the foundation for the AI's persona and baseline assumptions. | `Role` node | High-value |
| **Domain Expertise** | Tag Entry | Directs the AI to use industry-specific terminology and depth. | `Domain` node | Optional, but highly recommended |

### Section 2: Active Workstreams
| Field Name | Field Type | Why it exists | Target Graph Concept | Importance |
| :--- | :--- | :--- | :--- | :--- |
| **Current Projects** | Tag Entry / Multi Select | Grounds the AI in what the user cares about *right now*. | `Project` node | High-value |
| **Recurring Tasks** | Multi Select (from common list) + Free Text | Defines standard operating procedures the user executes daily. | `Task` node | Optional |

### Section 3: Communication Preferences
| Field Name | Field Type | Why it exists | Target Graph Concept | Importance |
| :--- | :--- | :--- | :--- | :--- |
| **Tone Preference** | Radio (e.g., Direct, Conversational, Academic) | Establishes the baseline voice. | `Style` node | High-value |
| **Formatting Rules** | Checkbox (e.g., "Use bullet points", "Keep under 3 paragraphs") | Reduces friction of manually correcting AI output formatting. | `Style` node | Optional |

---

## PHASE 2 — SEEDED VS INFERRED KNOWLEDGE

The Unified Brain distinguishes between what the user explicitly tells it (Seeded) and what it learns through organic usage (Inferred).

### Seeded Knowledge
Explicit data provided via forms or direct user management.
- **Role & Domains**: Who the user is.
- **Explicit Projects**: Initiatives the user explicitly declares.
- **Base Style Rules**: Explicit formatting checkboxes checked during onboarding.

### Inferred Knowledge
Information the graph deduces by monitoring how the user interacts with the AI during enhance-time.

| Inferred Concept | Observation Source | Update Mechanism | Confidence Increase | Confidence Decay |
| :--- | :--- | :--- | :--- | :--- |
| **Relevance of a Project** | Intent matching during `/api/enhance` | Bumps `usageCount` on `WORKS_ON` edge. | Frequent matching over consecutive days. | Time passing without selection (`lastUsed` ages). |
| **Preferred Task / Intent** | Analyzing the user's raw prompt categories. | Strengthening `PERFORMS` edge to specific `Task` nodes. | User repeatedly asks for "summaries" or "drafts". | User shifts to new task types. |
| **Implicit Topic Focus** | Extracting recurring keywords from user prompts. | Connecting `User` to an inferred `Domain` node. | Multiple prompts within a week matching the topic cluster. | Ignored/unmatched for 30+ days. |

*Note: Inferred knowledge primarily modifies the weight (metadata) of existing edges rather than creating entirely new node types, keeping the graph schema clean.*

---

## PHASE 3 — EDGE WEIGHT MODEL

Edge weights represent **Relevance** and **Current Contextual Potency**. They determine whether a connected concept is pulled into the final Context Pack.

The weighting model relies on edge metadata rather than arbitrary float scores:
1. **`usageCount` (Frequency)**: A historical count of how many times this specific connection was selected during context assembly.
2. **`lastUsed` (Recency)**: A timestamp of the last successful enhancement selection.
3. **`memoryState` (Status)**: A categorical wrapper (`Active`, `Recent`, `Archived`) derived from Recency.

**The Relevance Model:**
Relevance is not pure frequency. It is a combination formula executed at query time:
- **Base Score** is determined by `memoryState` (Active = High, Recent = Medium, Archived = Zero).
- **Recency Bonus** is applied if `lastUsed` is within the last 24 hours.
- **Frequency Multiplier** is applied based on `usageCount`.
- **Semantic Multiplier** (The heaviest weight) is applied if the prompt intent directly matches the node content.

This model ensures an `Archived` project with 100 uses won't pollute the context unless the user specifically asks about it, while a brand-new `Active` project with 0 uses will be prioritized immediately.

---

## PHASE 4 — RETRIEVAL MODEL

Retrieval occurs at enhance-time to pull the correct context slice for a given prompt within a strict latency budget.

1. **Prompt Reception & Intent Detection**: 
   - *What:* The raw prompt is scanned for keywords and semantic intent.
   - *Why:* To determine what the user is actually trying to accomplish.
2. **Graph Traversal (Fan-out)**:
   - *What:* The system traverses outwards from the `User` node, gathering all connected `Projects`, `Styles`, `Tasks`, and inherited `Policies` (via Teams/Org).
   - *Why:* To gather the total universe of *possible* context for this specific user.
3. **Relevance Ranking**:
   - *What:* The Edge Weight Model is applied to the gathered nodes, comparing them against the detected intent.
   - *Why:* To separate the noise (old projects, irrelevant styles) from the signal.
4. **Context Selection**:
   - *What:* The top-ranked nodes are selected. `Archived` nodes are dropped entirely unless they triggered a direct semantic match.
   - *Why:* To fit within the LLM's context window and ensure maximum prompt quality.

---

## PHASE 5 — CONTEXT PACK DESIGN

The Context Pack is the structured template passed to the downstream Prompt Engine. The graph's nodes are mapped into a strict, predictable format.

**Structured Output Template:**

```text
[SYSTEM]: You are assisting a user with the following profile:
{Identity Context: Role, Domain} (Mandatory)

[ACTIVE WORK CONTEXT]:
{Project Context: Node Names/Descriptions} (Optional - Included if ranked highly)

[TASK DIRECTIVE]:
{Task Context: Standard Operating Procedures} (Optional - Included if intent matches)

[COMMUNICATION GUIDELINES]:
{Style Context: Formatting Rules, Tone} (Mandatory - Falls back to default if none specified)

[CRITICAL POLICIES]:
{Policy Context: Mandatory Rules} (Mandatory for Enterprise users)

[USER PROMPT]:
{Raw User Input}
```

**Transformation:** 
The Unified Brain outputs the selected JSON nodes. The Prompt Engine consumes this JSON and structurally maps the `Role` node to Identity, `Project` nodes to Work Context, and `Policy` nodes to Critical Policies, injecting them securely before the user's raw prompt.

---

## PHASE 6 — COLD START

A brand-new user with an empty brain must experience immediate value.

- **Empty User (Skipped Onboarding)**: The system defaults to general best-practices context (e.g., "Helpful assistant", "Clear formatting"). No graph context is injected.
- **Partially Completed Onboarding**: If only Role is provided, the Context Pack populates the `[Identity Context]` and skips the `[Project Context]`. The LLM still produces a better output than a blank slate because it knows *who* the user is.
- **Fully Seeded Onboarding**: The user immediately receives a rich Context Pack with Identity, Projects, and Styles. The `memoryState` for all seeded items defaults to `Active`.

Over time, organic usage will transition an empty or partial user into a rich graph as the system infers context and promotes edge creation.

---

## PHASE 7 — FRESHNESS MODEL

The Freshness Model ensures the Context Pack never suffers from "context rot." 

**States:**
- **Active**: Actively participating in recent prompts or newly seeded.
- **Recent**: Hasn't been used in a few days, but still potentially relevant.
- **Archived**: Hasn't been used in 30+ days. Stripped from the Context Pack.

**Transitions:**
- **Decay**: If a node is not selected during Context Assembly, its `lastUsed` timestamp ages. A background cron job or query-time evaluation shifts the state down (Active -> Recent -> Archived) as time passes.
- **Reactivation**: If the user explicitly mentions an `Archived` project in a prompt, the Intent Detection catches it. The node is pulled into the Context Pack, and its state is immediately upgraded back to `Active`, resetting its `lastUsed` timestamp. 
- **Surfacing Stale Info**: The frontend UI queries memory states. `Archived` items are hidden under a "History" tab, allowing the user to view or manually delete them if desired.

---

## PHASE 8 — STORAGE BOUNDARIES

Because the Personal Brain is sensitive and the Company Brain is governed, strict storage boundaries are maintained.

| Data Type | Storage Location | Reason (Privacy & Compliance) |
| :--- | :--- | :--- |
| **Company Policies & Org Structure** | Server-side (Graph DB) | Must be centrally governed, updated, and audited by Admins. Users cannot edit these. |
| **Personal Profile & Projects** | Server-side (Graph DB) | Stored server-side to allow graph traversal and relationship building. Secured via strict User-ID row-level access. |
| **Raw User Prompts** | Client-side (Browser / Extension) | **NEVER stored server-side.** The server only receives the prompt temporarily in memory to run Intent Detection, then discards it. Prevents massive legal liability and protects user IP. |
| **Usage Metadata (Edge Weights)** | Server-side (Graph DB) | Necessary to calculate relevance. Stored as integers and timestamps, not as raw PII. |
| **Final Enhanced Prompt** | Client-side (Browser / Extension) | The final string assembly happens in the client or is immediately passed to the LLM. The server does not log the final text. |

---

## PHASE 9 — LATENCY TARGET

**Target Added Latency:** `< 150ms`

**Reasoning:**
The Unified Brain sits *between* the user hitting "Submit" and the LLM receiving the prompt. 
- Human perception of instantaneous action is ~100ms. 
- LLM generation inherently takes seconds (TTFB is usually 500ms - 2000ms). 
- Therefore, adding 100-150ms for Context Assembly is virtually imperceptible to the user, hidden inside the LLM's natural network delay.

**Tradeoffs:**
To hit `< 150ms`:
- We rely on metadata (`usageCount`, `memoryState`) and fast graph traversals rather than making secondary LLM calls for complex semantic extraction. 
- Intent Detection utilizes fast keyword heuristics and embeddings stored in memory, rather than synchronous API calls to external classifiers. 
- Graph queries are depth-limited (e.g., `[*0..2]`) to prevent unbounded traversal times.
