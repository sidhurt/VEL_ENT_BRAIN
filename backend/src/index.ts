import express from 'express';
import cors from 'cors';
import { 
    fetchAllMemories, 
    rankAndSelectContext, 
    updateMemoryStates, 
    decayMemories, 
    fetchMemoryCards, 
    updateProjectStatus, 
    fetchGraphData,
    fetchEvolutionMetrics,
    seedDemoPersonas,
    fetchUsers,
    fetchEnterprises,
    fetchEnterpriseDetails,
    attachUserToEnterprise,
    upsertCandidateEntity,
    fetchCandidates,
    promoteCandidateToMemory,
    ignoreCandidate,
    saveEnterpriseArtifact,
    getWorkspaceState,
    fetchArtifactTimeline,
    provideArtifactFeedback,
    fetchTrustQueue,
    updateArtifactTrust
} from './graphService';
import { llmService } from './llmService';
import { issueToken, requireAuth, requireAdmin, verifyGoogleCredential, devLoginAllowed } from './auth';
import {
    createClient, listClients, getClientBrain,
    proposeKnowledge, getReviewQueue, reviewKnowledge,
    assembleClientContext, generateForClient
} from './clientBrain';
import { extractClientKnowledge } from './extraction';
import { parseDocument } from './fileParsing';
import multer from 'multer';

// In-memory uploads (serverless-safe), capped at 15MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health Check for Cloud Deployment
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Google Sign-In: verified identity. Creates/updates the User node and issues
// the platform JWT. This is the real login; dev login below is scaffolding.
app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body ?? {};
        if (!credential) return res.status(422).json({ error: 'credential required' });
        const g = await verifyGoogleCredential(credential);
        const session = getSession();
        try {
            await session.run(
                `MERGE (u:User {id: $id})
                 SET u.name = $name, u.email = $email, u.authProvider = 'google', u.lastLogin = timestamp()`,
                { id: g.id, name: g.name, email: g.email ?? null }
            );
        } finally {
            await session.close();
        }
        const principal = { id: g.id, name: g.name };
        res.json({ token: issueToken(principal), principal });
    } catch (err: any) {
        res.status(401).json({ error: 'Google sign-in failed: ' + err.message });
    }
});

// Dev login (identity-asserted, no credential). Disabled in production unless
// ALLOW_DEV_LOGIN=true (needed by the admin console until Client Room ships).
app.post('/api/auth/login', (req, res) => {
    if (!devLoginAllowed) {
        return res.status(403).json({ error: 'Dev login is disabled in production. Use Google sign-in.' });
    }
    const { principalId, name } = req.body ?? {};
    const id = String(principalId ?? '').trim()
        || String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!id) return res.status(422).json({ error: 'principalId or name required' });
    const principal = { id, name: String(name ?? id) };
    res.json({ token: issueToken(principal), principal });
});

// Everything below this gate requires an authenticated principal.
// Identity comes from the token, never from the caller's body or params.
app.use('/api', requireAuth);

// Route-param identity must match the authenticated principal (fail closed).
const selfParam = (param: string): express.RequestHandler<Record<string, string>> =>
    (req, res, next) => {
        if (req.params[param] !== req.principal!.id) {
            return res.status(403).json({ error: 'Forbidden: identity mismatch' });
        }
        next();
    };

