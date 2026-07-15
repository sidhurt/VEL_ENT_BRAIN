import { getSession } from '../db';

export const fetchTrustQueue = async (reviewerId: string) => {
    const session = getSession();
    try {
        // Scoped to the reviewer's own proposals plus proposals from users who
        // share an organization with them. Previously unscoped: every proposed
        // artifact from every user/org was visible to any caller.
        const query = `
            MATCH (r:User {id: $reviewerId})
            MATCH (u:User)-[:AUTHORED]->(a:Artifact {status: 'Proposed'})
            WHERE u.id = r.id
               OR EXISTS {
                    MATCH (r)-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(o:Organization),
                          (u)-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(o)
                  }
            OPTIONAL MATCH (a)-[rel]->(c)
            WITH u, a, collect({type: type(rel), contextId: c.id, contextName: coalesce(c.name, c.ruleText, c.id), contextNodeType: labels(c)[0]}) as references
            RETURN a.id as id, a.knowledgeSummary as summary, u.name as author, a.timestamp as timestamp, a.source as source, a.authority as authority, a.status as status, references
            ORDER BY a.timestamp ASC
        `;
        const res = await session.run(query, { reviewerId });
        return res.records.map(r => ({
            id: r.get('id'),
            summary: r.get('summary'),
            author: r.get('author'),
            timestamp: r.get('timestamp').toNumber ? r.get('timestamp').toNumber() : Number(r.get('timestamp')),
            source: r.get('source'),
            authority: r.get('authority'),
            status: r.get('status'),
            references: r.get('references').filter((ref: any) => ref.type !== null)
        }));
    } finally {
        await session.close();
    }
};

export const updateArtifactTrust = async (artifactId: string, action: 'Validate' | 'Reject' | 'Promote' | 'Archive') => {
    const session = getSession();
    try {
        let status = 'Proposed';
        let authority = 'Unverified';

        if (action === 'Validate') {
            status = 'Validated';
            authority = 'Verified';
        } else if (action === 'Promote') {
            status = 'Validated';
            authority = 'Authoritative';
        } else if (action === 'Reject') {
            status = 'Rejected';
            authority = 'Unverified';
        } else if (action === 'Archive') {
            status = 'Archived';
            authority = 'Unverified';
        }

        await session.run(`
            MATCH (a:Artifact {id: $artifactId})
            SET a.status = $status, a.authority = $authority
        `, { artifactId, status, authority });
    } finally {
        await session.close();
    }
};
