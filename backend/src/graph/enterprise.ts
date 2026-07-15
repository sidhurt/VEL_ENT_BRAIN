import { getSession } from '../db';

export const seedDemoPersonas = async () => {
    const session = getSession();
    try {
        const clearQuery = `
            // Clear existing demo nodes
            MATCH (n) WHERE n.id IN [
                'org-velocity-media', 'team-velocity-hq', 'pol-prof', 'pol-nospec', 'pol-conf',
                'user-emma', 'user-siddharth', 'user-michael',
                'role-emma', 'role-siddharth', 'role-michael',
                'proj-emma', 'proj-siddharth', 'proj-siddharth-ub', 'proj-siddharth-dms', 'proj-michael',
                'style-emma', 'style-siddharth', 'style-michael',
                'domain-emma-gov', 'domain-emma-marketing', 'task-emma-review',
                'domain-siddharth-aws', 'domain-siddharth-sap', 'task-siddharth-arch',
                'domain-michael', 'domain-michael-research', 'domain-michael-sales', 'task-michael-qbr'
            ]
            DETACH DELETE n
        `;
        await session.run(clearQuery);

        const seedQuery = `
            // Create Enterprise
            MERGE (org:Organization {id: 'org-velocity-media'}) SET org.name = 'Velocity Media'
            MERGE (team:Team {id: 'team-velocity-hq'}) SET team.name = 'Velocity HQ'
            MERGE (team)-[:BELONGS_TO]->(org)

            // Create Enterprise Policies
            MERGE (pol1:Policy {id: 'pol-prof'}) SET pol1.ruleText = 'Professional Communication Only'
            MERGE (pol2:Policy {id: 'pol-nospec'}) SET pol2.ruleText = 'No Speculation Presented As Fact'
            MERGE (pol3:Policy {id: 'pol-conf'}) SET pol3.ruleText = 'Client Confidentiality'
            MERGE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 0}]->(pol1)
            MERGE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 0}]->(pol2)
            MERGE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 0}]->(pol3)

            // Emma
            MERGE (u1:User {id: 'user-emma'}) SET u1.role = 'Senior Content Strategy Manager', u1.name = 'Emma Johnson'
            MERGE (u1)-[:MEMBER_OF {memoryState: 'Active', usageCount: 0}]->(team)
            MERGE (r1:Role {id: 'role-emma'}) SET r1.name = 'Senior Content Strategy Manager'
            MERGE (u1)-[:HAS_ROLE {memoryState: 'Active', usageCount: 0}]->(r1)
            MERGE (p1:Project {id: 'proj-emma'}) SET p1.name = 'Enterprise AI Adoption Program'
            MERGE (u1)-[:WORKS_ON {memoryState: 'Active', usageCount: 0}]->(p1)
            MERGE (s1:Style {id: 'style-emma'}) SET s1.formattingRules = 'Casual Communication, Use Bullet Points'
            MERGE (u1)-[:HAS_STYLE {memoryState: 'Active', usageCount: 0}]->(s1)
            MERGE (d1a:Domain {id: 'domain-emma-gov'}) SET d1a.name = 'Content Governance'
            MERGE (u1)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d1a)
            MERGE (d1b:Domain {id: 'domain-emma-marketing'}) SET d1b.name = 'Digital Marketing'
            MERGE (u1)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d1b)
            MERGE (t1:Task {id: 'task-emma-review'}) SET t1.name = 'Content Review'
            MERGE (u1)-[:PERFORMS {memoryState: 'Active', usageCount: 0}]->(t1)

            // Siddharth
            MERGE (u2:User {id: 'user-siddharth'}) SET u2.role = 'Enterprise Architect', u2.name = 'Siddharth S.'
            MERGE (u2)-[:MEMBER_OF {memoryState: 'Active', usageCount: 0}]->(team)
            MERGE (r2:Role {id: 'role-siddharth'}) SET r2.name = 'Enterprise Architect'
            MERGE (u2)-[:HAS_ROLE {memoryState: 'Active', usageCount: 0}]->(r2)
            MERGE (p2a:Project {id: 'proj-siddharth-ub'}) SET p2a.name = 'Unified Brain Architecture'
            MERGE (u2)-[:WORKS_ON {memoryState: 'Active', usageCount: 0}]->(p2a)
            MERGE (p2b:Project {id: 'proj-siddharth-dms'}) SET p2b.name = 'DMS Integration'
            MERGE (u2)-[:WORKS_ON {memoryState: 'Active', usageCount: 0}]->(p2b)
            MERGE (d2a:Domain {id: 'domain-siddharth-aws'}) SET d2a.name = 'AWS'
            MERGE (u2)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d2a)
            MERGE (d2b:Domain {id: 'domain-siddharth-sap'}) SET d2b.name = 'SAP Integration'
            MERGE (u2)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d2b)
            MERGE (t2:Task {id: 'task-siddharth-arch'}) SET t2.name = 'Architecture Review'
            MERGE (u2)-[:PERFORMS {memoryState: 'Active', usageCount: 0}]->(t2)
            MERGE (s2:Style {id: 'style-siddharth'}) SET s2.formattingRules = 'Direct, structured, technical depth'
            MERGE (u2)-[:HAS_STYLE {memoryState: 'Active', usageCount: 0}]->(s2)

            // Michael
            MERGE (u3:User {id: 'user-michael'}) SET u3.role = 'Client Success Director', u3.name = 'Michael T.'
            MERGE (u3)-[:MEMBER_OF {memoryState: 'Active', usageCount: 0}]->(team)
            MERGE (r3:Role {id: 'role-michael'}) SET r3.name = 'Client Success Director'
            MERGE (u3)-[:HAS_ROLE {memoryState: 'Active', usageCount: 0}]->(r3)
            MERGE (p3:Project {id: 'proj-michael'}) SET p3.name = 'Revenue Intelligence Platform'
            MERGE (u3)-[:WORKS_ON {memoryState: 'Active', usageCount: 0}]->(p3)
            MERGE (d3a:Domain {id: 'domain-michael-research'}) SET d3a.name = 'Customer Research'
            MERGE (u3)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d3a)
            MERGE (d3b:Domain {id: 'domain-michael-sales'}) SET d3b.name = 'Enterprise Sales'
            MERGE (u3)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d3b)
            MERGE (t3:Task {id: 'task-michael-qbr'}) SET t3.name = 'QBR Preparation'
            MERGE (u3)-[:PERFORMS {memoryState: 'Active', usageCount: 0}]->(t3)
            MERGE (s3:Style {id: 'style-michael'}) SET s3.formattingRules = 'Professional, empathetic, focus on ROI'
            MERGE (u3)-[:HAS_STYLE {memoryState: 'Active', usageCount: 0}]->(s3)
        `;
        await session.run(seedQuery);
    } finally {
        await session.close();
    }
}