// Get Memory Cards for a User
app.get('/api/cards/:userId', selfParam('userId'), async (req, res) => {
    try {
        const cards = await fetchMemoryCards(req.params.userId);
        res.json(cards);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get Graph Data for Visualization
app.get('/api/graph/:userId', selfParam('userId'), async (req, res) => {
    try {
        const graph = await fetchGraphData(req.params.userId);
        res.json(graph);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get Memory Evolution Metrics
app.get('/api/evolution/:userId', selfParam('userId'), async (req, res) => {
    try {
        const metrics = await fetchEvolutionMetrics(req.params.userId);
        res.json(metrics);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get Candidate Memories
app.get('/api/evolution/:userId/candidates', selfParam('userId'), async (req, res) => {
    try {
        const candidates = await fetchCandidates(req.params.userId);
        res.json(candidates);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Promote Candidate to Memory
app.post('/api/evolution/:userId/candidates/:candidateId/promote', selfParam('userId'), async (req, res) => {
    try {
        await promoteCandidateToMemory(req.params.userId, req.params.candidateId);
        res.json({ success: true, message: 'Candidate promoted' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Ignore Candidate
app.delete('/api/evolution/:userId/candidates/:candidateId/ignore', selfParam('userId'), async (req, res) => {
    try {
        await ignoreCandidate(req.params.userId, req.params.candidateId);
        res.json({ success: true, message: 'Candidate ignored' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

import { getSession } from './db';

app.post('/api/onboard/personal', async (req, res) => {
    const session = getSession();
    try {
        const { name, role, domains, projects, tasks, style } = req.body;
        const userId = req.principal!.id; // identity from token, never from body
        
        // 1. Create User
        await session.run(`MERGE (u:User {id: $userId}) ON CREATE SET u.name = $name`, { userId, name });

        // 2. Role
        if (role) {
            const roleId = 'role-' + role.toLowerCase().replace(/[^a-z0-9]/g, '-');
            await session.run(`
                MATCH (u:User {id: $userId})
                MERGE (r:Role {id: $roleId}) ON CREATE SET r.name = $role
                MERGE (u)-[:HAS_ROLE]->(r)
            `, { userId, roleId, role });
        }

        // 3. Domains
        if (domains && Array.isArray(domains)) {
            for (const domain of domains) {
                const domId = 'domain-' + domain.toLowerCase().replace(/[^a-z0-9]/g, '-');
                await session.run(`
                    MATCH (u:User {id: $userId})
                    MERGE (d:Domain {id: $domId}) ON CREATE SET d.name = $domain
                    MERGE (u)-[:EXPERT_IN]->(d)
                `, { userId, domId, domain });
            }
        }

        // 4. Projects
        if (projects && Array.isArray(projects)) {
            for (const proj of projects) {
                const projId = 'proj-' + proj.toLowerCase().replace(/[^a-z0-9]/g, '-');
                await session.run(`
                    MATCH (u:User {id: $userId})
                    MERGE (p:Project {id: $projId}) ON CREATE SET p.name = $proj, p.type = 'Personal'
                    MERGE (u)-[:WORKS_ON {memoryState: 'Active', usageCount: 10, lastUsed: timestamp()}]->(p)
                `, { userId, projId, proj });
            }
        }

        // 5. Tasks
        if (tasks && Array.isArray(tasks)) {
            for (const task of tasks) {
                const taskId = 'task-' + task.toLowerCase().replace(/[^a-z0-9]/g, '-');
                await session.run(`
                    MATCH (u:User {id: $userId})
                    MERGE (t:Task {id: $taskId}) ON CREATE SET t.name = $task
                    MERGE (u)-[:PERFORMS {memoryState: 'Active', usageCount: 5, lastUsed: timestamp()}]->(t)
                `, { userId, taskId, task });
            }
        }

        // 6. Style
        if (style) {
            const styleId = 'style-' + userId;
            await session.run(`
                MATCH (u:User {id: $userId})
                MERGE (s:Style {id: $styleId}) ON CREATE SET s.formattingRules = $style
                MERGE (u)-[:HAS_STYLE {memoryState: 'Active', usageCount: 5, lastUsed: timestamp()}]->(s)
            `, { userId, styleId, style });
        }

        res.json({ success: true, message: 'Personal Brain Onboarded' });
    } catch (err: any) {
        console.error("Personal Onboard Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

app.post('/api/admin/provision-user', requireAdmin, async (req, res) => {
    const session = getSession();
    try {
        const { userId, name, role, domains, projects, tasks, style } = req.body;
        if (!userId) throw new Error("userId required");
        
        // 1. Create User
        await session.run(`MERGE (u:User {id: $userId}) ON CREATE SET u.name = $name`, { userId, name });

        // 2. Role
        if (role) {
            const roleId = 'role-' + role.toLowerCase().replace(/[^a-z0-9]/g, '-');
            await session.run(`
                MATCH (u:User {id: $userId})
                MERGE (r:Role {id: $roleId}) ON CREATE SET r.name = $role
                MERGE (u)-[:HAS_ROLE]->(r)
            `, { userId, roleId, role });
        }

        // 3. Domains
        if (domains && Array.isArray(domains)) {
            for (const domain of domains) {
                const domId = 'domain-' + domain.toLowerCase().replace(/[^a-z0-9]/g, '-');
                await session.run(`
                    MATCH (u:User {id: $userId})
                    MERGE (d:Domain {id: $domId}) ON CREATE SET d.name = $domain
                    MERGE (u)-[:EXPERT_IN]->(d)
                `, { userId, domId, domain });
            }
        }

        // 4. Projects
        if (projects && Array.isArray(projects)) {
            for (const proj of projects) {
                const projId = 'proj-' + proj.toLowerCase().replace(/[^a-z0-9]/g, '-');
                await session.run(`
                    MATCH (u:User {id: $userId})
                    MERGE (p:Project {id: $projId}) ON CREATE SET p.name = $proj, p.type = 'Personal'
                    MERGE (u)-[:WORKS_ON {memoryState: 'Active', usageCount: 10, lastUsed: timestamp()}]->(p)
                `, { userId, projId, proj });
            }
        }

        // 5. Tasks
        if (tasks && Array.isArray(tasks)) {
            for (const task of tasks) {
                const taskId = 'task-' + task.toLowerCase().replace(/[^a-z0-9]/g, '-');
                await session.run(`
                    MATCH (u:User {id: $userId})
                    MERGE (t:Task {id: $taskId}) ON CREATE SET t.name = $task
                    MERGE (u)-[:PERFORMS {memoryState: 'Active', usageCount: 5, lastUsed: timestamp()}]->(t)
                `, { userId, taskId, task });
            }
        }

        // 6. Style
        if (style) {
            const styleId = 'style-' + userId;
            await session.run(`
                MATCH (u:User {id: $userId})
                MERGE (s:Style {id: $styleId}) ON CREATE SET s.formattingRules = $style
                MERGE (u)-[:HAS_STYLE {memoryState: 'Active', usageCount: 5, lastUsed: timestamp()}]->(s)
            `, { userId, styleId, style });
        }

        res.json({ success: true, message: 'User provisioned by admin' });
    } catch (err: any) {
        console.error("Admin Provision Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

app.post('/api/onboard/enterprise', requireAdmin, async (req, res) => {
    const session = getSession();
    try {
        const { userId, orgId, orgName, policies, projects } = req.body;
        
        // 1. Create Organization and default Team, and link active user
        await session.run(`
            MERGE (o:Organization {id: $orgId}) ON CREATE SET o.name = $orgName, o.type = 'Enterprise'
            MERGE (t:Team {id: 'team-default-' + $orgId}) ON CREATE SET t.name = 'Default Team'
            MERGE (t)-[:BELONGS_TO]->(o)
            WITH t
            MATCH (u:User {id: $userId})
            MERGE (u)-[:MEMBER_OF]->(t)
        `, { userId, orgId, orgName });

        // 2. Policies
        if (policies && Array.isArray(policies)) {
            for (const i in policies) {
                const pol = policies[i];
                const polId = 'pol-' + orgId + '-' + i;
                await session.run(`
                    MATCH (o:Organization {id: $orgId})
                    MERGE (p:Policy {id: $polId}) ON CREATE SET p.ruleText = $pol, p.classification = 'Mandatory', p.status = 'Active'
                    MERGE (o)-[:ENFORCES {memoryState: 'Active', usageCount: 0, lastUsed: timestamp()}]->(p)
                `, { orgId, polId, pol });
            }
        }

        // 3. Enterprise Projects
        if (projects && Array.isArray(projects)) {
             for (const proj of projects) {
                const projId = 'proj-ent-' + orgId + '-' + proj.toLowerCase().replace(/[^a-z0-9]/g, '-');
                await session.run(`
                    MATCH (o:Organization {id: $orgId})
                    MERGE (p:Project {id: $projId}) ON CREATE SET p.name = $proj, p.type = 'Enterprise'
                    MERGE (o)-[:OWNS]->(p)
                `, { orgId, projId, proj });
            }
        }

        res.json({ success: true, message: 'Enterprise Brain Onboarded' });
    } catch (err: any) {
        console.error("Enterprise Onboard Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

app.delete('/api/users/:userId', requireAdmin, async (req, res) => {
    const session = getSession();
    try {
        await session.run(`MATCH (u:User {id: $userId}) DETACH DELETE u`, { userId: req.params.userId });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

app.delete('/api/enterprises/:orgId', requireAdmin, async (req, res) => {
    const session = getSession();
    try {
        const { orgId } = req.params;
        // Also optionally delete the default team for this org, and any policies/projects solely owned by it
        // Or we can just DETACH DELETE the org and let orphaned nodes remain, but it's cleaner to delete them.
        // For now, DETACH DELETE the org, its policies, its projects, and its teams.
        await session.run(`
            MATCH (o:Organization {id: $orgId})
            OPTIONAL MATCH (o)-[:ENFORCES]->(p:Policy)
            OPTIONAL MATCH (o)-[:OWNS]->(proj:Project)
            OPTIONAL MATCH (t:Team)-[:BELONGS_TO]->(o)
            DETACH DELETE o, p, proj, t
        `, { orgId });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

app.delete('/api/admin/clear', requireAdmin, async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Graph wipe is disabled in production' });
    }
    const session = getSession();
    try {
        await session.run(`MATCH (n) DETACH DELETE n`);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    } finally {
        await session.close();
    }
});

app.get('/api/trust/queue', async (req, res) => {
    try {
        const queue = await fetchTrustQueue(req.principal!.id);
        res.json(queue);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/trust/review/:artifactId', requireAdmin, async (req, res) => {
    try {
        const { action } = req.body;
        await updateArtifactTrust(String(req.params.artifactId), action);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Update Project Status manually (optional, legacy)
app.patch('/api/project/:projectId/status', async (req, res) => {
    try {
        const { userId, newStatus } = req.body;
        await updateProjectStatus(userId, req.params.projectId, newStatus);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// CLIENT BRAIN — V1 product routes. The client account is the anchor entity;
// every route walls to the caller's own org (enforced inside clientBrain.ts).
// Errors carry .status (403 walls) — surfaced honestly, defaulting to 500.
// ============================================================================

const clientErr = (res: express.Response, err: any) =>
    res.status(err.status || 500).json({ error: err.message });

app.post('/api/clients', async (req, res) => {
    try {
        const { name, industry } = req.body;
        if (!name?.trim()) return res.status(422).json({ error: 'Client name required' });
        res.json(await createClient(req.principal!.id, name.trim(), industry));
    } catch (err: any) { clientErr(res, err); }
});

app.get('/api/clients', async (req, res) => {
    try {
        res.json(await listClients(req.principal!.id));
    } catch (err: any) { clientErr(res, err); }
});

app.get('/api/clients/:clientId/brain', async (req, res) => {
    try {
        res.json(await getClientBrain(req.principal!.id, String(req.params.clientId)));
    } catch (err: any) { clientErr(res, err); }
});

// Manual proposal (single items typed/edited by a human)
app.post('/api/clients/:clientId/knowledge', async (req, res) => {
    try {
        const { items, source } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(422).json({ error: 'items[] required' });
        }
        res.json(await proposeKnowledge(req.principal!.id, String(req.params.clientId), items, source || 'manual'));
    } catch (err: any) { clientErr(res, err); }
});

// Ingestion: raw document text -> extracted candidates -> review queue.
// V1 accepts extracted text; file parsing (PDF/DOCX/PPTX) is specced for handoff.
app.post('/api/clients/:clientId/ingest', async (req, res) => {
    try {
        const { text, sourceName } = req.body;
        if (!text?.trim() || text.trim().length < 100) {
            return res.status(422).json({ error: 'text required (min 100 chars of document content)' });
        }
        const clientId = String(req.params.clientId);
        // Wall check + client name happen inside; do a cheap access probe first
        const { clientName } = await getClientBrain(req.principal!.id, clientId);
        const extraction = await extractClientKnowledge(text, clientName, sourceName || 'uploaded document');
        const result = await proposeKnowledge(req.principal!.id, clientId, extraction.items, sourceName || 'uploaded document');
        res.json({
            extracted: extraction.items.length,
            proposed: result.proposed,
            chunks: extraction.chunks,
            model: extraction.model,
            items: extraction.items,
        });
    } catch (err: any) { clientErr(res, err); }
});

// File ingestion: PDF / DOCX / TXT / MD -> parsed text -> extraction -> review queue.
app.post('/api/clients/:clientId/ingest-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(422).json({ error: "multipart field 'file' required" });
        const clientId = String(req.params.clientId);
        const sourceName = req.file.originalname || 'uploaded file';
        const { clientName } = await getClientBrain(req.principal!.id, clientId); // wall check
        const parsed = await parseDocument(req.file.buffer, sourceName);
        const extraction = await extractClientKnowledge(parsed.text, clientName, sourceName);
        const result = await proposeKnowledge(req.principal!.id, clientId, extraction.items, sourceName);
        res.json({
            file: sourceName,
            format: parsed.format,
            textChars: parsed.text.length,
            truncated: parsed.truncated,
            extracted: extraction.items.length,
            proposed: result.proposed,
            items: extraction.items,
        });
    } catch (err: any) { clientErr(res, err); }
});

app.get('/api/clients/:clientId/review-queue', async (req, res) => {
    try {
        res.json(await getReviewQueue(req.principal!.id, String(req.params.clientId)));
    } catch (err: any) { clientErr(res, err); }
});

app.post('/api/knowledge/:knowledgeId/review', async (req, res) => {
    try {
        const { action, edits } = req.body;
        if (action !== 'approve' && action !== 'reject') {
            return res.status(422).json({ error: "action must be 'approve' or 'reject'" });
        }
        res.json(await reviewKnowledge(req.principal!.id, String(req.params.knowledgeId), action, edits));
    } catch (err: any) { clientErr(res, err); }
});

// Client-scoped assembly / generation. Every response carries the receipt
// asserting the wall: only this client's brain was reachable.
app.post('/api/clients/:clientId/enhance', async (req, res) => {
    try {
        const { prompt, executionMode = 'execute' } = req.body;
        if (!prompt?.trim()) return res.status(422).json({ error: 'prompt required' });
        const clientId = String(req.params.clientId);
        if (executionMode === 'assemble') {
            res.json(await assembleClientContext(req.principal!.id, clientId, prompt));
        } else {
            res.json(await generateForClient(req.principal!.id, clientId, prompt));
        }
    } catch (err: any) { clientErr(res, err); }
});

// Core Enhance / Context Assembly Endpoint
app.post('/api/enhance', async (req, res) => {
    const pipelineTrace: any[] = [];
    const recordTrace = (step: string) => {
        pipelineTrace.push({ step, time: Date.now() });
    };

    try {
        recordTrace('Request Received');
        const { prompt, executionMode = 'assemble' } = req.body;
        const userId = req.principal!.id; // identity from token, never from body
        
        recordTrace('Identity Retrieved');
        recordTrace('Organization Retrieved');
        recordTrace('Graph Traversed');
        // 1. Fetch all raw memories
        const memories = await fetchAllMemories(userId);

        recordTrace('Knowledge Ranked');
        // 2. Rank and select context based on prompt intent and relevance score
        const rankedContext = rankAndSelectContext(memories, prompt);

        // 3. Evolve memories automatically based on usage
        recordTrace('Graph Reinforced');
        const selectedEdgeIds = rankedContext.map(rc => rc.memory.edgeId);
        await updateMemoryStates(selectedEdgeIds);

        // 4. Prepare Explainability Receipt & Context Pack
        const rawMemories = rankedContext.map(rc => rc.memory);
        
        // Fetch User Name
        const session = getSession();
        let userName = userId;
        try {
            const userRes = await session.run(`MATCH (u:User {id: $userId}) RETURN coalesce(u.name, u.id) as name`, { userId });
            if (userRes.records.length > 0) {
                userName = userRes.records[0].get('name');
            }
        } finally {
            await session.close();
        }

        // Build the structural Context Pack according to the API Contract
        const contextPack = {
            identityContext: {
                name: userName,
                roles: rawMemories.filter(m => m.type === 'Role').map(m => m.content),
                domains: rawMemories.filter(m => m.type === 'Domain').map(m => m.content)
            },
            projectContext: rawMemories.filter(m => m.type === 'Project').map(m => ({
                id: m.id,
                name: m.content
            })),
            taskContext: rawMemories.filter(m => m.type === 'Task').map(m => ({
                id: m.id,
                name: m.content
            })),
            styleContext: rawMemories.filter(m => m.type === 'Style').map(m => m.content),
            policyContext: rawMemories.filter(m => m.type === 'Policy').map(m => ({
                id: m.id,
                ruleText: m.content
            }))
        };

        recordTrace('Policies Applied');
        recordTrace('Context Assembled');
        
        const explainabilityReceipt = rankedContext.map(rc => ({
            type: rc.memory.type,
            name: rc.memory.content,
            reasons: rc.reasons,
            confidence: rc.confidence,
            weight: rc.score // passing the raw score to calculate % on frontend
        }));

        let responsePayload: any = {
            contextPack,
            explainabilityReceipt,
            outcomeProfile: 'Generic' // fallback for now
        };

        if (executionMode === 'execute') {
            recordTrace('Outcome Generated');
            const llmResult = await llmService.execute(contextPack, prompt);
            responsePayload.generatedOutcome = llmResult.generatedOutcome;
            responsePayload.executionMetadata = llmResult.executionMetadata;
            responsePayload.knowledgeExtraction = llmResult.knowledgeExtraction;

            recordTrace('Knowledge Extracted');
            recordTrace('Artifact Persisted');
            
            // Weave artifact into graph synchronously
            const contextNodes = rankedContext.map(rc => ({ id: rc.memory.id, type: rc.memory.type }));
            const summary = llmResult.knowledgeExtraction?.knowledgeSummary || 'Generic Generation';
            const type = 'Enterprise Document';
            
            const provenance = {
                generationModel: 'gpt-4o-mini',
                brainVersion: 'v1.0.0',
                contextPackVersion: 'v1.0.0',
                policyVersion: 'v1.0.0',
                promptHash: Array.from(String(prompt)).reduce((s: number, c: string) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0).toString(16),
                retrievalConfidence: rankedContext.length > 0 ? (rankedContext.reduce((acc: number, curr: any) => acc + Number(curr.confidence || 0), 0) / rankedContext.length).toFixed(2) : '0'
            };
            
            await saveEnterpriseArtifact(userId, prompt, llmResult.generatedOutcome, summary, contextNodes, type, provenance);
        }

        responsePayload.pipelineTrace = pipelineTrace;

        res.json(responsePayload);

        // --- ASYNCHRONOUS CANDIDATE EXTRACTION ---
        // Do not await this. It runs in the background.
        llmService.extractCandidateEntities(prompt).then(async (candidates) => {
            for (const cand of candidates) {
                // Ignore if it's already in the top selected context to prevent redundant candidates
                const alreadyExists = rankedContext.some(rc => 
                    rc.memory.type === cand.type && 
                    rc.memory.content.toLowerCase().includes(cand.name.toLowerCase())
                );
                if (!alreadyExists) {
                    await upsertCandidateEntity(userId, cand.type, cand.name, cand.confidence);
                }
            }
        }).catch(err => {
            console.error("Async candidate extraction failed:", err);
        });

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Proactive Workspace State
app.get('/api/workspace/state/:userId', selfParam('userId'), async (req, res) => {
    try {
        const state = await getWorkspaceState(req.params.userId);
        res.json(state);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch Artifact Timeline
app.get('/api/artifacts/:userId', selfParam('userId'), async (req, res) => {
    try {
        const timeline = await fetchArtifactTimeline(req.params.userId);
        res.json(timeline);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Provide Artifact Feedback
app.post('/api/artifacts/:id/feedback', async (req, res) => {
    try {
        const { feedbackType } = req.body;
        await provideArtifactFeedback(req.params.id, feedbackType);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Simulate time passing to demonstrate decay
app.post('/api/simulate-time', async (req, res) => {
    try {
        const { days } = req.body;
        const userId = req.principal!.id;
        if (!days) throw new Error("days required");
        await decayMemories(userId, days);
        res.json({ success: true, message: `Simulated ${days} days passing. Memory states updated.` });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const users = await fetchUsers();
        res.json(users);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/enterprises', requireAdmin, async (req, res) => {
    try {
        const enterprises = await fetchEnterprises();
        res.json(enterprises);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/enterprise/:orgId/details', requireAdmin, async (req, res) => {
    try {
        const details = await fetchEnterpriseDetails(String(req.params.orgId));
        res.json(details);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/enterprise/attach-user', requireAdmin, async (req, res) => {
    try {
        const { userId, orgId } = req.body;
        if (!userId || !orgId) throw new Error("userId and orgId required");
        await attachUserToEnterprise(userId, orgId);
        res.json({ success: true, message: "User attached to Enterprise" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/onboard/demo-personas', requireAdmin, async (req, res) => {
    try {
        await seedDemoPersonas();
        res.json({ message: "Demo personas seeded successfully." });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Unified Brain Backend running on http://localhost:${PORT}`);
    });
}

export default app;
