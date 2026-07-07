import { getSession } from './db';
import { CONSTITUTION_VERSION } from './planes';
import { OpenAIProvider } from './llm/OpenAIProvider';

// ============================================================================
// CLIENT BRAIN — the V1 product core.
// The client account (not the employee) is the anchor entity. Each Client
// Brain is an isolated context domain: every query here binds exactly one
// clientId reached through the caller's own org membership, so cross-client
// assembly is inexpressible ("client walls"). Knowledge enters only through
// the propose -> review -> active lifecycle (promotion, Article 7).
// ============================================================================

export type KnowledgeKind = 'voice' | 'rule' | 'fact' | 'learning';

export interface KnowledgeItem {
    kind: KnowledgeKind;
    title: string;
    content: string;
    confidence?: number;
    evidence?: string;
}

const KINDS: KnowledgeKind[] = ['voice', 'rule', 'fact', 'learning'];

const genId = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// --- Wall check -------------------------------------------------------------
// Resolves the caller's org and verifies the client belongs to it, in one
// query. Every public function below goes through this. Zero rows = denied.
const requireClientAccess = async (session: any, principalId: string, clientId: string) => {
    const res = await session.run(`
        MATCH (u:User {id: $principalId})-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(o:Organization)-[:HAS_CLIENT]->(c:Client {id: $clientId})
        RETURN o.id as orgId, c.name as clientName LIMIT 1
    `, { principalId, clientId });
    if (res.records.length === 0) {
        const err: any = new Error('Client not found in your organization');
        err.status = 403;
        throw err;
    }
    return {
        orgId: res.records[0].get('orgId') as string,
        clientName: res.records[0].get('clientName') as string,
    };
};

const resolveOrg = async (session: any, principalId: string): Promise<{ orgId: string; orgName: string }> => {
    const res = await session.run(`
        MATCH (u:User {id: $principalId})-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(o:Organization)
        RETURN o.id as orgId, o.name as orgName LIMIT 1
    `, { principalId });
    if (res.records.length === 0) {
        const err: any = new Error('You must belong to an organization to manage clients');
        err.status = 403;
        throw err;
    }
    return { orgId: res.records[0].get('orgId'), orgName: res.records[0].get('orgName') };
};

// --- Clients ----------------------------------------------------------------

