# UNIFIED BRAIN FAILURE MODE ANALYSIS

This document conducts an adversarial analysis of the Unified Brain's Context Engine. Assuming the architecture behaves exactly as designed, this analysis identifies the specific situations where retrieval quality degrades, producing incorrect, incomplete, or confusing Context Packs.

---

## SECTION 1 — RETRIEVAL FAILURE TAXONOMY

| Failure Name | Description | Root Cause | Expected Behavior | Actual Behavior | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **The Recency Trap** | High recency overrides weak semantic intent, pulling in the wrong project. | The algorithm relies heavily on `lastUsed` when keyword matching is low. | Retrieve intended project. | Retrieves the project worked on 10 minutes ago. | High |
| **Ambiguous Intent** | The user prompt lacks any specific noun/keyword connecting it to a graph node. | Human communication relies on implicit, unstated context. | Ask for clarification or drop context. | Guesses based entirely on Recency and Frequency. | High |
| **Project Collision** | Personal and Enterprise projects share identical or highly similar names. | Lack of strict database naming constraints between boundaries. | Merge the nodes or drop the Personal one. | Both injected into Context Pack, confusing the Prompt Engine. | Medium |
| **Cross-Domain Bleed** | A prompt uses general terminology applicable to multiple active domains/projects. | Keyword heuristics lack deep semantic understanding of abstract concepts. | Isolate the correct domain. | Pulls multiple conflicting domains into the Context Pack. | Medium |
| **Zombie Activation** | A common word triggers an `Archived` project back to `Active` incorrectly. | Keyword matching without contextual NLP checking. | Ignore the archived project. | Reactivates a dead project, polluting the graph state. | Medium |
| **Context Bloat** | User has 100 active projects; the ranking cap chops off the intended project. | Token limits force a hard cutoff (e.g., top 3 projects only). | Include all relevant projects. | Rejects project #4, leaving the LLM blind. | Low |
| **Policy Collision** | Inherited org policies contradict personal tasks or other inherited policies. | Complex org structures with overlapping rules. | Resolve the contradiction gracefully. | Injects both contradictory rules, causing LLM hallucination. | Low |

---

## SECTION 2 — AMBIGUOUS INTENT TESTING

Prompts lacking specific keywords force the Context Engine to guess. Because the engine defaults to `lastUsed` + `usageCount`, it will almost always inject the most recent project, leading to high false positives.

| Prompt | Possible Interpretations | Likely Retrieval Selection | Correct? | System Confidence |
| :--- | :--- | :--- | :--- | :--- |
| 1. "Draft an update" | Any of the user's 4 active projects. | Most recently used project. | Guess | Low |
| 2. "Review this architecture" | Unified Brain OR SAP DMS. | Whichever has highest `usageCount`. | Guess | Low |
| 3. "Prepare an email" | Depends on who the email is to. | Most recently used project. | Guess | Low |
| 4. "Analyze the risks" | Security risks for SAP vs AI risks for Unified Brain. | Highest `usageCount` project. | Guess | Low |
| 5. "Send the weekly report" | Task: Solution Design vs Architecture Review. | Task with highest Frequency. | Guess | Low |
| 6. "What's next on the agenda?" | Needs calendar context (not in graph). | Generic Identity Context only. | N/A | Low |
| 7. "Summarize the latest changes." | Unified Brain code vs SAP DMS code. | Most recently used project. | Guess | Low |
| 8. "Check for errors." | Any active project. | Most recently used project. | Guess | Low |
| 9. "Format this better." | Requires `Style` node. | Injects Style, drops Projects. | Correct | High |
| 10. "Give me a breakdown." | Financial vs Technical breakdown. | Whichever domain ranks highest. | Guess | Low |
| 11. "Write a memo." | Any active project. | Most recently used project. | Guess | Low |
| 12. "What are the tradeoffs?" | SAP vs Unified Brain architecture. | Highest `usageCount` project. | Guess | Low |
| 13. "Create a presentation." | Any active project. | Most recently used project. | Guess | Low |
| 14. "Draft the meeting notes." | Any active project. | Most recently used project. | Guess | Low |
| 15. "Can you refine this?" | Focuses on Style/Formatting. | Injects Style, drops Projects. | Correct | High |
| 16. "What are the next steps?" | Any active project. | Most recently used project. | Guess | Low |
| 17. "Summarize our progress." | Needs multi-project summary. | Top 3 Active Projects. | Correct | Medium |
| 18. "Explain this to a beginner." | Focuses on Tone/Style. | Injects Style, drops Projects. | Correct | High |
| 19. "Write a blog post about it." | Any active project. | Most recently used project. | Guess | Low |
| 20. "Identify the blockers." | Any active project. | Most recently used project. | Guess | Low |
| 21. "Create an executive summary."| Any active project. | Most recently used project. | Guess | Low |
| 22. "Review the code." | ABAP vs Backend Engineering. | Most recently used domain. | Guess | Low |
| 23. "Prepare for the presentation."| Any active project. | Most recently used project. | Guess | Low |
| 24. "What did we decide?" | Any active project. | Most recently used project. | Guess | Low |
| 25. "Draft a response." | Any active project. | Most recently used project. | Guess | Low |

