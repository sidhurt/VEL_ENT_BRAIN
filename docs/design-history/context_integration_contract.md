# Context Integration & Validation Contract

This document validates the Unified Brain's role as a fully decoupled Context Provider. The Unified Brain does not format prompts or interact with LLMs; it performs context modeling, retrieval, and policy enforcement, outputting a highly structured, machine-readable `ContextPack`.

---

## TASK 1 — CONTEXT PACK CONTRACT

The Context Pack is the API response consumed by Velocity's external Prompt Engine. It is pure structured data, stripped of natural language pleasantries.

### Schema Definition
```typescript
interface ContextPack {
  metadata: {
    retrievalTimestamp: string;
    processingLatencyMs: number;
    contextNodesInjected: number;
  };
  identityContext: {
    name: string;
    role: string;
    domains: string[];
  };
  projectContext?: { // Optional
    id: string;
    name: string;
    type: 'Personal' | 'Enterprise';
  }[];
  policyContext?: { // Mandatory if enterprise user
    id: string;
    ruleText: string;
    classification: 'Mandatory' | 'Guideline' | 'Prohibited';
  }[];
  styleContext?: string[]; // Optional
  taskContext?: { // Optional
    taskName: string;
    sop: string;
  }[];
}
```

### Field Explanations
*   **`identityContext`**: Sourced from the `User`, `Role`, and `Domain` nodes. Purpose: Gives the LLM a persistent persona and baseline vocabulary.
*   **`projectContext`**: Sourced from `Project` nodes via `WORKS_ON`. Purpose: Grounds the LLM in specific current workstreams. Only the top-ranked active/relevant projects are returned.
*   **`policyContext`**: Sourced from `Policy` nodes via `ENFORCES`. Purpose: Hard guardrails. The Prompt Engine must strictly adhere to these.
*   **`styleContext`**: Sourced from `Style` nodes. Purpose: Provides specific output formatting instructions.
*   **`taskContext`**: Sourced from `Task` nodes. Purpose: Injects standard operating procedures if the user asks for a routine action (e.g., "Write a weekly report").

---

## TASK 2 — EXPLAINABILITY SEPARATION

The Unified Brain produces two distinct artifacts during retrieval:

1.  **The Context Pack**: A machine-readable JSON object (defined above) consumed *only* by the Prompt Engine.
2.  **The Explainability Receipt**: A human-readable JSON object consumed *only* by the Frontend UI.

**Why they must not be merged:**
The LLM does not need to know *why* a policy was injected; telling the LLM "I injected this policy because you used it recently" wastes tokens and confuses the AI's instruction following. Conversely, the UI does not need the raw textual content of the `identityContext` to render a trust widget. Separation of concerns guarantees optimal LLM performance and optimal UI rendering.

### Explainability Receipt Schema
```typescript
interface ExplainabilityReceipt {
  nodesSelected: {
    type: string; // e.g., 'Policy', 'Project'
    name: string;
    confidence: 'High' | 'Medium' | 'Low';
    reasons: string[]; // e.g., ['Matched intent', 'Active state']
  }[];
}
```

---

## TASK 3 — REALISTIC TEST USERS

### Persona 1: Technology Journalist (Jane)
*   **Onboarding:** Role: "Senior Tech Journalist". Domains: "AI, Hardware".
*   **Projects:** "Q1 Smartphone Reviews" (Active), "Global AI Summit" (Recent).
*   **Style:** "Use active voice. Short paragraphs."
*   **Expected Retrieval (Prompt: "Draft an intro for the new phone"):** Pulls `Role`, `Smartphone Reviews` project, and `Style`. Drops `AI Summit` due to irrelevance.

### Persona 2: SAP Consultant (David)
*   **Onboarding:** Role: "SAP Implementation Lead". Domains: "ERP, Supply Chain".
*   **Projects:** "Project Titan Migration" (Active).
*   **Tasks:** "Status Report SOP".
*   **Expected Retrieval (Prompt: "Generate a status report"):** Pulls `Role`, `Project Titan`, and `Status Report SOP`.

### Persona 3: Marketing Manager (Sarah)
*   **Onboarding:** Role: "Growth Marketing Manager". Domains: "B2B SaaS, SEO".
*   **Projects:** "Q3 Webinar Series" (Active), "Ad Spend Q1" (Archived).
*   **Expected Retrieval (Prompt: "Write an email sequence for the webinar"):** Pulls `Role` and `Q3 Webinar Series`.

### Persona 4: Finance Analyst (Michael)
*   **Onboarding:** Role: "Financial Planning Analyst". Domains: "Fintech, Forecasting".
*   **Style:** "Use bullet points. Data-driven tone."
*   **Expected Retrieval (Prompt: "Summarize this spreadsheet"):** Pulls `Role`, `Style`.

### Persona 5: Startup Founder (Alex)
*   **Onboarding:** Role: "CEO/Founder". Domains: "Startups, VCs".
*   **Projects:** "Series A Deck" (Active).
*   **Expected Retrieval (Prompt: "Draft an investor update"):** Pulls `Role`, `Series A Deck`.

---

## TASK 4 — ENTERPRISE TEST SCENARIOS

**Scenario: Media Company Governance**
*   **Company:** Global News Network
*   **User:** Jane Doe (Technology Journalist, member of Editorial Team)
*   **Company Policies:** 
    1. "No Speculation: Do not include unverified financial projections." (Mandatory)
    2. "AP Style enforcement." (Guideline)
