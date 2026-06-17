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
    attachUserToEnterprise
} from './graphService';
import { llmService } from './llmService';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health Check for Cloud Deployment
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Get Memory Evolution Metrics
app.get('/api/evolution/:userId', async (req, res) => {
    try {
        const metrics = await fetchEvolutionMetrics(req.params.userId);
        res.json(metrics);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

import { getSession } from './db';

app.post('/api/onboard/personal', async (req, res) => {
    const session = getSession();
    try {
        const { userId, name, role, domains, projects, tasks, style } = req.body;
        
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

app.post('/api/onboard/enterprise', async (req, res) => {
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

app.delete('/api/admin/clear', async (req, res) => {
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
        const { userId, prompt, executionMode = 'assemble' } = req.body;
        
        // 1. Fetch all raw memories
        const memories = await fetchAllMemories(userId);

        // 2. Rank and select context based on prompt intent and relevance score
        const rankedContext = rankAndSelectContext(memories, prompt);

        // 3. Evolve memories automatically based on usage
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

        const explainabilityReceipt = rankedContext.map(rc => ({
            type: rc.memory.type,
            name: rc.memory.content,
            reasons: rc.reasons,
            confidence: rc.confidence
        }));

        let responsePayload: any = {
            contextPack,
            explainabilityReceipt
        };

        if (executionMode === 'execute') {
            const llmResult = await llmService.execute(contextPack, prompt);
            responsePayload.generatedOutcome = llmResult.generatedOutcome;
            responsePayload.executionMetadata = llmResult.executionMetadata;
        }

        res.json(responsePayload);

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

app.get('/api/users', async (req, res) => {
    try {
        const users = await fetchUsers();
        res.json(users);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/enterprises', async (req, res) => {
    try {
        const enterprises = await fetchEnterprises();
        res.json(enterprises);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/enterprise/:orgId/details', async (req, res) => {
    try {
        const details = await fetchEnterpriseDetails(req.params.orgId);
        res.json(details);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/enterprise/attach-user', async (req, res) => {
    try {
        const { userId, orgId } = req.body;
        if (!userId || !orgId) throw new Error("userId and orgId required");
        await attachUserToEnterprise(userId, orgId);
        res.json({ success: true, message: "User attached to Enterprise" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/onboard/demo-personas', async (req, res) => {
    try {
        await seedDemoPersonas();
        res.json({ message: "Demo personas seeded successfully." });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/user/:userId', async (req, res) => {
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

app.delete('/api/admin/clear', async (req, res) => {
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

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Unified Brain Backend running on http://localhost:${PORT}`);
    });
}

export default app;
