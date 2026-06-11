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
    
    const scoredMemories = memories.map(mem => {
        let intentScore = 0;
        let reasons: string[] = [];

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
        if (daysSince < 1) {
            recencyScore = 15;
            reasons.push('Used recently');
        } else if (daysSince < 7) {
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

        return {
            memory: mem,
            score: totalScore,
            reasons,
            confidence: totalScore > 80 ? 'High' : (totalScore > 40 ? 'Medium' : 'Low')
        };
    });

    // Filter out negatively scored and sort
    const validMemories = scoredMemories.filter(sm => sm.score >= 0).sort((a, b) => b.score - a.score);
    
    // Select top N (e.g., top 10)
    const selected = validMemories.slice(0, 10);
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
            MATCH path=(u:User {id: $userId})-[*0..2]-(n)
            WHERE 'User' IN labels(n) OR 'Project' IN labels(n) OR 'Style' IN labels(n) OR 'Team' IN labels(n) OR 'Organization' IN labels(n) OR 'Policy' IN labels(n)
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