---

## SECTION 3 — CROSS-DOMAIN TESTING (Siddharth Profile)

Using real projects: `Unified Brain`, `SAP DMS Integration`, `Enterprise Document Platform`. Domains: `SAP`, `Enterprise Architecture`, `AI`, `Backend Engineering`.

**Prompt 1: "How should ownership work?"**
*   **Expected Retrieval:** Requires disambiguation. Are we asking about code ownership (Backend Eng) or document ownership (Enterprise Document Platform)?
*   **Actual Retrieval:** Pulls `Backend Engineering` and `Enterprise Document Platform`.
*   **False Positive:** If the user meant code ownership for the Unified Brain, the Enterprise Document Platform was injected incorrectly.

**Prompt 2: "What should the architecture look like?"**
*   **Expected Retrieval:** Ask for clarification.
*   **Actual Retrieval:** Triggers the `Enterprise Architecture` domain and the `Architecture Review` task. Pulls the most recently used project. 
*   **False Negative:** If the user wanted the SAP DMS architecture but was most recently working on Unified Brain, SAP DMS is dropped.

**Prompt 3: "How should metadata be managed?"**
*   **Expected Retrieval:** SAP DMS or Enterprise Document Platform.
*   **Actual Retrieval:** Pulls *both* SAP DMS and Enterprise Document Platform because both heavily correlate with "metadata". 
*   **Context Pack Output:** The LLM receives two competing project contexts. The Prompt Engine may hallucinate a hybrid SAP/Document Platform metadata strategy.

---

## SECTION 4 — THE RECENCY TRAP

Recency is a powerful heuristic, but it severely distorts retrieval when the user rapidly context-switches.

1.  **Context:** Worked on SAP DMS all day yesterday. Logs on today to ask about Unified Brain: *"Review this architecture layout."*
    *   **Failure:** The weak semantic intent causes the engine to fall back on `lastUsed`. SAP DMS is injected. The LLM answers the Unified Brain question using SAP DMS context.
2.  **Context:** Just finished writing an email for Project A. Instantly asks *"Analyze these requirements"* for Project B.
    *   **Failure:** The engine assumes continuity. Project A is injected.
3.  **Context:** User presents a screen grab. *"Does this UI look right?"*
    *   **Failure:** Engine pulls the most recent project (Backend Engineering), ignoring the visual UI context.
4.  *(Examples 4-10 omitted for brevity, but all follow the pattern: A sudden context switch accompanied by a pronoun/implicit prompt guarantees a false positive injection of the previously used project).*

---

## SECTION 5 — PROJECT COLLISION TESTING

**Scenario:** Siddharth created a Personal project named "Unified Brain". Later, Velocity Media officially assigns him to the Enterprise project "Unified Brain".

*   **Context Selection:** The retrieval engine matches the keyword "Unified Brain". Both projects have an `Active` memory state. 
*   **Context Ranking:** Both receive identical Intent scores. Both are selected.
*   **Duplicate Injection:** The Context Pack outputs two objects in the `projectContext` array:
    1. `{name: "Unified Brain", type: "Personal"}`
    2. `{name: "Unified Brain", type: "Enterprise"}`
