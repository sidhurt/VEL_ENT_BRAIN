import { getSession } from './db';

export interface MemoryItem {
    id: string;
    type: string;
    content: string;
    edgeId: number;
    memoryState: string;
    usageCount: number;
    lastUsed: number;
}

export const fetchAllMemories = async (userId: string): Promise<MemoryItem[]> => {
    const session = getSession();
    try {
        const query = `
            MATCH (u:User {id: $userId})-[e:WORKS_ON]->(p:Project)
            RETURN id(e) as edgeId, p.id as id, 'Project' as type, p.name as content, e.memoryState as memoryState, coalesce(e.usageCount, 0) as usageCount, coalesce(e.lastUsed, 0) as lastUsed
            UNION
            MATCH (u:User {id: $userId})-[e:HAS_STYLE]->(s:Style)
            RETURN id(e) as edgeId, s.id as id, 'Style' as type, s.formattingRules as content, e.memoryState as memoryState, coalesce(e.usageCount, 0) as usageCount, coalesce(e.lastUsed, 0) as lastUsed
            UNION
            MATCH (u:User {id: $userId})-[:MEMBER_OF]->(t:Team)-[e:ENFORCES]->(p:Policy)
            RETURN id(e) as edgeId, p.id as id, 'Policy' as type, p.ruleText as content, e.memoryState as memoryState, coalesce(e.usageCount, 0) as usageCount, coalesce(e.lastUsed, 0) as lastUsed
            UNION
            MATCH (u:User {id: $userId})-[:MEMBER_OF]->(t:Team)-[:BELONGS_TO]->(o:Organization)-[e:ENFORCES]->(p:Policy)
            RETURN id(e) as edgeId, p.id as id, 'Policy' as type, p.ruleText as content, e.memoryState as memoryState, coalesce(e.usageCount, 0) as usageCount, coalesce(e.lastUsed, 0) as lastUsed
            UNION
            MATCH (u:User {id: $userId})-[e:HAS_ROLE]->(r:Role)
            RETURN id(e) as edgeId, r.id as id, 'Role' as type, r.name as content, 'Active' as memoryState, coalesce(e.usageCount, 0) as usageCount, coalesce(e.lastUsed, 0) as lastUsed
            UNION
            MATCH (u:User {id: $userId})-[e:EXPERT_IN]->(d:Domain)
            RETURN id(e) as edgeId, d.id as id, 'Domain' as type, d.name as content, 'Active' as memoryState, coalesce(e.usageCount, 0) as usageCount, coalesce(e.lastUsed, 0) as lastUsed
            UNION
            MATCH (u:User {id: $userId})-[e:PERFORMS]->(t:Task)
            RETURN id(e) as edgeId, t.id as id, 'Task' as type, t.name as content, e.memoryState as memoryState, coalesce(e.usageCount, 0) as usageCount, coalesce(e.lastUsed, 0) as lastUsed
            UNION
            MATCH (u:User {id: $userId})-[:MEMBER_OF]->(t:Team)-[:BELONGS_TO]->(o:Organization)-[e:OWNS]->(p:Project)
            RETURN id(e) as edgeId, p.id as id, 'Project' as type, p.name as content, 'Active' as memoryState, coalesce(e.usageCount, 0) as usageCount, coalesce(e.lastUsed, 0) as lastUsed
        `;
        const result = await session.run(query, { userId });
        
        return result.records.map(r => ({
            edgeId: r.get('edgeId').toNumber(),
            id: r.get('id'),
            type: r.get('type'),
            content: r.get('content'),
            memoryState: r.get('memoryState') || 'Active',
            usageCount: r.get('usageCount').toNumber ? r.get('usageCount').toNumber() : Number(r.get('usageCount')),
            lastUsed: r.get('lastUsed').toNumber ? r.get('lastUsed').toNumber() : Number(r.get('lastUsed'))
        }));
    } finally {
        await session.close();
    }
};

