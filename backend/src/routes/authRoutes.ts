import express from 'express';
import { issueToken, verifyGoogleCredential, devLoginAllowed, resolveOrgForEmail } from '../auth';
import { getSession } from '../db';

// Unauthenticated token issuance. Mounted BEFORE the /api requireAuth gate;
// the auth rate limiter is applied to /api/auth in index.ts.
const router = express.Router();

// Google Sign-In: verified identity. Creates/updates the User node and issues
// the platform JWT. This is the real login; dev login below is scaffolding.
router.post('/api/auth/google', async (req, res) => {
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
            // Grant org membership on first sign-in when the address is mapped,
            // so the product is populated the moment a teammate logs in.
            const orgId = resolveOrgForEmail(g.email);
            if (orgId) {
                await session.run(
                    `MATCH (u:User {id: $id})
                     MATCH (t:Team {id: 'team-default-' + $orgId})-[:BELONGS_TO]->(:Organization)
                     MERGE (u)-[m:MEMBER_OF]->(t)
                     ON CREATE SET m.memoryState = 'Active', m.usageCount = 0,
                                   m.provenance = 'email-domain-auto-attach'
                     SET m.lastUsed = timestamp()`,
                    { id: g.id, orgId }
                );
            }
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
router.post('/api/auth/login', (req, res) => {
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

export default router;
