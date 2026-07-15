import express from 'express';
import { requireAdmin } from '../auth';
import {
    seedDemoPersonas,
    fetchUsers,
    fetchEnterprises,
    fetchEnterpriseDetails,
    attachUserToEnterprise
} from '../graph/enterprise';
import { fetchTrustQueue, updateArtifactTrust } from '../graph/trust';
import { getSession } from '../db';

// Admin console: provisioning, enterprise onboarding, destructive operations,
// and the trust review queue. requireAdmin is applied per-route; the trust
// queue read is deliberately available to any authenticated principal.
const router = express.Router();

router.post('/api/admin/provision-user', requireAdmin, async (req, res) => {
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

router.post('/api/onboard/enterprise', requireAdmin, async (req, res) => {
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

router.delete('/api/users/:userId', requireAdmin, async (req, res) => {
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

router.delete('/api/enterprises/:orgId', requireAdmin, async (req, res) => {
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

router.delete('/api/admin/clear', requireAdmin, async (req, res) => {
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

router.get('/api/trust/queue', async (req, res) => {
    try {
        const queue = await fetchTrustQueue(req.principal!.id);
        res.json(queue);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/trust/review/:artifactId', requireAdmin, async (req, res) => {
    try {
        const { action } = req.body;
        await updateArtifactTrust(String(req.params.artifactId), action);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const users = await fetchUsers();
        res.json(users);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/enterprises', requireAdmin, async (req, res) => {
    try {
        const enterprises = await fetchEnterprises();
        res.json(enterprises);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/enterprise/:orgId/details', requireAdmin, async (req, res) => {
    try {
        const details = await fetchEnterpriseDetails(String(req.params.orgId));
        res.json(details);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/enterprise/attach-user', requireAdmin, async (req, res) => {
    try {
        const { userId, orgId } = req.body;
        if (!userId || !orgId) throw new Error("userId and orgId required");
        await attachUserToEnterprise(userId, orgId);
        res.json({ success: true, message: "User attached to Enterprise" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/onboard/demo-personas', requireAdmin, async (req, res) => {
    try {
        await seedDemoPersonas();
        res.json({ message: "Demo personas seeded successfully." });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
