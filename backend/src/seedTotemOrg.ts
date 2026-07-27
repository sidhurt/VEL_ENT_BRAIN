/**
 * Seed the Totem Interactive organization into the org plane.
 *
 * Source: toteminteractive.in (About page "The Squad" team cards, Our Services page),
 * scraped 2026-07-27. Quotes are verbatim from the team cards. Personalities,
 * working styles, collaborations, policies, and project assignments are inferred
 * from the cards + roles and are marked provenance: 'inferred'.
 *
 * CREATE-ONLY: every statement is MERGE. This script never deletes and is safe
 * to re-run; re-running refreshes profile properties in place.
 */
import 'dotenv/config';
import { getSession } from './db';
import { CONSTITUTION_VERSION } from './planes';

const ORG_ID = 'org-totem-interactive';
const DEFAULT_TEAM_ID = `team-default-${ORG_ID}`; // matches attachUserToEnterprise convention
const SOURCE = 'toteminteractive.in';
const IMPORTED_AT = '2026-07-27';

interface Person {
    key: string;            // id suffix
    name: string;
    role: string;
    quote: string;          // verbatim from the team card
    personality: string;    // inferred profile, grounded in quote + role
    workingStyle: string;   // inferred communication/work style
    team: string;           // functional team key
    domains: string[];      // expertise (role-derived)
    tasks: string[];        // recurring responsibilities (role-derived)
    worksOn: string[];      // service-line/product project slugs
    isFounder?: boolean;
}

