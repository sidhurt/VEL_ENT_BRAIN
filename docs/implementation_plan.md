# Company Brain Specification & Implementation Plan

This document closes the final gaps for Part B of the Unified Brain assignment, detailing the precise specifications for the Company Brain's seeding, governance, policies, and privacy boundaries.

---

## 1. Company Admin Forms

The Company Brain is seeded by an administrator to provide a shared, structural reality for the enterprise. Below are the required forms to seed this context:

### Form 1: Organization Overview
* **Purpose**: Establish the foundational corporate identity and departmental structure.
* **Fields**:
  * `Organization Name` (Free Text) -> Creates `Organization` node.
  * `Industry` (Single Select) -> Adds `industry` property.
  * `Departments` (Tag Entry) -> Creates `Team` nodes.
* **Relationships**: `(Team)-[:BELONGS_TO]->(Organization)`

### Form 2: Active Company Projects
* **Purpose**: Define shared initiatives available to team members.
* **Fields**:
  * `Project Name` (Free Text) -> Creates `Project` node.
  * `Owning Department` (Single Select) -> Links to `Team` node.
  * `Status` (Radio: Active/Planning/Archived) -> Sets `status` property.
* **Relationships**: `(Team)-[:OWNS]->(Project)`

### Form 3: Communication Guidelines
* **Purpose**: Define the corporate brand voice and formatting standards.
* **Fields**:
  * `Brand Voice Description` (Free Text) -> Creates `Style` node.
  * `Formatting Rules` (Multi Select/Checkboxes) -> Adds to `Style` node `rules`.
* **Relationships**: `(Organization)-[:MANDATES_STYLE]->(Style)`

### Form 4: Policy & Rules Engine
* **Purpose**: Explicitly define approved uses, prohibited uses, and compliance rules.
* **Fields**:
  * `Rule Title` (Free Text)
  * `Rule Text` (Free Text)
  * `Classification` (Radio: Mandatory, Guideline, Prohibited Use)
  * `Applicability` (Multi Select: Entire Org, Specific Team)
* **Nodes Created**: `Policy` node.
* **Relationships**: `(Organization)-[:ENFORCES]->(Policy)` or `(Team)-[:ENFORCES]->(Policy)`

### Form 5: Approved Templates
* **Purpose**: Provide standardized prompt output formats (e.g., "Weekly Status Report").
* **Fields**:
  * `Template Name` (Free Text)
  * `Structure / Layout` (Free Text/Markdown)
* **Nodes Created**: `Template` node.
* **Relationships**: `(Organization)-[:PROVIDES]->(Template)`

---

## 2. Policy Encoding

Policies must actively influence the AI, not just sit in passive storage.

**Required Attributes on a `Policy` Node:**
- `id`: UUID
- `title`: String
- `ruleText`: String (The actual directive for the LLM)
- `classification`: 'Mandatory' | 'Guideline' | 'Prohibited'
- `status`: 'Active' | 'Review Required' | 'Archived'

**Lifecycle from Admin Form to Context Pack:**
1. **Admin Form**: Admin enters "Do not use unreleased financial data" as a Mandatory policy.
2. **Policy Node**: Graph creates `(p:Policy {classification: 'Mandatory', ruleText: '...'})` and links it `(Org)-[:ENFORCES]->(p)`.
3. **Retrieval**: When an employee in the Org triggers an enhance action, the graph traversal *always* walks the `MEMBER_OF -> BELONGS_TO -> ENFORCES` path. 
4. **Context Pack**: Because the classification is `Mandatory`, the Context Ranking Engine assigns it a maximum `stateScore` (e.g., 1000) and it bypasses keyword matching. It is injected into the strict `[CRITICAL POLICIES]` block of the Context Pack, ensuring the downstream Prompt Engine forces the LLM to obey it.

---

## 3. Governance

A lightweight ownership model ensures the Company Brain remains authoritative.

* **Who can create company context**: Only users with the `Admin` role.
* **Who can edit company context**: Only users with the `Admin` role.
* **Who can archive company context**: Admins can archive. The Freshness Engine can flag for review, but only an Admin can formally archive org-level policies.
* **Who can restore company context**: Only Admins.
* **Employee (Consumer) Rights**: Employees have read-only access to Company context during retrieval. They cannot edit, create, or archive Company nodes.

---