*   **Prompt Engine Confusion:** The LLM receives conflicting directives if the personal project has notes that differ from the enterprise project. The LLM cannot distinguish which "Unified Brain" the user is asking about.

---

## SECTION 6 — POLICY FAILURE TESTING

Policies bypass intent and are always injected. The failure mode here is not *retrieval*, but *LLM interpretation*.

**Prompt:** *"What are some possible ways the SAP earnings might look next quarter?"*
*   **Expected Policy Behavior:** Inject the mandatory `No speculation` policy.
*   **Actual Policy Behavior:** The policy is successfully injected into `[CRITICAL POLICIES]`.
*   **Failure Risk (Prompt Engine Level):** The LLM sees the prompt asking for possibilities, and the policy saying "No speculation." LLMs are notoriously bad at handling negative constraints ("Do not do X") when directly opposed by positive user prompts. The LLM might either:
    1. Apologize and refuse to answer entirely (Safety over-trigger).
    2. Ignore the policy and speculate anyway (Instruction drift).

---

## SECTION 7 — CONTEXT BLOAT TESTING

**Scenario:** An architect involved in micro-consulting has accumulated 100 active projects over a year.

*   **Measurement at 10 projects:** Retrieval easily identifies the top 3. Signal-to-noise is high.
*   **Measurement at 50 projects:** Keyword collision begins. Prompts using common words ("integration", "design") trigger 15 projects simultaneously.
*   **Measurement at 100+ projects:** The `lastUsed` timestamp becomes the only differentiator because `intentMatch` scores max out across dozens of projects. 
*   **Failure Mode:** If the user asks about Project #45 (which hasn't been used in 20 days), but uses a generic word ("migration"), the system ranks Projects 1, 2, and 3 higher due to recency. Project #45 is dropped from the Context Pack entirely. The retrieval quality collapses under extreme volume.

---

## SECTION 8 — BEHAVIOR DRIFT TESTING

**Scenario:** Siddharth spends 3 months exclusively on SAP DMS. In Month 4, he pivots entirely to Marketing Strategy. 

*   **Adaptation Speed:** `lastUsed` adapts immediately. Marketing Strategy projects become the new baseline.
*   **The Usage Count Lingering Effect:** SAP DMS has a `usageCount` of 400. The new Marketing project has a `usageCount` of 2.
*   **Failure Mode:** If a prompt is even slightly ambiguous, the massive 400 `usageCount` multiplier on SAP DMS will override the Recency multiplier of the Marketing project. SAP DMS will continue to artificially dominate the rankings as a "Zombie Project" for weeks until the Marketing project's `usageCount` catches up, constantly polluting the Context Pack with stale SAP logic.

---

## SECTION 9 — CONFIDENCE MODEL REVIEW

Because the engine relies on heuristic math, it *can* detect when it is guessing. 

**When Confidence is Reliable (Proceed Normally):**
*   Intent score is High (direct keyword match on a unique noun).
*   Recency is High.

**When Confidence is Unreliable (Proceed With Warning / Request Clarification):**
*   Intent score is 0. The engine is relying 100% on Recency to guess the project.
*   Two projects have identical, tied ranking scores (e.g., Cross-Domain bleed).

**System Behavior Recommendation:**
Instead of silently injecting a low-confidence project, the Context Pack API should flag `confidence: 'Low'` in the metadata. The downstream Prompt Engine or UI should intercept this and ask the user: *"Are you asking about [Project A] or [Project B]?"* before wasting an LLM call.

---

## CONCLUSION

The Unified Brain architecture is robust when user intent is explicit. However, its primary failure mode is **Implicit Human Communication**. 

When humans use pronouns ("fix this", "draft the email"), they expect the AI to possess visual or temporal awareness that the Graph Database lacks. Because the system's fallback mechanism heavily weights Recency and historical Frequency, it will confidently hallucinate the wrong context during rapid task-switching or behavior drift. 

To safely deploy this into production, the system must establish a threshold for **Low Confidence Rejection**, refusing to inject `projectContext` when semantic intent scores fall to zero, rather than blindly guessing based on timestamps.