*   **Prompt:** "Review the upcoming AI stock trends and guess where they will land in Q4."

**Expected Retrieval & Conflict Resolution:**
*   **Context Pack Output:** Contains Jane's `identityContext` and active `projectContext`. 
*   **Policy Injection:** The system detects Jane's `MEMBER_OF -> Team -> ENFORCES -> Policy` graph paths. It forcibly injects the `No Speculation` and `AP Style` policies into `policyContext`.
*   **Conflict Resolution:** Even though Jane asked the AI to "guess" (speculate), the Prompt Engine will prioritize the Unified Brain's `Mandatory` policy array, effectively blocking the LLM from generating speculative content.

---

## TASK 5 — EDGE CASE TEST SUITE

| Scenario | Input | Expected Context Pack Retrieval | Pass Criteria |
| :--- | :--- | :--- | :--- |
| **1. Empty User** | Brand new user, no forms filled. | Empty projects/styles. Fallback `Role: User`. | System does not crash; returns minimal valid JSON. |
| **2. Partially Seeded** | User filled Role, but skipped Projects. | Returns `identityContext`. `projectContext` is omitted. | No hallucinated projects. |
| **3. 100 Projects** | User has 100 Active Projects. | Returns top 3 `projectContext` nodes based on Intent & Recency. | Pack is capped; does not blow out LLM token limit. |
| **4. Archived Reactivation** | User asks about an `Archived` project. | Intent detector triggers direct match. Project is returned in `projectContext`. | Edge weight updates back to `Active`. |
| **5. Joining Enterprise** | User gets added to a Company Team. | Subsequent prompts instantly include Company `policyContext`. | No manual refresh required (JIT retrieval works). |
| **6. Policy Change** | Admin edits a mandatory policy. | The very next Context Pack contains the updated `ruleText`. | Old policy is not present. |
| **7. Ownership Conflict** | User creates "Acme Launch" (Personal). Company assigns "Acme Launch" (Enterprise). | Both returned, or Enterprise prioritized if metadata matches exactly. | No database constraint crash. |
| **8. Style Conflict** | Personal: "Use Emojis". Company: "Professional tone, no emojis". | Company style overrides Personal style in Context Pack due to Precedence rules. | Only Company Style is present in `styleContext`. |

---

## TASK 6 — CONTEXT PACK VALIDATION

To ensure the Context Pack remains a reliable input for the Prompt Engine, the Unified Brain API enforces these validation rules before returning the payload:

1.  **Too Much Information (Token Bloat):** The engine caps `projectContext` to a maximum of 3 active/relevant nodes. 
2.  **Too Little Information (Cold Start):** If `identityContext` is entirely blank, the system injects a default `role: "Professional Assistant"` to prevent downstream Prompt Engine crashes.
3.  **Conflicting Information:** Personal `styleContext` nodes are silently dropped if an Enterprise `MANDATES_STYLE` edge exists in the traversal path.
4.  **Stale Information:** Nodes with `memoryState: 'Archived'` are structurally filtered out of the SQL/Cypher result set before validation unless overridden by an explicit Intent Match.
5.  **Duplicate Information:** Array deduplication is run on `policyContext` (e.g., if a user belongs to two teams that inherit the same Org policy).

---

## TASK 7 — FINAL OUTPUT EXAMPLE

**Endpoint:** `POST /api/context-pack`

**Input Payload:**
```json
{
  "userId": "user-jane-doe",
  "prompt": "Write an article about OpenAI's enterprise adoption"
}
```

**Final Context Pack API Response (Consumed by Prompt Engine):**
```json
{
  "contextPack": {
    "metadata": {
      "retrievalTimestamp": "2026-06-11T14:30:00Z",
      "processingLatencyMs": 84,
      "contextNodesInjected": 4
    },
    "identityContext": {
      "name": "Jane Doe",
      "role": "Senior Technology Journalist",
      "domains": ["Artificial Intelligence", "Enterprise Software"]
    },
    "projectContext": [
      {
        "id": "proj-ai-summit",
        "name": "Global AI Summit Coverage",
        "type": "Enterprise"
      }
    ],
    "policyContext": [
      {
        "id": "pol-no-speculation-v2",
        "ruleText": "Do not include unverified speculation or unpublished financial projections in any content.",
        "classification": "Mandatory"
      },
      {
        "id": "pol-ap-style",
        "ruleText": "Strictly adhere to AP Style guidelines for all reporting.",
        "classification": "Guideline"
      }
    ]
  },
  "explainabilityReceipt": {
    "nodesSelected": [
      {
        "type": "Project",
        "name": "Global AI Summit Coverage",
        "confidence": "High",
        "reasons": ["Matched intent: 'OpenAI'", "Active state"]
      },
      {
        "type": "Policy",
        "name": "No Speculation Rule (v2)",
        "confidence": "High",
        "reasons": ["Mandatory enterprise policy"]
      }
    ]
  }
}
```

### Success Verification
1. **What it returns:** Pure JSON structured data. No formatted prompt strings.
2. **Structure Sufficiency:** The downstream Prompt Engine has all the raw variables needed to construct a highly specific system prompt template.
3. **Retrieval Behavior:** Only the highly relevant "AI Summit" project was pulled, ignoring Jane's other projects.
4. **Policy Enforcement:** The mandatory Enterprise policies were successfully mapped into the rigid `policyContext` array.
5. **Consumption Readiness:** The Prompt Engine does not need to know what Neo4j is or how a graph works; it simply maps the JSON keys to its prompt template.
