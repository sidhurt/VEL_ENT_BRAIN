# Form-to-Graph Mapping & Ontology

This document defines the semantic transformation from frontend onboarding forms into the backend knowledge graph for the Unified Brain.

## STEP 1 & 2: Personal Brain Onboarding Mapping

The Personal Brain captures the individual's professional identity, active work, and communication preferences.

| Onboarding Form Field | Creates Node Type | Relationship Created | Ownership | Seeded / Inferred | Retrieval Usage | Reason / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Full Name & Contact** | `User` | N/A (Root node) | Personal | Seeded | Base | Root traversal node. |
| **Professional Role** | `Role` | `(User)-[:HAS_ROLE]->(Role)` | Personal | Seeded | Yes | Defines the core persona for prompt templates. |
| **Domain Expertise** | `Domain` | `(User)-[:EXPERT_IN]->(Domain)` | Personal | Seeded | Yes | Contextualizes industry-specific terminology. |
| **Active Projects** | `Project` | `(User)-[:WORKS_ON]->(Project)` | Personal | Seeded (Initial) / Inferred (Updates) | Yes | Highly relevant for grounding tasks in current context. |
| **Communication Style** | `Style` | `(User)-[:HAS_STYLE]->(Style)` | Personal | Seeded | Yes | Directs the AI's tone, formatting, and voice. |
| **Recurring Tasks** | `Task` | `(User)-[:PERFORMS]->(Task)` | Personal | Seeded | Yes | Helps AI understand frequent intents immediately. |

> [!NOTE]
> Usage metadata (`usageCount`, `lastUsed`, `memoryState`) is applied directly to the *Relationships* (e.g., `WORKS_ON`), not the nodes themselves, allowing the graph to track how the User interacts with the concept over time.

---

## STEP 3: Personal Brain Minimum Graph Ontology

To avoid unnecessary complexity, the Personal Brain requires a very tight ontology. 

**Node Types:**
1. `User` (Central Identity)
2. `Role` (Professional Title)
3. `Domain` (Industry / Subject Matter)
4. `Project` (Active workstreams)
5. `Style` (Tone, voice, formatting rules)
6. `Task` (Standard operating procedures)

**Relationship Types:**
- `HAS_ROLE`
- `EXPERT_IN`
- `WORKS_ON`
- `HAS_STYLE`
- `PERFORMS`

---

## STEP 4: Company Brain Onboarding Mapping

The Company Brain is seeded by an Admin to establish the structural and governance reality of the enterprise.

| Admin Form Field | Creates Node Type | Relationship Created | Ownership | Seeded / Inferred | Retrieval Usage | Reason / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Organization Name** | `Organization` | N/A (Root Enterprise Node) | Company | Seeded | Base | The anchor for enterprise rules. |
| **Departments / Teams**| `Team` | `(Team)-[:BELONGS_TO]->(Organization)` | Company | Seeded | Base | Structural hierarchy for routing rules. |
| **Company Projects** | `Project` | `(Team)-[:OWNS]->(Project)` | Company | Seeded | Yes | Shared context available to team members. |
| **Security/Compliance** | `Policy` | `(Organization)-[:ENFORCES]->(Policy)` | Company | Seeded | Yes (Critical) | Non-negotiable rules applied to all prompts. |
| **Brand Guidelines** | `Style` | `(Organization)-[:MANDATES_STYLE]->(Style)`| Company | Seeded | Yes | Replaces or merges with personal style. |
| **Approved Templates** | `Template` | `(Organization)-[:PROVIDES]->(Template)` | Company | Seeded | Yes | Approved output formats for AI generation. |

---

## STEP 5: Overlap & Ownership Boundaries

**Shared Concepts:**
- `Project`: A user can have Personal projects, and they can be assigned to Company projects.
- `Style`: A user has a Personal style, but the Company has a Brand style.

**Separate Concepts:**
- `Organization`, `Team`, `Policy`, `Template` are strictly Company concepts.
- `Task`, `Domain` are strictly Personal concepts.

**Ownership Boundaries:**
- **Personal Nodes**: Fully CRUD (Create, Read, Update, Delete) accessible by the Consumer. Admins have *zero* visibility into Personal nodes.
- **Company Nodes**: Read-only for the Consumer during retrieval. Exclusively managed by the Admin.

---

## STEP 6: Consumer → Enterprise Handoff

When a Consumer user is invited to an Enterprise team, the graph connects their personal subgraph to the enterprise subgraph.

**The Action:**
- The system creates a new relationship: `(User)-[:MEMBER_OF]->(Team)`.

**What remains personal:**
- All existing `WORKS_ON` personal projects, personal `Style` nodes, and `Domain` expertise remain strictly tied to the User. They are not visible to the company admin.

**What becomes governed:**
- By traversing `(User)-[:MEMBER_OF]->(Team)-[:BELONGS_TO]->(Organization)`, the User's retrieval engine now automatically inherits Company `Policy`, `Project`, and `Style` nodes.

**Precedence Engine (Conflict Resolution):**
If Personal and Company context collide during Context Assembly, precedence is strictly evaluated:
1. **Mandatory Company Policy** (Highest - Overrides everything)
2. **Company Brand Style** (Overrides Personal Style if in a company workspace context)
3. **Company Project Context** 
4. **Personal Style** 
5. **Personal Project Context** (Lowest)

---

## STEP 7: Form-to-Graph Implementation Matrix

This matrix provides the exact technical specification for an engineer to build the form-submission handlers.

### A. Consumer Onboarding Payload
*Endpoint: `POST /api/forms/consumer`*

| JSON Payload Field | Target Entity | Graph Action (Cypher Concept) |
| :--- | :--- | :--- |
| `name`, `email` | `User` | `MERGE (u:User {id: $userId}) SET u.name = $name` |
| `role` | `Role` | `MERGE (r:Role {name: $role}) MERGE (u)-[:HAS_ROLE]->(r)` |
| `domains[]` | `Domain` | `MERGE (d:Domain {name: $dom}) MERGE (u)-[:EXPERT_IN]->(d)` |
| `projects[]` | `Project` | `MERGE (p:Project {name: $proj, type: 'Personal'}) MERGE (u)-[:WORKS_ON]->(p)` |
| `writingStyle` | `Style` | `CREATE (s:Style {rules: $style, type: 'Personal'}) MERGE (u)-[:HAS_STYLE]->(s)` |

### B. Enterprise Admin Onboarding Payload
*Endpoint: `POST /api/forms/enterprise/setup`*

| JSON Payload Field | Target Entity | Graph Action (Cypher Concept) |
| :--- | :--- | :--- |
| `orgName` | `Organization` | `MERGE (o:Organization {id: $orgId}) SET o.name = $orgName` |
| `teams[]` | `Team` | `MERGE (t:Team {name: $teamName}) MERGE (t)-[:BELONGS_TO]->(o)` |
| `policies[]` | `Policy` | `CREATE (p:Policy {text: $pol, type: 'Mandatory'}) MERGE (o)-[:ENFORCES]->(p)` |
| `brandVoice` | `Style` | `CREATE (s:Style {rules: $voice, type: 'Corporate'}) MERGE (o)-[:MANDATES_STYLE]->(s)` |

### C. Enterprise User Join Payload
*Endpoint: `POST /api/enterprise/invite/accept`*

| JSON Payload Field | Target Entity | Graph Action (Cypher Concept) |
| :--- | :--- | :--- |
| `userId`, `teamId` | Edge Only | `MATCH (u:User), (t:Team) MERGE (u)-[:MEMBER_OF]->(t)` |