export const rankAndSelectContext = (memories: MemoryItem[], prompt: string) => {
    const promptLower = prompt.toLowerCase();
    
    // Deduplicate memories by ID before scoring to prevent edge collision issues
    const uniqueMemoriesMap = new Map<string, MemoryItem>();
    memories.forEach(mem => {
        // If it exists, we could merge edge counts, but for MVP just taking the first one is enough
        if (!uniqueMemoriesMap.has(mem.id)) {
            uniqueMemoriesMap.set(mem.id, mem);
        }
    });
    const deduplicatedMemories = Array.from(uniqueMemoriesMap.values());

    const scoredMemories = deduplicatedMemories.map(mem => {
        let intentScore = 0;
        let reasons: string[] = [];

        // Mandatory policies bypass ranking and are always forced in
        if (mem.type === 'Policy') {
            return {
                memory: mem,
                score: 10000,
                reasons: ['Mandatory Enterprise Policy'],
                confidence: 'High'
            };
        }

        // Basic intent matching
        const contentWords = mem.content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const matchCount = contentWords.filter(w => promptLower.includes(w)).length;
        
        if (matchCount > 0 || promptLower.includes(mem.type.toLowerCase())) {
            intentScore = matchCount * 15 + 20; // 20 base for any match
            reasons.push('Matched intent');
        }

        // Base state score
        let stateScore = 0;
        if (mem.memoryState === 'Active') {
            stateScore = 50;
            reasons.push('Active state');
        } else if (mem.memoryState === 'Recent') {
            stateScore = 20;
            reasons.push('Recent state');
        } else if (mem.memoryState === 'Archived') {
            stateScore = 0;
        }

        // Frequency score
        const frequencyScore = mem.usageCount * 2;
        if (mem.usageCount > 5) reasons.push('Frequently used');

        // Recency score (bonus if used in last 24h)
        const now = Date.now();
        const daysSince = (now - mem.lastUsed) / (1000 * 60 * 60 * 24);
        let recencyScore = 0;
        if (daysSince < 1 && mem.lastUsed > 0) {
            recencyScore = 15;
            reasons.push('Used recently');
        } else if (daysSince < 7 && mem.lastUsed > 0) {
            recencyScore = 5;
        }

        let totalScore = intentScore + stateScore + frequencyScore + recencyScore;

        // Constraint: Archived memory excluded unless strong intent match
        if (mem.memoryState === 'Archived' && intentScore === 0) {
            totalScore = -1000; 
        }

        if (reasons.length === 0) {
            reasons.push('Baseline context');
        }

        // Identity context (Role/Domain) should generally always be pulled if they are top-level
        if ((mem.type === 'Role' || mem.type === 'Domain') && totalScore >= 0) {
            totalScore += 100; // Base identity anchor
        }

        return {
            memory: mem,
            score: totalScore,
            reasons,
            confidence: totalScore > 100 ? 'High' : (totalScore > 50 ? 'Medium' : 'Low')
        };
    });

    // Filter out negatively scored and sort
    const validMemories = scoredMemories.filter(sm => sm.score >= 0).sort((a, b) => b.score - a.score);
    
    // Select top N (e.g., top 15 total to accommodate role/domain + projects + policies)
    const selected = validMemories.slice(0, 15);
    return selected;
};

export const updateMemoryStates = async (selectedEdgeIds: number[]) => {
    if (selectedEdgeIds.length === 0) return;
    const session = getSession();
    try {
        const query = `
            UNWIND $edgeIds AS eId
            MATCH ()-[e]->() WHERE id(e) = eId
            SET e.usageCount = coalesce(e.usageCount, 0) + 1, e.lastUsed = timestamp()
            // Reactivate Archived -> Active
            FOREACH (ignore IN CASE WHEN e.memoryState = 'Archived' OR e.memoryState = 'Recent' THEN [1] ELSE [] END | SET e.memoryState = 'Active')
        `;
        await session.run(query, { edgeIds: selectedEdgeIds });
    } finally {
        await session.close();
    }
};