export const createClient = async (principalId: string, name: string, industry?: string) => {
    const session = getSession();
    try {
        const { orgId } = await resolveOrg(session, principalId);
        const clientId = 'client-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        await session.run(`
            MATCH (o:Organization {id: $orgId})
            MERGE (c:Client {id: $clientId})
            ON CREATE SET c.name = $name, c.industry = $industry, c.status = 'active',
                          c.createdAt = timestamp(), c.createdBy = $principalId,
                          c.constitutionVersion = $cv
            MERGE (o)-[:HAS_CLIENT]->(c)
        `, { orgId, clientId, name, industry: industry ?? null, principalId, cv: CONSTITUTION_VERSION });
        return { clientId, name };
    } finally {
        await session.close();
    }
};

export const listClients = async (principalId: string) => {
    const session = getSession();
    try {
        const { orgId } = await resolveOrg(session, principalId);
        const res = await session.run(`
            MATCH (o:Organization {id: $orgId})-[:HAS_CLIENT]->(c:Client)
            OPTIONAL MATCH (c)-[:HAS_KNOWLEDGE]->(k:ClientKnowledge)
            RETURN c.id as id, c.name as name, c.industry as industry, c.status as status,
                   c.createdAt as createdAt,
                   count(CASE WHEN k.status = 'active' THEN 1 END) as activeKnowledge,
                   count(CASE WHEN k.status = 'proposed' THEN 1 END) as pendingReview
            ORDER BY c.createdAt DESC
        `, { orgId });
        return res.records.map(r => ({
            id: r.get('id'),
            name: r.get('name'),
            industry: r.get('industry'),
            status: r.get('status'),
            activeKnowledge: Number(r.get('activeKnowledge')),
            pendingReview: Number(r.get('pendingReview')),
        }));
    } finally {
        await session.close();
    }
};

export const getClientBrain = async (principalId: string, clientId: string) => {
    const session = getSession();
    try {
        const { clientName } = await requireClientAccess(session, principalId, clientId);
        const res = await session.run(`
            MATCH (c:Client {id: $clientId})-[:HAS_KNOWLEDGE]->(k:ClientKnowledge {status: 'active'})
            RETURN k.id as id, k.kind as kind, k.title as title, k.content as content,
                   k.source as source, k.confidence as confidence,
                   k.promotedBy as promotedBy, k.reviewedBy as reviewedBy, k.reviewedAt as reviewedAt,
                   coalesce(k.usageCount, 0) as usageCount, k.lastUsed as lastUsed
            ORDER BY k.kind, coalesce(k.usageCount, 0) DESC
        `, { clientId });
        const brain: Record<KnowledgeKind, any[]> = { voice: [], rule: [], fact: [], learning: [] };
        res.records.forEach(r => {
            const kind = r.get('kind') as KnowledgeKind;
            if (brain[kind]) brain[kind].push({
                id: r.get('id'), title: r.get('title'), content: r.get('content'),
                source: r.get('source'), confidence: r.get('confidence'),
                usageCount: Number(r.get('usageCount')),
            });
        });
        return { clientId, clientName, brain };
    } finally {
        await session.close();
    }
};

// --- Promotion lifecycle: propose -> review -> active ------------------------

export const proposeKnowledge = async (
    principalId: string,
    clientId: string,
    items: KnowledgeItem[],
    source: string
) => {
    const session = getSession();
    try {
        await requireClientAccess(session, principalId, clientId);
        const valid = items.filter(i =>
            KINDS.includes(i.kind) &&
            typeof i.title === 'string' && i.title.trim().length > 0 &&
            typeof i.content === 'string' && i.content.trim().length > 0
        );
        for (const item of valid) {
            await session.run(`
                MATCH (c:Client {id: $clientId})
                CREATE (k:ClientKnowledge {
                    id: $id, kind: $kind, title: $title, content: $content,
                    status: 'proposed', source: $source,
                    confidence: $confidence, evidence: $evidence,
                    proposedBy: $principalId, proposedAt: timestamp(),
                    constitutionVersion: $cv
                })
                CREATE (c)-[:HAS_KNOWLEDGE]->(k)
            `, {
                clientId,
                id: genId('know'),
                kind: item.kind,
                title: item.title.trim().slice(0, 120),
                content: item.content.trim().slice(0, 1000),
                source,
                confidence: item.confidence ?? null,
                evidence: item.evidence?.slice(0, 300) ?? null,
                principalId,
                cv: CONSTITUTION_VERSION,
            });
        }
        return { proposed: valid.length, skipped: items.length - valid.length };
    } finally {
        await session.close();
    }
};

export const getReviewQueue = async (principalId: string, clientId: string) => {
    const session = getSession();
    try {
        await requireClientAccess(session, principalId, clientId);
        const res = await session.run(`
            MATCH (c:Client {id: $clientId})-[:HAS_KNOWLEDGE]->(k:ClientKnowledge {status: 'proposed'})
            RETURN k.id as id, k.kind as kind, k.title as title, k.content as content,
                   k.source as source, k.confidence as confidence, k.evidence as evidence,
                   k.proposedBy as proposedBy, k.proposedAt as proposedAt
            ORDER BY k.proposedAt ASC
        `, { clientId });
        return res.records.map(r => ({
            id: r.get('id'), kind: r.get('kind'), title: r.get('title'), content: r.get('content'),
            source: r.get('source'), confidence: r.get('confidence'), evidence: r.get('evidence'),
            proposedBy: r.get('proposedBy'),
        }));
    } finally {
        await session.close();
    }
};

// Approve activates; reject PURGES (Invariant I9 — rejected proposals leave no
// content behind). Both are recorded as PromotionEvents (Article: attributable,
// auditable). Optional edits let the reviewer fix title/content on approval.
export const reviewKnowledge = async (
    principalId: string,
    knowledgeId: string,
    action: 'approve' | 'reject',
    edits?: { title?: string; content?: string }
) => {
    const session = getSession();
    try {
        // Wall check via the knowledge item's client
        const res = await session.run(`
            MATCH (u:User {id: $principalId})-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(:Organization)
                  -[:HAS_CLIENT]->(c:Client)-[:HAS_KNOWLEDGE]->(k:ClientKnowledge {id: $knowledgeId, status: 'proposed'})
            RETURN c.id as clientId LIMIT 1
        `, { principalId, knowledgeId });
        if (res.records.length === 0) {
            const err: any = new Error('Knowledge item not found in your organization (or already reviewed)');
            err.status = 403;
            throw err;
        }
        const clientId = res.records[0].get('clientId');

        if (action === 'approve') {
            await session.run(`
                MATCH (k:ClientKnowledge {id: $knowledgeId})
                SET k.status = 'active',
                    k.reviewedBy = $principalId, k.reviewedAt = timestamp(),
                    k.title = coalesce($title, k.title),
                    k.content = coalesce($content, k.content)
            `, { knowledgeId, principalId, title: edits?.title ?? null, content: edits?.content ?? null });
        } else {
            await session.run(
                `MATCH (k:ClientKnowledge {id: $knowledgeId}) DETACH DELETE k`,
                { knowledgeId }
            );
        }

        await session.run(`
            MATCH (c:Client {id: $clientId})
            CREATE (e:PromotionEvent {
                id: $eventId, knowledgeId: $knowledgeId, action: $action,
                reviewerId: $principalId, timestamp: timestamp(),
                constitutionVersion: $cv
            })
            CREATE (c)-[:HAS_EVENT]->(e)
        `, { clientId, eventId: genId('evt'), knowledgeId, action, principalId, cv: CONSTITUTION_VERSION });

        return { knowledgeId, action, clientId };
    } finally {
        await session.close();
    }
};

// --- Client-scoped assembly + receipt ----------------------------------------
// Brand voice and rules are ALWAYS included (generation without them is what
// makes AI output generic). Facts and learnings are ranked against the prompt.
// The receipt states exactly what entered and asserts the wall.

const rankItems = (items: any[], prompt: string, cap: number) => {
    const promptLower = prompt.toLowerCase();
    return items
        .map(item => {
            const words: string[] = (item.title + ' ' + item.content).toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
            const matches = words.filter(w => promptLower.includes(w)).length;
            const score = matches * 10 + Number(item.usageCount || 0);
            return { item, score, reason: matches > 0 ? 'matched request' : 'frequently used' };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, cap);
};

export const assembleClientContext = async (principalId: string, clientId: string, prompt: string) => {
    const session = getSession();
    try {
        const { clientName } = await requireClientAccess(session, principalId, clientId);
        const res = await session.run(`
            MATCH (c:Client {id: $clientId})-[:HAS_KNOWLEDGE]->(k:ClientKnowledge {status: 'active'})
            RETURN k.id as id, k.kind as kind, k.title as title, k.content as content,
                   coalesce(k.usageCount, 0) as usageCount
        `, { clientId });

        const all = res.records.map(r => ({
            id: r.get('id'), kind: r.get('kind') as KnowledgeKind,
            title: r.get('title'), content: r.get('content'),
            usageCount: Number(r.get('usageCount')),
        }));

        const voice = all.filter(k => k.kind === 'voice');
        const rules = all.filter(k => k.kind === 'rule');
        const rankedFacts = rankItems(all.filter(k => k.kind === 'fact'), prompt, 6);
        const rankedLearnings = rankItems(all.filter(k => k.kind === 'learning'), prompt, 4);

        const used = [
            ...voice.map(k => ({ ...k, reason: 'brand voice — always included' })),
            ...rules.map(k => ({ ...k, reason: 'client rule — mandatory' })),
            ...rankedFacts.map(r => ({ ...r.item, reason: r.reason })),
            ...rankedLearnings.map(r => ({ ...r.item, reason: r.reason })),
        ];

        // Reinforce usage (memory evolution on the client brain)
        if (used.length > 0) {
            await session.run(`
                MATCH (k:ClientKnowledge) WHERE k.id IN $ids
                SET k.usageCount = coalesce(k.usageCount, 0) + 1, k.lastUsed = timestamp()
            `, { ids: used.map(k => k.id) });
        }

        const contextPack = {
            clientId, clientName,
            voice: voice.map(k => k.content),
            rules: rules.map(k => k.content),
            facts: rankedFacts.map(r => ({ title: r.item.title, content: r.item.content })),
            learnings: rankedLearnings.map(r => ({ title: r.item.title, content: r.item.content })),
        };

        const receipt = {
            clientId, clientName,
            itemsUsed: used.map(k => ({ id: k.id, kind: k.kind, title: k.title, reason: k.reason })),
            walls: `Assembled exclusively from ${clientName}'s Client Brain. No other client's knowledge was accessible to this request.`,
            assembledAt: Date.now(),
            constitutionVersion: CONSTITUTION_VERSION,
        };

        return { contextPack, receipt };
    } finally {
        await session.close();
    }
};

// --- Client-scoped generation --------------------------------------------------

const clientBriefing = (pack: any, agencyRequest: string) => `[CLIENT CONTEXT BRIEFING — ${pack.clientName}]

You are the AI assistant of a marketing agency, producing work FOR the client "${pack.clientName}".

${pack.voice.length > 0 ? `BRAND VOICE (write everything in this voice):\n${pack.voice.map((v: string) => `- ${v}`).join('\n')}\n` : ''}
${pack.rules.length > 0 ? `HARD RULES (mandatory, never violate, override everything else):\n${pack.rules.map((r: string) => `- ${r}`).join('\n')}\n` : ''}
${pack.facts.length > 0 ? `CLIENT FACTS:\n${pack.facts.map((f: any) => `- ${f.title}: ${f.content}`).join('\n')}\n` : ''}
${pack.learnings.length > 0 ? `LEARNINGS FROM PAST WORK (apply these):\n${pack.learnings.map((l: any) => `- ${l.title}: ${l.content}`).join('\n')}\n` : ''}
INSTRUCTIONS:
1. Use ONLY the client context above plus general marketing skill. Do not invent client-specific facts not present in the briefing.
2. If the request conflicts with a HARD RULE, follow the rule and say so briefly.
3. Output ready-to-use work (the deliverable itself), not advice about how to make it.`;

const generationProvider = new OpenAIProvider(process.env.GENERATION_MODEL || 'gpt-4o-mini');

export const generateForClient = async (principalId: string, clientId: string, prompt: string) => {
    const { contextPack, receipt } = await assembleClientContext(principalId, clientId, prompt);
    const result = await generationProvider.generate(clientBriefing(contextPack, prompt), prompt);
    return {
        generatedOutcome: result.text,
        contextPack,
        receipt,
        executionMetadata: result.metadata,
    };
};
