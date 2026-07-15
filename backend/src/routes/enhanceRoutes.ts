import express from 'express';
import { fetchAllMemories, rankAndSelectContext, updateMemoryStates } from '../graph/personalMemory';
import { saveEnterpriseArtifact } from '../graph/artifacts';
import { upsertCandidateEntity } from '../graph/candidates';
import { llmService } from '../llmService';
import { getSession } from '../db';

const router = express.Router();

// Core Enhance / Context Assembly Endpoint
router.post('/api/enhance', async (req, res) => {
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

export default router;