export const decayMemories = async (userId: string, simulatedDays: number) => {
    const session = getSession();
    const msToSubtract = simulatedDays * 24 * 60 * 60 * 1000;
    try {
        const query = `
            MATCH (u:User {id: $userId})-[e]->()
            WHERE type(e) IN ['WORKS_ON', 'HAS_STYLE', 'MEMBER_OF']
            SET e.lastUsed = coalesce(e.lastUsed, timestamp()) - $ms
            WITH e
            SET e.memoryState = CASE 
                WHEN timestamp() - e.lastUsed > 2592000000 THEN 'Archived' // 30 days
                WHEN timestamp() - e.lastUsed > 604800000 THEN 'Recent'   // 7 days
                ELSE e.memoryState 
            END
        `;
        await session.run(query, { userId, ms: msToSubtract });

        const query2 = `
            MATCH (u:User {id: $userId})-[:MEMBER_OF]->(t)-[e:ENFORCES]->()
            SET e.lastUsed = coalesce(e.lastUsed, timestamp()) - $ms
            WITH e
            SET e.memoryState = CASE 
                WHEN timestamp() - e.lastUsed > 2592000000 THEN 'Archived'
                WHEN timestamp() - e.lastUsed > 604800000 THEN 'Recent'
                ELSE e.memoryState 
            END
        `;
        await session.run(query2, { userId, ms: msToSubtract });
        
        const query3 = `
            MATCH (u:User {id: $userId})-[:MEMBER_OF]->(t)-[:BELONGS_TO]->(o)-[e:ENFORCES]->()
            SET e.lastUsed = coalesce(e.lastUsed, timestamp()) - $ms
            WITH e
            SET e.memoryState = CASE 
                WHEN timestamp() - e.lastUsed > 2592000000 THEN 'Archived'
                WHEN timestamp() - e.lastUsed > 604800000 THEN 'Recent'
                ELSE e.memoryState 
            END
        `;
        await session.run(query3, { userId, ms: msToSubtract });
    } finally {
        await session.close();
    }
};

export const fetchMemoryCards = async (userId: string) => {
    const session = getSession();
    try {
        const query = `
            MATCH (u:User {id: $userId})
            OPTIONAL MATCH (u)-[sEdge:HAS_STYLE]->(s:Style)
            OPTIONAL MATCH (u)-[wEdge:WORKS_ON]->(p:Project)
            OPTIONAL MATCH (u)-[mEdge:MEMBER_OF]->(t:Team)
            OPTIONAL MATCH (t)-[tpEdge:ENFORCES]->(teamPol:Policy)
            OPTIONAL MATCH (t)-[:BELONGS_TO]->(o:Organization)-[opEdge:ENFORCES]->(orgPol:Policy)
            RETURN 
                { type: 'Role', data: { id: u.id, role: u.role, domain: u.domain } } as roleCard,
                collect(DISTINCT { type: 'Style', data: { id: s.id, formattingRules: s.formattingRules, memoryState: sEdge.memoryState } }) as styleCards,
                collect(DISTINCT { type: 'Project', data: { id: p.id, name: p.name, memoryState: wEdge.memoryState } }) as projectCards,
                collect(DISTINCT { type: 'Team', data: { id: t.id, name: t.name, memoryState: mEdge.memoryState } }) as teamCards,
                collect(DISTINCT { type: 'Policy', data: { id: teamPol.id, ruleText: teamPol.ruleText, memoryState: tpEdge.memoryState } }) +
                collect(DISTINCT { type: 'Policy', data: { id: orgPol.id, ruleText: orgPol.ruleText, memoryState: opEdge.memoryState } }) as policyCards
        `;
        const result = await session.run(query, { userId });
        
        if (result.records.length === 0) {
            return { role: null, projects: [], styles: [], policies: [], teams: [] };
        }

        const record = result.records[0];
        return {
            role: record.get('roleCard'),
            projects: record.get('projectCards').filter((c: any) => c.data.id !== null),
            styles: record.get('styleCards').filter((c: any) => c.data.id !== null),
            teams: record.get('teamCards').filter((c: any) => c.data.id !== null),
            policies: record.get('policyCards').filter((c: any) => c.data.id !== null),
        };
    } finally {
        await session.close();
    }
};

