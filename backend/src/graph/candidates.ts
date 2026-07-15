import { getSession } from '../db';

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
                c.lastSeen = timestamp(),
                c.ownerId = $userId,
                c.constitutionVersion = '1.0'
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
