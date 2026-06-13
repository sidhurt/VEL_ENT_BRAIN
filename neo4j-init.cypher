// Database Initialization Script for ThinkVelocity Unified Brain

// 1. Wipe Existing Data to ensure clean runs
MATCH (n) DETACH DELETE n;

// 2. Constraints
CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (t:Team) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (pol:Policy) REQUIRE pol.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (s:Style) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (r:Role) REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (d:Domain) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (tsk:Task) REQUIRE tsk.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (tmpl:Template) REQUIRE tmpl.id IS UNIQUE;

// =========================================================================
// ENTERPRISE SEEDING: VELOCITY MEDIA
// =========================================================================

MERGE (org:Organization {id: 'org-velocity-media'})
  ON CREATE SET org.name = 'Velocity Media', org.type = 'Media Network';

MERGE (team:Team {id: 'team-strategy'})
  ON CREATE SET team.name = 'Strategy / Enterprise Systems';

MATCH (team:Team {id: 'team-strategy'}), (org:Organization {id: 'org-velocity-media'})
MERGE (team)-[:BELONGS_TO]->(org);

// Policy Nodes (Active Versions)
MERGE (pol1:Policy {id: 'pol-no-speculation'})
  ON CREATE SET pol1.ruleText = 'No speculation presented as fact.',
                pol1.classification = 'Mandatory',
                pol1.name = 'No Speculation Rule',
                pol1.status = 'Active';

MERGE (pol2:Policy {id: 'pol-cite-evidence'})
  ON CREATE SET pol2.ruleText = 'Cite supporting evidence when available.',
                pol2.classification = 'Mandatory',
                pol2.name = 'Cite Evidence Rule',
                pol2.status = 'Active';

MERGE (pol3:Policy {id: 'pol-separate-assumptions'})
  ON CREATE SET pol3.ruleText = 'Separate assumptions from verified conclusions.',
                pol3.classification = 'Mandatory',
                pol3.name = 'Verified Conclusions Rule',
                pol3.status = 'Active';

MERGE (pol4:Policy {id: 'pol-pro-tone'})
  ON CREATE SET pol4.ruleText = 'Professional communication standards.',
                pol4.classification = 'Mandatory',
                pol4.name = 'Professional Tone Rule',
                pol4.status = 'Active';

MATCH (org:Organization {id: 'org-velocity-media'})
MATCH (pol1:Policy {id: 'pol-no-speculation'}), (pol2:Policy {id: 'pol-cite-evidence'}), (pol3:Policy {id: 'pol-separate-assumptions'}), (pol4:Policy {id: 'pol-pro-tone'})
MERGE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 0, lastUsed: timestamp()}]->(pol1)
MERGE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 0, lastUsed: timestamp()}]->(pol2)
MERGE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 0, lastUsed: timestamp()}]->(pol3)
MERGE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 0, lastUsed: timestamp()}]->(pol4);

// Guidelines (Team Level)
MERGE (g1:Policy {id: 'guide-structured'})
  ON CREATE SET g1.ruleText = 'Structured outputs preferred. Recommendations must include reasoning. Enterprise context overrides personal style preferences.',
                g1.classification = 'Guideline',
                g1.name = 'Communication Guidelines',
                g1.status = 'Active';

MATCH (team:Team {id: 'team-strategy'}), (g1:Policy {id: 'guide-structured'})
MERGE (team)-[:ENFORCES {memoryState: 'Active', usageCount: 0, lastUsed: timestamp()}]->(g1);


// =========================================================================
// CONSUMER SEEDING: SIDDHARTH SHRIVASTAVA
// =========================================================================

MERGE (user:User {id: 'siddharth-shrivastava'})
  ON CREATE SET user.name = 'Siddharth Shrivastava';

// 1. Role
MERGE (role:Role {id: 'role-sap-arch'})
  ON CREATE SET role.name = 'SAP & Cloud Enterprise Architect';

MATCH (user:User {id: 'siddharth-shrivastava'}), (role:Role {id: 'role-sap-arch'})
MERGE (user)-[:HAS_ROLE]->(role);

// 2. Domains
FOREACH (dName IN ['SAP ABAP', 'SAP BTP', 'Enterprise Architecture', 'Backend Engineering', 'Knowledge Graphs', 'AI Systems', 'Document Management Systems', 'Enterprise Integration', 'Marketing Strategy', 'Business Analysis', 'Finance Fundamentals'] |
    MERGE (d:Domain {id: 'domain-' + replace(toLower(dName), ' ', '-')})
    ON CREATE SET d.name = dName
    MERGE (user)-[:EXPERT_IN]->(d)
);

// 3. Projects
MERGE (proj1:Project {id: 'proj-unified-brain'})
  ON CREATE SET proj1.name = 'ThinkVelocity Unified Brain Architecture', proj1.type = 'Enterprise';
MERGE (proj2:Project {id: 'proj-sap-dms'})
  ON CREATE SET proj2.name = 'SAP DMS / Content Server Enterprise Integration', proj2.type = 'Enterprise';
MERGE (proj3:Project {id: 'proj-enterprise-docs'})
  ON CREATE SET proj3.name = 'Enterprise Document Management Platform Design', proj3.type = 'Enterprise';
MERGE (proj4:Project {id: 'proj-velocity-os'})
  ON CREATE SET proj4.name = 'Velocity Context Operating System Research', proj4.type = 'Personal';

MATCH (user:User {id: 'siddharth-shrivastava'})
MATCH (proj1:Project {id: 'proj-unified-brain'}), (proj2:Project {id: 'proj-sap-dms'}), (proj3:Project {id: 'proj-enterprise-docs'}), (proj4:Project {id: 'proj-velocity-os'})
MERGE (user)-[:WORKS_ON {memoryState: 'Active', usageCount: 50, lastUsed: timestamp()}]->(proj1)
MERGE (user)-[:WORKS_ON {memoryState: 'Active', usageCount: 30, lastUsed: timestamp()}]->(proj2)
MERGE (user)-[:WORKS_ON {memoryState: 'Active', usageCount: 20, lastUsed: timestamp()}]->(proj3)
MERGE (user)-[:WORKS_ON {memoryState: 'Active', usageCount: 10, lastUsed: timestamp()}]->(proj4);

// 4. Tasks
FOREACH (tName IN ['Enterprise Solution Architecture Reviews', 'System Boundary & Responsibility Analysis', 'Requirements Decomposition & Assignment Mapping'] |
    MERGE (t:Task {id: 'task-' + replace(toLower(tName), ' ', '-')})
    ON CREATE SET t.name = tName
    MERGE (user)-[:PERFORMS {memoryState: 'Active', usageCount: 5, lastUsed: timestamp()}]->(t)
);

// 5. Personal Style
MERGE (style1:Style {id: 'style-siddharth'})
  ON CREATE SET style1.formattingRules = 'Direct, Technical, Structured, Analytical. Use bullet points where possible. Separate strategic and implementation concerns. Minimize fluff. Prioritize clarity over verbosity. Explicitly identify assumptions and tradeoffs. No emojis.';

MATCH (user:User {id: 'siddharth-shrivastava'}), (style1:Style {id: 'style-siddharth'})
MERGE (user)-[:HAS_STYLE {memoryState: 'Active', usageCount: 10, lastUsed: timestamp()}]->(style1);

// 6. Enterprise Assignment
MATCH (user:User {id: 'siddharth-shrivastava'}), (team:Team {id: 'team-strategy'})
MERGE (user)-[:MEMBER_OF {memoryState: 'Active', usageCount: 100, lastUsed: timestamp()}]->(team);
