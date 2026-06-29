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
            UNION
            MATCH (u:User {id: $userId})-[e:AUTHORED]->(a:Artifact)
            RETURN id(e) as edgeId, a.id as id, 'Artifact' as type, coalesce(a.knowledgeSummary, a.type) as content, 'Active' as memoryState, coalesce(a.weight, 1) + coalesce(e.usageCount, 0) as usageCount, CASE WHEN coalesce(e.lastUsed, 0) > coalesce(a.timestamp, 0) THEN e.lastUsed ELSE a.timestamp END as lastUsed
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
    
    // Deduplicate memories by content/name before scoring to prevent Personal vs Enterprise collision
    const uniqueMemoriesMap = new Map<string, MemoryItem>();
    memories.forEach(mem => {
        let dedupeKey = mem.id;
        if (mem.type === 'Project' || mem.type === 'Task') {
            dedupeKey = `${mem.type}_${mem.content.toLowerCase().trim()}`;
        }
        
        if (!uniqueMemoriesMap.has(dedupeKey)) {
            uniqueMemoriesMap.set(dedupeKey, mem);
        } else {
            // Favor Enterprise projects if collision occurs (e.g. ID contains 'ent')
            const existing = uniqueMemoriesMap.get(dedupeKey)!;
            if (mem.id.includes('ent-') && !existing.id.includes('ent-')) {
                uniqueMemoriesMap.set(dedupeKey, mem);
            }
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

        let confidence = totalScore > 100 ? 'High' : (totalScore > 50 ? 'Medium' : 'Low');
        
        // Low Confidence Rejection: If this is a Project/Task and has no semantic intent, force confidence to Low
        if ((mem.type === 'Project' || mem.type === 'Task') && intentScore === 0) {
            confidence = 'Low';
        }

        return {
            memory: mem,
            score: totalScore,
            reasons,
            confidence
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
        const query = `MATCH (u:User) RETURN u.id as id, u.name as name`;
        const result = await session.run(query);
        return result.records.map(r => ({ id: r.get('id'), name: r.get('name') }));
    } finally {
        await session.close();
    }
};

export const fetchEnterprises = async () => {
    const session = getSession();
    try {
        const query = `MATCH (o:Organization) RETURN o.id as id, o.name as name`;
        const result = await session.run(query);
        return result.records.map(r => ({ id: r.get('id'), name: r.get('name') }));
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

// Candidate Memory Layer Implementation

export const upsertCandidateEntity = async (userId: string, entityType: string, entityName: string, confidence: number = 80) => {
    const session = getSession();
    try {
        const slug = entityName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const candId = `cand-${userId}-${entityType.toLowerCase()}-${slug}`;
        const query = `
            MATCH (u:User {id: $userId})
            MERGE (c:Candidate {id: $candId}) 
            ON CREATE SET 
                c.type = $entityType, 
                c.name = $entityName, 
                c.confidence = $confidence, 
                c.reinforcementCount = 1, 
                c.firstSeen = timestamp(), 
                c.lastSeen = timestamp()
            ON MATCH SET 
                c.reinforcementCount = c.reinforcementCount + 1, 
                c.lastSeen = timestamp()
            MERGE (u)-[:HAS_CANDIDATE]->(c)
        `;
        await session.run(query, { userId, candId, entityType, entityName, confidence });
    } finally {
        await session.close();
    }
};

export const fetchCandidates = async (userId: string) => {
    const session = getSession();
    try {
        const query = `
            MATCH (u:User {id: $userId})-[:HAS_CANDIDATE]->(c:Candidate)
            RETURN c.id as id, c.type as type, c.name as name, c.confidence as confidence, c.reinforcementCount as reinforcementCount
            ORDER BY c.lastSeen DESC
        `;
        const result = await session.run(query, { userId });
        return result.records.map(r => ({
            id: r.get('id'),
            type: r.get('type'),
            name: r.get('name'),
            confidence: r.get('confidence').toNumber ? r.get('confidence').toNumber() : Number(r.get('confidence')),
            reinforcementCount: r.get('reinforcementCount').toNumber ? r.get('reinforcementCount').toNumber() : Number(r.get('reinforcementCount'))
        }));
    } finally {
        await session.close();
    }
};

export const promoteCandidateToMemory = async (userId: string, candidateId: string) => {
    const session = getSession();
    try {
        // Read candidate
        const readQuery = `MATCH (u:User {id: $userId})-[:HAS_CANDIDATE]->(c:Candidate {id: $candidateId}) RETURN c.type as type, c.name as name`;
        const readRes = await session.run(readQuery, { userId, candidateId });
        if (readRes.records.length === 0) throw new Error("Candidate not found");
        
        const type = readRes.records[0].get('type');
        const name = readRes.records[0].get('name');
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        let promoteQuery = '';
        if (type === 'Project') {
            const projId = `proj-${userId}-${slug}`;
            promoteQuery = `
                MATCH (u:User {id: $userId})
                MERGE (p:Project {id: $projId}) ON CREATE SET p.name = $name, p.type = 'Personal'
                MERGE (u)-[r:WORKS_ON]->(p)
                ON CREATE SET r.memoryState = 'Recent', r.usageCount = 3, r.lastUsed = timestamp()
            `;
            await session.run(promoteQuery, { userId, projId, name });
        } else if (type === 'Task') {
            const taskId = `task-${userId}-${slug}`;
            promoteQuery = `
                MATCH (u:User {id: $userId})
                MERGE (t:Task {id: $taskId}) ON CREATE SET t.name = $name
                MERGE (u)-[r:PERFORMS]->(t)
                ON CREATE SET r.memoryState = 'Recent', r.usageCount = 3, r.lastUsed = timestamp()
            `;
            await session.run(promoteQuery, { userId, taskId, name });
        } else if (type === 'Domain') {
            const domId = `domain-${userId}-${slug}`;
            promoteQuery = `
                MATCH (u:User {id: $userId})
                MERGE (d:Domain {id: $domId}) ON CREATE SET d.name = $name
                MERGE (u)-[r:EXPERT_IN]->(d)
                ON CREATE SET r.memoryState = 'Recent', r.usageCount = 3, r.lastUsed = timestamp()
            `;
            await session.run(promoteQuery, { userId, domId, name });
        }
        
        // Remove candidate
        await session.run(`MATCH (c:Candidate {id: $candidateId}) DETACH DELETE c`, { candidateId });
    } finally {
        await session.close();
    }
};

export const ignoreCandidate = async (userId: string, candidateId: string) => {
    const session = getSession();
    try {
        await session.run(`MATCH (c:Candidate {id: $candidateId}) DETACH DELETE c`, { candidateId });
    } finally {
        await session.close();
    }
};

export const saveEnterpriseArtifact = async (
    userId: string, 
    prompt: string, 
    outcome: string, 
    knowledgeSummary: string, 
    contextNodes: {id: string, type: string}[], 
    type: string,
    provenance: {
        generationModel: string,
        brainVersion: string,
        contextPackVersion: string,
        policyVersion: string,
        promptHash: string,
        retrievalConfidence: string
    }
) => {
    const session = getSession();
    try {
        const artifactId = `art-${Date.now()}`;
        
        await session.run(`
            MATCH (u:User {id: $userId})
            CREATE (a:Artifact {
                id: $artifactId,
                type: $type,
                prompt: $prompt,
                outcome: $outcome,
                knowledgeSummary: $knowledgeSummary,
                timestamp: $timestamp,
                confidence: 1.0,
                weight: 1,
                generationModel: $generationModel,
                brainVersion: $brainVersion,
                contextPackVersion: $contextPackVersion,
                policyVersion: $policyVersion,
                promptHash: $promptHash,
                retrievalConfidence: $retrievalConfidence
            })
            CREATE (u)-[:AUTHORED]->(a)
        `, {
            userId,
            artifactId,
            type,
            prompt,
            outcome,
            knowledgeSummary,
            timestamp: Date.now(),
            ...provenance
        });

        for (const node of contextNodes) {
            let rel = 'REFERENCES';
            if (node.type === 'Policy') rel = 'COMPLIES_WITH';
            if (node.type === 'Domain') rel = 'RELATES_TO';
            
            await session.run(`
                MATCH (a:Artifact {id: $artifactId})
                MATCH (c {id: $contextId})
                CREATE (a)-[:${rel}]->(c)
            `, {
                artifactId,
                contextId: node.id
            });
        }
        
        return artifactId;
    } finally {
        await session.close();
    }
};

export const getWorkspaceState = async (userId: string) => {
    const session = getSession();
    try {
        const projectsRes = await session.run(`
            MATCH (u:User {id: $userId})-[:WORKS_ON]->(p:Project)
            RETURN p.id as id, p.name as name, coalesce(p.usageCount, 0) as count
            ORDER BY count DESC LIMIT 3
        `, { userId });
        const activeProjects = projectsRes.records.map(r => ({ id: r.get('id'), name: r.get('name') }));

        const artifactsRes = await session.run(`
            MATCH (u:User {id: $userId})-[:AUTHORED]->(a:Artifact)
            RETURN a.id as id, a.type as type, a.knowledgeSummary as summary, a.timestamp as timestamp
            ORDER BY a.timestamp DESC LIMIT 5
        `, { userId });
        const recentArtifacts = artifactsRes.records.map(r => ({ id: r.get('id'), type: r.get('type'), summary: r.get('summary'), timestamp: r.get('timestamp') }));

        const candidatesRes = await session.run(`
            MATCH (u:User {id: $userId})-[:HAS_CANDIDATE]->(c:Candidate {status: 'Pending'})
            RETURN c.id as id, c.entityName as name, c.entityType as type
            LIMIT 3
        `, { userId });
        const pendingCandidates = candidatesRes.records.map(r => ({ id: r.get('id'), name: r.get('name'), type: r.get('type') }));

        return {
            activeProjects,
            recentArtifacts,
            pendingCandidates
        };
    } finally {
        await session.close();
    }
};

export const fetchArtifactTimeline = async (userId: string) => {
    const session = getSession();
    try {
        const query = `
            MATCH (u:User {id: $userId})-[:AUTHORED]->(a:Artifact)
            OPTIONAL MATCH (a)-[r]->(c)
            WITH a, collect({type: type(r), contextId: c.id, contextName: coalesce(c.name, c.ruleText, c.id), contextNodeType: labels(c)[0]}) as references
            RETURN a.id as id, a.type as type, a.prompt as prompt, a.outcome as outcome, a.knowledgeSummary as knowledgeSummary, a.timestamp as timestamp, coalesce(a.weight, 1) as weight, references, a.retrievalConfidence as retrievalConfidence, a.generationModel as generationModel, a.promptHash as promptHash, a.brainVersion as brainVersion
            ORDER BY a.timestamp DESC
        `;
        const res = await session.run(query, { userId });
        return res.records.map(r => ({
            id: r.get('id'),
            type: r.get('type'),
            prompt: r.get('prompt'),
            outcome: r.get('outcome'),
            knowledgeSummary: r.get('knowledgeSummary'),
            timestamp: r.get('timestamp').toNumber ? r.get('timestamp').toNumber() : Number(r.get('timestamp')),
            weight: r.get('weight').toNumber ? r.get('weight').toNumber() : Number(r.get('weight')),
            references: r.get('references').filter((ref: any) => ref.type !== null)
        }));
    } finally {
        await session.close();
    }
};

export const provideArtifactFeedback = async (artifactId: string, feedbackType: 'Helpful' | 'Needs Revision' | 'Promote to Enterprise Knowledge' | 'Archive') => {
    const session = getSession();
    try {
        let weightDelta = 0;
        let confidenceDelta = 0;
        if (feedbackType === 'Helpful') { weightDelta = 1; confidenceDelta = 0.1; }
        if (feedbackType === 'Promote to Enterprise Knowledge') { weightDelta = 5; confidenceDelta = 0.5; }
        if (feedbackType === 'Needs Revision') { weightDelta = -1; confidenceDelta = -0.2; }
        if (feedbackType === 'Archive') { weightDelta = -10; confidenceDelta = -1.0; }

        await session.run(`
            MATCH (a:Artifact {id: $artifactId})
            SET a.weight = coalesce(a.weight, 1) + $weightDelta
            SET a.confidence = coalesce(a.confidence, 1.0) + $confidenceDelta
            RETURN a
        `, { artifactId, weightDelta, confidenceDelta });
    } finally {
        await session.close();
    }
};