export const updateProjectStatus = async (userId: string, projectId: string, newStatus: string) => {
    // Kept for backward compatibility if needed, but not primarily used in the new auto-evolution model.
    const session = getSession();
    try {
        const query = `
            MATCH (u:User {id: $userId})-[w:WORKS_ON]->(p:Project {id: $projectId})
            SET w.memoryState = $newStatus
        `;
        await session.run(query, { userId, projectId, newStatus });
    } finally {
        await session.close();
    }
}

export const fetchGraphData = async (userId: string) => {
    const session = getSession();
    try {
        const query = `
            MATCH path=(u:User {id: $userId})-[*0..3]-(n)
            WHERE 'User' IN labels(n) OR 'Project' IN labels(n) OR 'Style' IN labels(n) OR 'Team' IN labels(n) OR 'Organization' IN labels(n) OR 'Policy' IN labels(n) OR 'Role' IN labels(n) OR 'Domain' IN labels(n) OR 'Task' IN labels(n)
            RETURN path
        `;
        const result = await session.run(query, { userId });
        
        const nodes = new Map();
        const edges = new Map();

        result.records.forEach(record => {
            const path: any = record.get('path');
            path.segments.forEach((segment: any) => {
                const start = segment.start;
                const end = segment.end;
                const rel = segment.relationship;

                nodes.set(start.identity.toNumber(), { id: start.properties.id || start.identity.toString(), label: start.labels[0], properties: start.properties });
                nodes.set(end.identity.toNumber(), { id: end.properties.id || end.identity.toString(), label: end.labels[0], properties: end.properties });
                
                const edgeId = rel.identity.toNumber();
                edges.set(edgeId, {
                    id: edgeId.toString(),
                    source: start.properties.id || start.identity.toString(),
                    target: end.properties.id || end.identity.toString(),
                    type: rel.type,
                    properties: rel.properties
                });
            });
            if (path.segments.length === 0) {
                 const node = path.start;
                 nodes.set(node.identity.toNumber(), { id: node.properties.id || node.identity.toString(), label: node.labels[0], properties: node.properties });
            }
        });

        return {
            nodes: Array.from(nodes.values()),
            edges: Array.from(edges.values())
        };
    } finally {
        await session.close();
    }
}

