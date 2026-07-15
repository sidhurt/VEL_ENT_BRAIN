import { getSession } from '../db';

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
                status: 'Proposed',
                source: 'LLM',
                authority: 'Unverified',
                generationModel: $generationModel,
                brainVersion: $brainVersion,
                contextPackVersion: $contextPackVersion,
                policyVersion: $policyVersion,
                promptHash: $promptHash,
                retrievalConfidence: $retrievalConfidence,
                ownerId: $userId,
                constitutionVersion: '1.0'
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
            RETURN a.id as id, a.type as type, a.prompt as prompt, a.outcome as outcome, a.knowledgeSummary as knowledgeSummary, a.timestamp as timestamp, coalesce(a.weight, 1) as weight, references, a.retrievalConfidence as retrievalConfidence, a.generationModel as generationModel, a.promptHash as promptHash, a.brainVersion as brainVersion, coalesce(a.status, 'Validated') as status, coalesce(a.source, 'LLM') as source, coalesce(a.authority, 'Verified') as authority
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
            references: r.get('references').filter((ref: any) => ref.type !== null),
            status: r.get('status'),
            source: r.get('source'),
            authority: r.get('authority')
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
