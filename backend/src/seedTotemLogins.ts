/**
 * Create sign-in identities for Totem's sandbox testers.
 *
 * Totem's domain is not on Google Workspace, so their work addresses are not
 * Google accounts and cannot use Google Sign-In. For the sandbox these are
 * dev-login principals: identity-asserted, no credential. Acceptable while the
 * graph holds only public-site data and a fictional sample client; must be
 * retired (ALLOW_DEV_LOGIN=false) before any real client material is loaded.
 *
 * Idempotent: MERGE-only, safe to re-run.
 */
import 'dotenv/config';
import { getSession } from './db';
import { CONSTITUTION_VERSION } from './planes';

const ORG_ID = 'org-totem-interactive';
const DEFAULT_TEAM_ID = `team-default-${ORG_ID}`;

const testers = [
    { id: 'totem-aniket', name: 'Aniket', email: 'aniket@toteminteractive.in' },
    { id: 'totem-pradeep', name: 'Pradeep', email: 'pradeep@toteminteractive.in' },
    { id: 'totem-vandan', name: 'Vandan', email: 'vandan@toteminteractive.in' },
    { id: 'totem-team', name: 'Totem Team', email: 'totemistaken@gmail.com' },
];

async function main() {
    const session = getSession();
    try {
        for (const t of testers) {
            await session.run(
                `MATCH (team:Team {id: $teamId})-[:BELONGS_TO]->(:Organization {id: $orgId})
                 MERGE (u:User {id: $id})
                 ON CREATE SET u.constitutionVersion = $cv
                 SET u.name = $name, u.email = $email, u.authProvider = 'dev-login',
                     u.accessType = 'sandbox-tester'
                 MERGE (u)-[m:MEMBER_OF]->(team)
                 ON CREATE SET m.memoryState = 'Active', m.usageCount = 0,
                               m.provenance = 'sandbox-provisioning'`,
                { ...t, teamId: DEFAULT_TEAM_ID, orgId: ORG_ID, cv: CONSTITUTION_VERSION }
            );
        }

        const check = await session.run(
            `MATCH (u:User {accessType: 'sandbox-tester'})-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(o:Organization {id: $orgId})
             RETURN u.id AS id, u.name AS name ORDER BY u.id`,
            { orgId: ORG_ID }
        );
        console.log('Sandbox logins provisioned:');
        for (const r of check.records) console.log(`  ${r.get('id')}  (${r.get('name')})`);
    } finally {
        await session.close();
    }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