const people: Person[] = [
    {
        key: 'aakash', name: 'Aakash Puri', role: 'Founder', isFounder: true,
        quote: "After work, you'll find me either at home, developing new ideas, or at the gym, balancing bytes and biceps.",
        personality: 'Builder-founder: keeps developing product ideas after hours; disciplined routine anchored by the gym; leads from the front and wears product, sales, and technology hats interchangeably.',
        workingStyle: 'Direct and fast-moving; prefers a working prototype over a slide deck; idea-dense conversations.',
        team: 'leadership',
        domains: ['Product Strategy', 'Business Development', 'Client Relationships'],
        tasks: ['Company Direction', 'Client Acquisition', 'Product Ideation', 'Partnership Development'],
        worksOn: ['velocity-enterprise-platform', 'creative-consulting'],
    },
    {
        key: 'shoeb', name: 'Shoeb Khan', role: 'Operations Manager',
        quote: "When I'm not optimizing workflows, you'll find me catching a football or tennis match. Whether exploring new places or new strategies, I'm always on the move.",
        personality: 'Systems thinker who treats operations like match strategy: studies the play, optimizes the workflow, moves on to the next fixture. Competitive, adaptable, restless in a productive way.',
        workingStyle: 'Structured and checklist-driven; pragmatic communication; escalates early rather than late.',
        team: 'leadership',
        domains: ['Operations', 'Project Management', 'Client Delivery'],
        tasks: ['Workflow Optimization', 'Delivery Coordination', 'Resource Planning', 'Client Communication'],
        worksOn: ['software-development'],
    },
    {
        key: 'arjun', name: 'Arjun Gujar', role: 'Front End Lead',
        quote: "After work, you'll find me fine-tuning pixels and perfecting interfaces.",
        personality: 'Craft-obsessed frontend engineer; the interface is never quite done. Holds the quality bar for everything users see and touch.',
        workingStyle: 'Precise and detail-first; talks in components, states, and edge cases; reviews with a fine comb.',
        team: 'engineering',
        domains: ['Frontend Development', 'Web Performance'],
        tasks: ['Interface Implementation', 'Frontend Code Review', 'Design-to-Code Handoff'],
        worksOn: ['web-development', 'velocity-enterprise-platform'],
    },
    {
        key: 'abhishek', name: 'Abhishek Shah', role: 'Full Stack Developer',
        quote: "After work, you can find me either passionately ranting about tech trends or simply unwinding and recharging for the next coding challenge.",
        personality: 'Tech-trend evangelist with strong opinions about the stack, held with energy and defended with benchmarks; deliberate about recovery between hard pushes.',
        workingStyle: 'Enthusiastic and opinionated; current with the ecosystem; prototypes to settle arguments.',
        team: 'engineering',
        domains: ['Full Stack Development', 'API Design'],
        tasks: ['Feature Development', 'API Development', 'Technology Evaluation'],
        worksOn: ['software-development', 'ios-android-app-development'],
    },
    {
        key: 'nikhil', name: 'Nikhil Chauhan', role: 'Full Stack Developer',
        quote: "Whether I'm coding or gaming, I'm always up for a challenge. Building in the virtual world or on the field, I'm all about leveling up.",
        personality: "Gamer's mindset applied to engineering: every hard problem is a level, every skill a stat to grind. Competitive on the field and in the codebase; persistent past the point where others stop.",
        workingStyle: 'Goal-oriented and iterative; breaks work into clearable milestones; thrives on visible progress.',
        team: 'engineering',
        domains: ['Full Stack Development', 'Game Development'],
        tasks: ['Feature Development', 'Game Feature Prototyping'],
        worksOn: ['game-development', 'web-development'],
    },
    {
        key: 'mukul', name: 'Mukul Goyal', role: 'UI/UX Lead / 2D Generalist',
        quote: "After work, you'll find me perfecting the art of doing nothing, mastering the fine balance between relaxation and creativity.",
        personality: 'Calm creative who treats rest as part of the design process; ideas arrive between the sessions, not during forced pushes. Balances minimalism with playfulness.',
        workingStyle: 'Visual-first and unhurried; communicates through mockups and mood boards before words.',
        team: 'creative',
        domains: ['UI/UX Design', '2D Design', 'Brand Identity'],
        tasks: ['Interface Design', 'Design Systems', 'Visual Identity'],
        worksOn: ['ui-ux-design', 'creative-consulting'],
    },
    {
        key: 'vikas', name: 'Vikas Dalvi', role: 'Lead Animator and 3D Generalist',
        quote: "After work, you can find me behind the camera, refining my skills and capturing moments that inspire my next animation work.",
        personality: 'Observational artist: photography feeds the animation work; collects real moments and replays them as motion. Craftsman temperament — quality over speed.',
        workingStyle: 'Storyboard-driven; communicates through reference reels and drafts; iterates visually.',
        team: 'creative',
        domains: ['3D Animation', 'Motion Design', 'Photography'],
        tasks: ['Animation Production', '3D Asset Creation', 'AR/VR Content'],
        worksOn: ['3d-pipeline-services', 'ar-vr-applications'],
    },
    {
        key: 'arman', name: 'Arman Siddiqui', role: 'Technical Content Lead',
        quote: "After work, you'll find me gaming or catching up with the latest tech trends. Staying on top of the innovations while enjoying some well-deserved downtime.",
        personality: 'Plugged-in communicator: tracks the frontier so the rest of the team does not have to, then translates it into words clients understand. Gamer; guards his downtime.',
        workingStyle: 'Clear, structured writing; explains like a developer-relations engineer; audience-first.',
        team: 'content',
        domains: ['Technical Content', 'Developer Communication', 'Technology Research'],
        tasks: ['Content Production', 'Documentation', 'Trend Research'],
        worksOn: ['creative-consulting'],
    },
    {
        key: 'jeetu', name: 'Jeetu (Subho Saha)', role: 'Office Support Staff',
        quote: "After work, you can find me arranging rewards and keeping our creative spirit fueled by ensuring we're caffeinated and well-fed!",
        personality: "The team's morale engine: anticipates needs before they are voiced, keeps the office running and the creative spirit fed — literally. The person everyone is glad to see.",
        workingStyle: 'Warm, practical, people-first; quietly reliable.',
        team: 'support',
        domains: ['Office Administration', 'Team Welfare'],
        tasks: ['Office Support', 'Supplies & Hospitality'],
        worksOn: [],
    },
];

const teams: Record<string, string> = {
    leadership: 'Totem Leadership & Ops',
    engineering: 'Totem Engineering',
    creative: 'Totem Creative',
    content: 'Totem Content',
    support: 'Totem Office',
};

// Service lines listed on toteminteractive.in/our-services
const services = [
    'Creative Consulting', 'UI/UX Design', '3D Pipeline Services', 'Game Development',
    'Web Development', 'iOS/Android App Development', 'AR/VR Applications', 'Software Development',
];

// Named product: Velocity is referenced as a Totem product in their own Terms & Conditions.
const products = ['Velocity Enterprise Platform'];

// Inferred working relationships between people (symmetric pairs).
const collaborations: Array<[string, string, string]> = [
    ['mukul', 'arjun', 'design-to-frontend handoff'],
    ['abhishek', 'nikhil', 'full stack development pairing'],
    ['mukul', 'vikas', 'creative direction across 2D and 3D'],
    ['arman', 'mukul', 'content and visual narrative'],
    ['shoeb', 'aakash', 'operations and company direction'],
];

