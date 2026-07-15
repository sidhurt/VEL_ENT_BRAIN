import { getSession } from '../db';

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
            WHERE a.status = 'Validated' AND a.authority IN ['Verified', 'Authoritative']
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
        // Directed, fixed-shape traversals only. The previous undirected [*0..3]
        // expansion walked back through shared Team/Org hubs into colleagues'
        // personal subgraphs (traversal amplification). Constitution Article 2 /
        // Invariant I2: the principal sees their own context and their
        // membership chain — nothing reachable merely because a hub connects it.
        const query = `
            MATCH path=(u:User {id: $userId})-[:WORKS_ON|HAS_STYLE|HAS_ROLE|EXPERT_IN|PERFORMS]->()
            RETURN path
            UNION
            MATCH path=(u:User {id: $userId})-[:MEMBER_OF]->(:Team)
            RETURN path
            UNION
            MATCH path=(u:User {id: $userId})-[:MEMBER_OF]->(:Team)-[:ENFORCES]->(:Policy)
            RETURN path
            UNION
            MATCH path=(u:User {id: $userId})-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(:Organization)
            RETURN path
            UNION
            MATCH path=(u:User {id: $userId})-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(:Organization)-[:ENFORCES]->(:Policy)
            RETURN path
            UNION
            MATCH path=(u:User {id: $userId})-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(:Organization)-[:OWNS]->(:Project)
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