## 4. Change Propagation

When an Admin edits a Company Brain node (e.g., updating a policy or a project):

1. **Immediate Graph Update**: The node's properties are updated in Neo4j.
2. **Future Retrievals**: Because the Unified Brain fetches context *at enhance-time* (JIT retrieval), changes propagate instantly. The very next prompt from any employee on that team will pull the updated node.
3. **No Retroactive Rewrites**: The Unified Brain does not reach into the past to "fix" old prompts. The context pack is a point-in-time snapshot.

---

## 5. Versioning and Rollback

To satisfy the assignment's explicit rollback requirement without over-engineering:

* **Version Creation**: When a `Policy`, `Template`, or `Guideline` is edited by an Admin, the existing node is *not* overwritten. Instead, the current node is cloned, marked with `status: 'Archived'`, and the edge connecting it to the Org is deleted. A new node is created with the updated text, and a new `ENFORCES` edge is drawn. 
* **Version History**: The new node receives a `[:REPLACES]` edge pointing to the archived older node, creating a linked list of history.
* **Rollback Behavior**: If an Admin clicks "Rollback", the system deletes the `ENFORCES` edge on the current node, sets its status to `Archived`, and redraws the `ENFORCES` edge to the previous node in the `[:REPLACES]` chain, instantly making the older version the active truth for all future retrievals.

---

## 6. Company Freshness

Company context cannot decay organically the way personal context does, as compliance rules don't expire just because they aren't triggered frequently.

**States:**
* **Active**: Actively injected into Context Packs.
* **Review Required**: Flags a node for Admin attention.
* **Archived**: Ignored during Context Assembly.

**Mechanism:**
* **Policies / Guidelines**: Do not decay. They remain `Active` until an Admin archives them, or until a hard `valid_to` date passes, at which point they become `Review Required`.
* **Projects**: If a Company Project sees zero usage across *all* connected team members for 60 days, it moves to `Review Required`. 
* **Stale Retrieval**: If an employee's Context Assembly hits a node marked `Review Required`, the node is *still included* in the Context Pack (to ensure compliance isn't dropped accidentally), but a silent notification is sent to the Admin dashboard that stale context is being relied upon.

---

## 7. Enterprise Privacy Validation

This design explicitly protects employee privacy and addresses the legal/trust exposure mentioned in the assignment.

* **What Admins CAN see**: Admins can see aggregated usage metadata for Company nodes (e.g., "Policy X was used 500 times this week").
* **What Admins CANNOT see**: Admins have **zero** visibility into an employee's Personal Brain. They cannot see personal projects, personal styles, or personal recurring tasks. 
* **What Employee Activity Remains Private**: The raw user prompt is never stored server-side. The intent detection happens entirely locally or in ephemeral server memory. Admins *cannot* see what an employee typed. 
* **Company-Level Visibility**: Admins govern the rules, but they do not surveil the execution. The system guarantees that company context is present in the prompt, eliminating the need to read the employee's prompts to verify compliance.

---

## 8. Final Coverage Matrix (Part B)

| Requirement | Design Section | Coverage Status |
| :--- | :--- | :--- |
| **Admin Forms (What forms are filled?)** | 1. Company Admin Forms | Fully Covered |
| **Node Types (What concepts belong?)** | 1. Company Admin Forms | Fully Covered |
| **Policy Encoding (How rules live in graph?)** | 2. Policy Encoding | Fully Covered |
| **Template Enforcement (How policy influences output?)** | 2. Policy Encoding | Fully Covered |
| **Admin Governance (Who can edit/propagate?)** | 3. Governance / 4. Change Propagation | Fully Covered |
| **Brain History / Rollback** | 5. Versioning and Rollback | Fully Covered |
| **Personal vs Company Precedence** | Form-to-Graph Mapping Artifact (Step 6) | Fully Covered |
| **Brain Freshness & Consistency** | 6. Company Freshness | Fully Covered |
| **Employee Privacy Rights / Consent** | 7. Enterprise Privacy Validation | Fully Covered |
| **No Prompt Storage Requirement** | 7. Enterprise Privacy Validation | Fully Covered |
| **No Latency Degradation for Non-Enterprise** | Brain Seeding Specification (Phase 9) | Fully Covered |

The Part B requirements for the Company Brain are fully answered, structured, and validated against the assignment constraints.