export const fetchEvolutionMetrics = async (userId: string) => {
    const session = getSession();
    try {
        // 1. Health (State counts)
        const stateQuery = `
            MATCH (u:User {id: $userId})-[e]->()
            WHERE type(e) IN ['WORKS_ON', 'HAS_STYLE', 'PERFORMS']
            RETURN e.memoryState as state, count(e) as count
            UNION
            MATCH (u:User {id: $userId})-[:MEMBER_OF]->(t)-[e:ENFORCES]->()
            RETURN e.memoryState as state, count(e) as count
            UNION
            MATCH (u:User {id: $userId})-[:MEMBER_OF]->(t)-[:BELONGS_TO]->(o)-[e:ENFORCES]->()
            RETURN e.memoryState as state, count(e) as count
        `;
        const stateResult = await session.run(stateQuery, { userId });
        
        let health = { Active: 0, Recent: 0, Archived: 0 };
        stateResult.records.forEach(r => {
            const state = r.get('state');
            const count = r.get('count').toNumber ? r.get('count').toNumber() : Number(r.get('count'));
            if (state === 'Active') health.Active += count;
            else if (state === 'Recent') health.Recent += count;
            else if (state === 'Archived') health.Archived += count;
        });

        // 2. Top Usages (Relevance Trends)
        const usageQuery = `
            MATCH (u:User {id: $userId})-[e]->(n)
            WHERE type(e) IN ['WORKS_ON', 'PERFORMS', 'HAS_STYLE'] AND e.usageCount > 0
            RETURN labels(n)[0] as type, coalesce(n.name, n.formattingRules) as name, e.usageCount as usageCount, e.memoryState as state
            ORDER BY e.usageCount DESC
            LIMIT 10
        `;
        const usageResult = await session.run(usageQuery, { userId });
        const topUsages = usageResult.records.map(r => ({
            type: r.get('type'),
            name: r.get('name'),
            usageCount: r.get('usageCount').toNumber ? r.get('usageCount').toNumber() : Number(r.get('usageCount')),
            state: r.get('state')
        }));

        // 3. Enterprise Inheritance
        const entQuery = `
            MATCH (u:User {id: $userId})-[:MEMBER_OF]->(t)-[:BELONGS_TO]->(o)
            OPTIONAL MATCH (o)-[e:ENFORCES]->(p:Policy)
            RETURN coalesce(o.name, 'Unknown') as orgName, collect(p.ruleText) as policies
        `;
        const entResult = await session.run(entQuery, { userId });
        let inheritance = { orgName: '', policies: [] as string[] };
        if (entResult.records.length > 0) {
            inheritance.orgName = entResult.records[0].get('orgName');
            inheritance.policies = entResult.records[0].get('policies').filter((p:any) => p !== null);
        }

        // 4. Graph Metrics
        const sizeQuery = `
            MATCH path=(u:User {id: $userId})-[*1..2]-(n)
            RETURN count(DISTINCT n) as nodes, count(DISTINCT relationships(path)[0]) as edges
        `;
        const sizeResult = await session.run(sizeQuery, { userId });
        const metrics = {
            nodes: sizeResult.records.length > 0 ? (sizeResult.records[0].get('nodes').toNumber ? sizeResult.records[0].get('nodes').toNumber() : Number(sizeResult.records[0].get('nodes'))) : 0,
            edges: sizeResult.records.length > 0 ? (sizeResult.records[0].get('edges').toNumber ? sizeResult.records[0].get('edges').toNumber() : Number(sizeResult.records[0].get('edges'))) : 0
        };

        return { health, topUsages, inheritance, metrics };
    } finally {
        await session.close();
    }
}

