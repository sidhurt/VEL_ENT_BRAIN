import express from 'express';
import {
    decayMemories,
    fetchMemoryCards,
    updateProjectStatus,
    fetchGraphData,
    fetchEvolutionMetrics
} from '../graph/personalMemory';
import { fetchCandidates, promoteCandidateToMemory, ignoreCandidate } from '../graph/candidates';
import { getWorkspaceState, fetchArtifactTimeline, provideArtifactFeedback } from '../graph/artifacts';
import { getSession } from '../db';

// Personal Brain: the principal's own memory graph. Every :userId route is
// walled to the authenticated principal via selfParam.
const router = express.Router();

// Route-param identity must match the authenticated principal (fail closed).
const selfParam = (param: string): express.RequestHandler<Record<string, string>> =>
    (req, res, next) => {
        if (req.params[param] !== req.principal!.id) {
            return res.status(403).json({ error: 'Forbidden: identity mismatch' });
        }
        next();
    };

// Get Memory Cards for a User
router.get('/api/cards/:userId', selfParam('userId'), async (req, res) => {
    try {
        const cards = await fetchMemoryCards(req.params.userId);
        res.json(cards);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get Graph Data for Visualization
router.get('/api/graph/:userId', selfParam('userId'), async (req, res) => {
    try {
        const graph = await fetchGraphData(req.params.userId);
        res.json(graph);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get Memory Evolution Metrics
router.get('/api/evolution/:userId', selfParam('userId'), async (req, res) => {
    try {
        const metrics = await fetchEvolutionMetrics(req.params.userId);
        res.json(metrics);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get Candidate Memories
router.get('/api/evolution/:userId/candidates', selfParam('userId'), async (req, res) => {
    try {
        const candidates = await fetchCandidates(req.params.userId);
        res.json(candidates);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Promote Candidate to Memory
router.post('/api/evolution/:userId/candidates/:candidateId/promote', selfParam('userId'), async (req, res) => {
    try {
        await promoteCandidateToMemory(req.params.userId, req.params.candidateId);
        res.json({ success: true, message: 'Candidate promoted' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Ignore Candidate
router.delete('/api/evolution/:userId/candidates/:candidateId/ignore', selfParam('userId'), async (req, res) => {
    try {
        await ignoreCandidate(req.params.userId, req.params.candidateId);
        res.json({ success: true, message: 'Candidate ignored' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/onboard/personal', async (req, res) => {
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

// Update Project Status manually (optional, legacy)
router.patch('/api/project/:projectId/status', async (req, res) => {
    try {
        const { userId, newStatus } = req.body;
        await updateProjectStatus(userId, req.params.projectId, newStatus);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Proactive Workspace State
router.get('/api/workspace/state/:userId', selfParam('userId'), async (req, res) => {
    try {
        const state = await getWorkspaceState(req.params.userId);
        res.json(state);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch Artifact Timeline
router.get('/api/artifacts/:userId', selfParam('userId'), async (req, res) => {
    try {
        const timeline = await fetchArtifactTimeline(req.params.userId);
        res.json(timeline);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Provide Artifact Feedback
router.post('/api/artifacts/:id/feedback', async (req, res) => {
    try {
        const { feedbackType } = req.body;
        await provideArtifactFeedback(req.params.id, feedbackType);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Simulate time passing to demonstrate decay
router.post('/api/simulate-time', async (req, res) => {
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

export default router;