// Inferred org policies — the standard operating rules of a client-services studio.
const policies: Array<[string, string]> = [
    ['pol-totem-confidentiality', 'Client work, assets and briefs are confidential'],
    ['pol-totem-brand', 'Brand consistency across every client deliverable'],
    ['pol-totem-deadlines', 'Committed deadlines are commitments, not estimates'],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function main() {
    const session = getSession();
    try {
        // Org + teams
        await session.run(
            `MERGE (o:Organization {id: $orgId})
             ON CREATE SET o.constitutionVersion = $cv
             SET o.name = 'Totem Interactive', o.website = $source,
                 o.location = 'Andheri West, Mumbai', o.email = 'info@toteminteractive.in',
                 o.source = $source, o.importedAt = $importedAt
             MERGE (td:Team {id: $defaultTeamId})
             ON CREATE SET td.constitutionVersion = $cv
             SET td.name = 'Totem Interactive (all hands)'
             MERGE (td)-[:BELONGS_TO]->(o)`,
            { orgId: ORG_ID, defaultTeamId: DEFAULT_TEAM_ID, cv: CONSTITUTION_VERSION, source: SOURCE, importedAt: IMPORTED_AT }
        );

        for (const [key, name] of Object.entries(teams)) {
            await session.run(
                `MATCH (o:Organization {id: $orgId})
                 MERGE (t:Team {id: $teamId})
                 ON CREATE SET t.constitutionVersion = $cv
                 SET t.name = $name
                 MERGE (t)-[:BELONGS_TO]->(o)`,
                { orgId: ORG_ID, teamId: `team-totem-${key}`, name, cv: CONSTITUTION_VERSION }
            );
        }

        // Org policies (inferred)
        for (const [polId, ruleText] of policies) {
            await session.run(
                `MATCH (o:Organization {id: $orgId})
                 MERGE (p:Policy {id: $polId})
                 ON CREATE SET p.constitutionVersion = $cv
                 SET p.ruleText = $ruleText, p.provenance = 'inferred'
                 MERGE (o)-[:ENFORCES {memoryState: 'Active', usageCount: 0}]->(p)`,
                { orgId: ORG_ID, polId, ruleText, cv: CONSTITUTION_VERSION }
            );
        }

        // Service lines + products as org-owned projects
        for (const svc of [...services, ...products]) {
            const isProduct = products.includes(svc);
            await session.run(
                `MATCH (o:Organization {id: $orgId})
                 MERGE (p:Project {id: $projId})
                 ON CREATE SET p.constitutionVersion = $cv
                 SET p.name = $name, p.kind = $kind, p.source = $source
                 MERGE (o)-[:OWNS {memoryState: 'Active', usageCount: 0}]->(p)`,
                {
                    orgId: ORG_ID, projId: `proj-totem-${slug(svc)}`, name: svc,
                    kind: isProduct ? 'product' : 'service-line',
                    source: isProduct ? 'toteminteractive.in terms-and-conditions' : SOURCE,
                    cv: CONSTITUTION_VERSION,
                }
            );
        }

        // People
        for (const p of people) {
            const userId = `user-totem-${p.key}`;
            await session.run(
                `MATCH (o:Organization {id: $orgId})
                 MATCH (td:Team {id: $defaultTeamId})
                 MATCH (tf:Team {id: $funcTeamId})
                 MERGE (u:User {id: $userId})
                 ON CREATE SET u.constitutionVersion = $cv
                 SET u.name = $name, u.role = $role, u.quote = $quote,
                     u.personality = $personality, u.personalityProvenance = 'inferred',
                     u.source = $source, u.importedAt = $importedAt
                 MERGE (u)-[:MEMBER_OF {memoryState: 'Active', usageCount: 0}]->(td)
                 MERGE (u)-[:MEMBER_OF {memoryState: 'Active', usageCount: 0}]->(tf)
                 MERGE (r:Role {id: $roleId})
                 ON CREATE SET r.constitutionVersion = $cv
                 SET r.name = $role
                 MERGE (u)-[:HAS_ROLE {memoryState: 'Active', usageCount: 0}]->(r)
                 MERGE (s:Style {id: $styleId})
                 ON CREATE SET s.constitutionVersion = $cv
                 SET s.formattingRules = $workingStyle, s.quote = $quote, s.provenance = 'inferred'
                 MERGE (u)-[:HAS_STYLE {memoryState: 'Active', usageCount: 0}]->(s)`,
                {
                    orgId: ORG_ID, defaultTeamId: DEFAULT_TEAM_ID,
                    funcTeamId: `team-totem-${p.team}`, userId,
                    roleId: `role-totem-${p.key}`, styleId: `style-totem-${p.key}`,
                    name: p.name, role: p.role, quote: p.quote,
                    personality: p.personality, workingStyle: p.workingStyle,
                    source: SOURCE, importedAt: IMPORTED_AT, cv: CONSTITUTION_VERSION,
                }
            );

            for (const d of p.domains) {
                await session.run(
                    `MATCH (u:User {id: $userId})
                     MERGE (d:Domain {id: $domainId})
                     ON CREATE SET d.constitutionVersion = $cv
                     SET d.name = $name, d.provenance = 'inferred'
                     MERGE (u)-[:EXPERT_IN {memoryState: 'Active', usageCount: 0}]->(d)`,
                    { userId, domainId: `domain-${slug(d)}`, name: d, cv: CONSTITUTION_VERSION }
                );
            }
            for (const t of p.tasks) {
                await session.run(
                    `MATCH (u:User {id: $userId})
                     MERGE (t:Task {id: $taskId})
                     ON CREATE SET t.constitutionVersion = $cv
                     SET t.name = $name, t.provenance = 'inferred'
                     MERGE (u)-[:PERFORMS {memoryState: 'Active', usageCount: 0}]->(t)`,
                    { userId, taskId: `task-totem-${p.key}-${slug(t)}`, name: t, cv: CONSTITUTION_VERSION }
                );
            }
            for (const proj of p.worksOn) {
                await session.run(
                    `MATCH (u:User {id: $userId})
                     MATCH (pr:Project {id: $projId})
                     MERGE (u)-[:WORKS_ON {memoryState: 'Active', usageCount: 0, provenance: 'inferred'}]->(pr)`,
                    { userId, projId: `proj-totem-${proj}` }
                );
            }
        }

        // Founder as manager: MANAGES the org; everyone else REPORTS_TO him.
        await session.run(
            `MATCH (f:User {id: 'user-totem-aakash'})
             MATCH (o:Organization {id: $orgId})
             MERGE (f)-[:MANAGES {memoryState: 'Active', usageCount: 0}]->(o)`,
            { orgId: ORG_ID }
        );
        for (const p of people.filter(x => !x.isFounder)) {
            await session.run(
                `MATCH (e:User {id: $empId})
                 MATCH (f:User {id: 'user-totem-aakash'})
                 MERGE (e)-[:REPORTS_TO {memoryState: 'Active', usageCount: 0, provenance: 'inferred'}]->(f)`,
                { empId: `user-totem-${p.key}` }
            );
        }

        // Inferred collaborations (one edge per pair, deterministic direction)
        for (const [a, b, context] of collaborations) {
            await session.run(
                `MATCH (ua:User {id: $aId})
                 MATCH (ub:User {id: $bId})
                 MERGE (ua)-[c:COLLABORATES_WITH]->(ub)
                 SET c.context = $context, c.provenance = 'inferred',
                     c.memoryState = 'Active', c.usageCount = coalesce(c.usageCount, 0)`,
                { aId: `user-totem-${a}`, bId: `user-totem-${b}`, context }
            );
        }

        // Verification readback
        const check = await session.run(
            `MATCH (o:Organization {id: $orgId})
             OPTIONAL MATCH (u:User)-[:MEMBER_OF]->(:Team)-[:BELONGS_TO]->(o)
             OPTIONAL MATCH (t:Team)-[:BELONGS_TO]->(o)
             OPTIONAL MATCH (o)-[:OWNS]->(p:Project)
             OPTIONAL MATCH (o)-[:ENFORCES]->(pol:Policy)
             OPTIONAL MATCH (u)-[w:WORKS_ON]->(:Project)
             OPTIONAL MATCH (:User)-[c:COLLABORATES_WITH]->(:User)
             RETURN o.name AS org, count(DISTINCT u) AS users, count(DISTINCT t) AS teams,
                    count(DISTINCT p) AS projects, count(DISTINCT pol) AS policies,
                    count(DISTINCT w) AS workAssignments, count(DISTINCT c) AS collaborations`,
            { orgId: ORG_ID }
        );
        const r = check.records[0];
        console.log(
            `Seeded: ${r.get('org')} — users=${r.get('users')} teams=${r.get('teams')} ` +
            `projects=${r.get('projects')} policies=${r.get('policies')} ` +
            `workAssignments=${r.get('workAssignments')} collaborations=${r.get('collaborations')}`
        );
    } finally {
        await session.close();
    }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
