import express from 'express';
import cors from 'cors';
import { 
    fetchAllMemories, 
    rankAndSelectContext, 
    updateMemoryStates, 
    decayMemories, 
    fetchMemoryCards, 
    updateProjectStatus, 
    fetchGraphData 
} from './graphService';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Get Memory Cards for a User
app.get('/api/cards/:userId', async (req, res) => {
    try {
        const cards = await fetchMemoryCards(req.params.userId);
        res.json(cards);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get Graph Data for Visualization
app.get('/api/graph/:userId', async (req, res) => {
    try {
        const graph = await fetchGraphData(req.params.userId);
        res.json(graph);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Form Seeding Endpoints
import { v4 as uuidv4 } from 'uuid';
import { getSession } from './db';

app.post('/api/forms/consumer/project', async (req, res) => {
    const session = getSession();
    try {
        const { userId, name } = req.body;
        const id = 'proj-' + uuidv4();
        await session.run(`
            MATCH (u:User {id: $userId})
            CREATE (p:Project {id: $id, name: $name, type: 'Personal'})
            CREATE (u)-[:WORKS_ON {memoryState: 'Active', usageCount: 0, lastUsed: timestamp()}]->(p)
        `, { userId, id, name });
        res.json({ success: true, id });
    } finally {
        await session.close();
    }
});

app.post('/api/forms/consumer/style', async (req, res) => {
    const session = getSession();
    try {
        const { userId, text } = req.body;
        const id = 'style-' + uuidv4();
        await session.run(`
            MATCH (u:User {id: $userId})
            CREATE (s:Style {id: $id, formattingRules: $text})
            CREATE (u)-[:HAS_STYLE {memoryState: 'Active', usageCount: 0, lastUsed: timestamp()}]->(s)
        `, { userId, id, text });
        res.json({ success: true, id });
    } finally {
        await session.close();
    }
});

app.post('/api/forms/enterprise/policy', async (req, res) => {
    const session = getSession();
    try {
        const { userId, text } = req.body;
        // In this MVP, we assume the user is part of a team and the policy is applied to that team
        const id = 'pol-' + uuidv4();
        await session.run(`
            MATCH (u:User {id: $userId})-[:MEMBER_OF]->(t:Team)
            CREATE (p:Policy {id: $id, ruleText: $text, type: 'Mandatory'})
            CREATE (t)-[:ENFORCES {memoryState: 'Active', usageCount: 0, lastUsed: timestamp()}]->(p)
        `, { userId, id, text });
        res.json({ success: true, id });
    } finally {
        await session.close();
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

// Core Enhance / Context Assembly Endpoint
app.post('/api/enhance', async (req, res) => {
    try {
        const { userId, prompt } = req.body;
        
        // 1. Fetch all raw memories
        const memories = await fetchAllMemories(userId);

        // 2. Rank and select context based on prompt intent and relevance score
        const rankedContext = rankAndSelectContext(memories, prompt);

        // 3. Evolve memories automatically based on usage
        const selectedEdgeIds = rankedContext.map(rc => rc.memory.edgeId);
        await updateMemoryStates(selectedEdgeIds);

        // 4. Prepare Explainability Receipt & Context Pack
        const contextPack = rankedContext.map(rc => rc.memory);
        const explainabilityReceipt = rankedContext.map(rc => ({
            node: rc.memory,
            reasons: rc.reasons,
            confidence: rc.confidence
        }));

        // Note: Formatting the prompt string is delegated to an external Prompt Engine.
        res.json({
            contextPack,
            explainabilityReceipt
        });

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Simulate time passing to demonstrate decay
app.post('/api/simulate-time', async (req, res) => {
    try {
        const { userId, days } = req.body;
        if (!userId || !days) throw new Error("userId and days required");
        await decayMemories(userId, days);
        res.json({ success: true, message: `Simulated ${days} days passing. Memory states updated.` });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Unified Brain Backend running on http://localhost:${PORT}`);
});