export const seedDemoPersonas = async () => {
    const session = getSession();
    try {
        const clearQuery = `
            // Clear existing demo nodes
            MATCH (n) WHERE n.id IN ['org-velocity-media', 'team-velocity-hq', 'pol-prof', 'pol-nospec', 'pol-conf', 'user-emma', 'user-siddharth', 'user-michael', 'role-emma', 'role-siddharth', 'role-michael', 'proj-emma', 'proj-siddharth', 'proj-michael', 'style-emma', 'domain-siddharth-aws', 'domain-siddharth-sap', 'domain-michael']
            DETACH DELETE n
        `;
        await session.run(clearQuery);

        const seedQuery = `
            // Create Enterprise
            CREATE (org:Organization {id: 'org-velocity-media', name: 'Velocity Media'})
            CREATE (team:Team {id: 'team-velocity-hq', name: 'Velocity HQ'})
            CREATE (team)-[:BELONGS_TO]->(org)

            // Create Enterprise Policies
            CREATE (pol1:Policy {id: 'pol-prof', ruleText: 'Professional Communication Only'})
            CREATE (pol2:Policy {id: 'pol-nospec', ruleText: 'No Speculation Presented As Fact'})
            CREATE (pol3:Policy {id: 'pol-conf', ruleText: 'Client Confidentiality'})
            CREATE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 0}]->(pol1)
            CREATE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 0}]->(pol2)
            CREATE (org)-[:ENFORCES {memoryState: 'Active', usageCount: 0}]->(pol3)

            // Emma
            CREATE (u1:User {id: 'user-emma', role: 'Senior Content Strategy Manager', name: 'Emma Johnson'})
            CREATE (u1)-[:MEMBER_OF {memoryState: 'Active', usageCount: 0}]->(team)
            CREATE (r1:Role {id: 'role-emma', name: 'Senior Content Strategy Manager'})
            CREATE (u1)-[:HAS_ROLE {memoryState: 'Active', usageCount: 0}]->(r1)
            CREATE (p1:Project {id: 'proj-emma', name: 'Enterprise AI Adoption Program'})
            CREATE (u1)-[:WORKS_ON {memoryState: 'Active', usageCount: 0}]->(p1)
            CREATE (s1:Style {id: 'style-emma', formattingRules: 'Casual Communication, Use Bullet Points'})
            CREATE (u1)-[:HAS_STYLE {memoryState: 'Active', usageCount: 0}]->(s1)
            CREATE (d1a:Domain {id: 'domain-emma-gov', name: 'Content Governance'})
            CREATE (u1)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d1a)
            CREATE (d1b:Domain {id: 'domain-emma-marketing', name: 'Digital Marketing'})
            CREATE (u1)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d1b)
            CREATE (t1:Task {id: 'task-emma-review', name: 'Content Review'})
            CREATE (u1)-[:PERFORMS {memoryState: 'Active', usageCount: 0}]->(t1)

            // Siddharth
            CREATE (u2:User {id: 'user-siddharth', role: 'Enterprise Architect', name: 'Siddharth S.'})
            CREATE (u2)-[:MEMBER_OF {memoryState: 'Active', usageCount: 0}]->(team)
            CREATE (r2:Role {id: 'role-siddharth', name: 'Enterprise Architect'})
            CREATE (u2)-[:HAS_ROLE {memoryState: 'Active', usageCount: 0}]->(r2)
            CREATE (p2a:Project {id: 'proj-siddharth-ub', name: 'Unified Brain Architecture'})
            CREATE (u2)-[:WORKS_ON {memoryState: 'Active', usageCount: 0}]->(p2a)
            CREATE (p2b:Project {id: 'proj-siddharth-dms', name: 'DMS Integration'})
            CREATE (u2)-[:WORKS_ON {memoryState: 'Active', usageCount: 0}]->(p2b)
            CREATE (d2a:Domain {id: 'domain-siddharth-aws', name: 'AWS'})
            CREATE (u2)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d2a)
            CREATE (d2b:Domain {id: 'domain-siddharth-sap', name: 'SAP Integration'})
            CREATE (u2)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d2b)
            CREATE (t2:Task {id: 'task-siddharth-arch', name: 'Architecture Review'})
            CREATE (u2)-[:PERFORMS {memoryState: 'Active', usageCount: 0}]->(t2)
            CREATE (s2:Style {id: 'style-siddharth', formattingRules: 'Direct, structured, technical depth'})
            CREATE (u2)-[:HAS_STYLE {memoryState: 'Active', usageCount: 0}]->(s2)

            // Michael
            CREATE (u3:User {id: 'user-michael', role: 'Client Success Director', name: 'Michael T.'})
            CREATE (u3)-[:MEMBER_OF {memoryState: 'Active', usageCount: 0}]->(team)
            CREATE (r3:Role {id: 'role-michael', name: 'Client Success Director'})
            CREATE (u3)-[:HAS_ROLE {memoryState: 'Active', usageCount: 0}]->(r3)
            CREATE (p3:Project {id: 'proj-michael', name: 'Revenue Intelligence Platform'})
            CREATE (u3)-[:WORKS_ON {memoryState: 'Active', usageCount: 0}]->(p3)
            CREATE (d3a:Domain {id: 'domain-michael-research', name: 'Customer Research'})
            CREATE (u3)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d3a)
            CREATE (d3b:Domain {id: 'domain-michael-sales', name: 'Enterprise Sales'})
            CREATE (u3)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d3b)
            CREATE (t3:Task {id: 'task-michael-qbr', name: 'QBR Preparation'})
            CREATE (u3)-[:PERFORMS {memoryState: 'Active', usageCount: 0}]->(t3)
            CREATE (s3:Style {id: 'style-michael', formattingRules: 'Professional, empathetic, focus on ROI'})
            CREATE (u3)-[:HAS_STYLE {memoryState: 'Active', usageCount: 0}]->(s3)
        `;
        await session.run(seedQuery);
    } finally {
        await session.close();
    }
}

