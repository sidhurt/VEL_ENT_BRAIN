// Database Initialization Script for ThinkVelocity Unified Brain

CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (t:Team) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (pol:Policy) REQUIRE pol.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (s:Style) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (tmpl:Template) REQUIRE tmpl.id IS UNIQUE;

// We must explicitly MATCH nodes when creating relationships across separate statements

MERGE (org:Organization {id: 'org-news-corp'})
  ON CREATE SET org.name = 'Global News Network', org.type = 'Media Network';

MERGE (team:Team {id: 'team-editorial'})
  ON CREATE SET team.name = 'Editorial Desk';

MATCH (team:Team {id: 'team-editorial'}), (org:Organization {id: 'org-news-corp'})
MERGE (team)-[:BELONGS_TO]->(org);

// Policy Nodes (Current / Active Versions)
MERGE (pol1:Policy {id: 'pol-no-speculation-v2'})
  ON CREATE SET pol1.ruleText = 'Do not include unverified speculation or unpublished financial projections in any content.',
                pol1.type = 'Mandatory',
                pol1.name = 'No Speculation Rule (v2)',
                pol1.status = 'Active';

MATCH (org:Organization {id: 'org-news-corp'}), (pol1:Policy {id: 'pol-no-speculation-v2'})
MERGE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 10, lastUsed: timestamp()}]->(pol1);

// Policy History & Rollback Schema Example (Archived v1)
MERGE (pol1v1:Policy {id: 'pol-no-speculation-v1'})
  ON CREATE SET pol1v1.ruleText = 'Do not include speculation.',
                pol1v1.type = 'Mandatory',
                pol1v1.name = 'No Speculation Rule (v1)',
                pol1v1.status = 'Archived';

MATCH (pol1:Policy {id: 'pol-no-speculation-v2'}), (pol1v1:Policy {id: 'pol-no-speculation-v1'})
MERGE (pol1)-[:REPLACES]->(pol1v1);


MERGE (pol2:Policy {id: 'pol-ap-style'})
  ON CREATE SET pol2.ruleText = 'Strictly adhere to AP Style guidelines for all reporting.',
                pol2.type = 'Guideline',
                pol2.name = 'AP Style Enforcement',
                pol2.status = 'Active';

MATCH (team:Team {id: 'team-editorial'}), (pol2:Policy {id: 'pol-ap-style'})
MERGE (team)-[:ENFORCES {memoryState: 'Active', usageCount: 15, lastUsed: timestamp()}]->(pol2);


// Approved Company Templates
MERGE (tmpl1:Template {id: 'tmpl-weekly-report'})
  ON CREATE SET tmpl1.name = 'Weekly Status Report',
                tmpl1.structure = '# Summary\n# Blockers\n# Next Steps',
                tmpl1.status = 'Active';

MATCH (org:Organization {id: 'org-news-corp'}), (tmpl1:Template {id: 'tmpl-weekly-report'})
MERGE (org)-[:PROVIDES {memoryState: 'Active', usageCount: 4, lastUsed: timestamp()}]->(tmpl1);


MERGE (user:User {id: 'user-jane-doe'})
  ON CREATE SET user.name = 'Jane Doe', user.role = 'Senior Technology Journalist', user.domain = 'Artificial Intelligence';

MATCH (user:User {id: 'user-jane-doe'}), (team:Team {id: 'team-editorial'})
MERGE (user)-[:MEMBER_OF {memoryState: 'Active', usageCount: 20, lastUsed: timestamp()}]->(team);

MERGE (proj1:Project {id: 'proj-ai-summit'})
  ON CREATE SET proj1.name = 'Global AI Summit Coverage', proj1.type = 'Enterprise';

MATCH (user:User {id: 'user-jane-doe'}), (proj1:Project {id: 'proj-ai-summit'})
MERGE (user)-[:WORKS_ON {memoryState: 'Active', usageCount: 5, lastUsed: timestamp()}]->(proj1);

MERGE (proj2:Project {id: 'proj-q1-earnings'})
  ON CREATE SET proj2.name = 'Q1 Tech Earnings Reports', proj2.type = 'Enterprise';

MATCH (user:User {id: 'user-jane-doe'}), (proj2:Project {id: 'proj-q1-earnings'})
// Simulated old timestamp: current time minus ~60 days (5184000000 ms)
MERGE (user)-[:WORKS_ON {memoryState: 'Archived', usageCount: 2, lastUsed: timestamp() - 5184000000}]->(proj2);

MERGE (style1:Style {id: 'style-jane-personal'})
  ON CREATE SET style1.name = 'Jane Personal Style', style1.formattingRules = 'Keep paragraphs short. Use clear, active voice.';

MATCH (user:User {id: 'user-jane-doe'}), (style1:Style {id: 'style-jane-personal'})
MERGE (user)-[:HAS_STYLE {memoryState: 'Active', usageCount: 8, lastUsed: timestamp()}]->(style1);

MERGE (consumer:User {id: 'user-john-smith'})
  ON CREATE SET consumer.name = 'John Smith', consumer.role = 'Freelance Tech Blogger', consumer.domain = 'Consumer Electronics';

MERGE (proj3:Project {id: 'proj-smartphones'})
  ON CREATE SET proj3.name = 'Smartphone Reviews 2026', proj3.type = 'Personal';

MATCH (consumer:User {id: 'user-john-smith'}), (proj3:Project {id: 'proj-smartphones'})
MERGE (consumer)-[:WORKS_ON {memoryState: 'Active', usageCount: 3, lastUsed: timestamp()}]->(proj3);

MERGE (style2:Style {id: 'style-john-personal'})
  ON CREATE SET style2.name = 'John Blog Style', style2.formattingRules = 'Use conversational tone and emoji where appropriate.';

MATCH (consumer:User {id: 'user-john-smith'}), (style2:Style {id: 'style-john-personal'})
MERGE (consumer)-[:HAS_STYLE {memoryState: 'Active', usageCount: 12, lastUsed: timestamp()}]->(style2);