export const fetchUsers = async () => {
    const session = getSession();
    try {
        const query = `
            MATCH (u:User)
            OPTIONAL MATCH (u)-[:HAS_ROLE]->(r:Role)
            OPTIONAL MATCH (u)-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(o:Organization)
            OPTIONAL MATCH (u)-[:WORKS_ON]->(p:Project)
            OPTIONAL MATCH (u)-[:AUTHORED]->(a:Artifact)
            RETURN u.id as id, u.name as name, coalesce(r.name, 'No Role') as role, coalesce(o.name, 'No Organization') as organization, count(DISTINCT p) as projectsCount, count(DISTINCT a) as artifactsCount
        `;
        const result = await session.run(query);
        return result.records.map(r => ({
            id: r.get('id'),
            name: r.get('name'),
            role: r.get('role'),
            organization: r.get('organization'),
            projectsCount: r.get('projectsCount').toNumber ? r.get('projectsCount').toNumber() : Number(r.get('projectsCount')),
            artifactsCount: r.get('artifactsCount').toNumber ? r.get('artifactsCount').toNumber() : Number(r.get('artifactsCount'))
        }));
    } finally {
        await session.close();
    }
};

export const fetchEnterprises = async () => {
    const session = getSession();
    try {
        const query = `
            MATCH (o:Organization)
            OPTIONAL MATCH (u:User)-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(o)
            OPTIONAL MATCH (o)-[:OWNS]->(p:Project)
            OPTIONAL MATCH (o)-[:ENFORCES]->(pol:Policy)
            OPTIONAL MATCH (u)-[:AUTHORED]->(a:Artifact)
            RETURN o.id as id, o.name as name, count(DISTINCT u) as membersCount, count(DISTINCT p) as projectsCount, count(DISTINCT pol) as policiesCount, count(DISTINCT a) as artifactsCount
        `;
        const result = await session.run(query);
        return result.records.map(r => ({
            id: r.get('id'),
            name: r.get('name'),
            membersCount: r.get('membersCount').toNumber ? r.get('membersCount').toNumber() : Number(r.get('membersCount')),
            projectsCount: r.get('projectsCount').toNumber ? r.get('projectsCount').toNumber() : Number(r.get('projectsCount')),
            policiesCount: r.get('policiesCount').toNumber ? r.get('policiesCount').toNumber() : Number(r.get('policiesCount')),
            artifactsCount: r.get('artifactsCount').toNumber ? r.get('artifactsCount').toNumber() : Number(r.get('artifactsCount'))
        }));
    } finally {
        await session.close();
    }
};

export const fetchEnterpriseDetails = async (orgId: string) => {
    const session = getSession();
    try {
        const query = `
            MATCH (o:Organization {id: $orgId})
            OPTIONAL MATCH (o)-[:ENFORCES]->(p:Policy)
            OPTIONAL MATCH (o)-[:OWNS]->(proj:Project)
            OPTIONAL MATCH (u:User)-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(o)
            RETURN o, collect(DISTINCT p) as policies, collect(DISTINCT proj) as projects, collect(DISTINCT u) as members
        `;
        const result = await session.run(query, { orgId });
        if (result.records.length === 0) throw new Error("Org not found");
        const r = result.records[0];

        return {
            organization: r.get('o').properties,
            policies: r.get('policies').map((x:any) => x.properties),
            projects: r.get('projects').map((x:any) => x.properties),
            members: r.get('members').map((x:any) => x.properties)
        };
    } finally {
        await session.close();
    }
};

export const attachUserToEnterprise = async (userId: string, orgId: string) => {
    const session = getSession();
    try {
        const query = `
            MATCH (o:Organization {id: $orgId})
            MATCH (t:Team {id: 'team-default-' + $orgId})
            MATCH (u:User {id: $userId})
            MERGE (u)-[:MEMBER_OF {memoryState: 'Active', usageCount: 0, lastUsed: timestamp()}]->(t)
        `;
        await session.run(query, { userId, orgId });
    } finally {
        await session.close();
    }
};
