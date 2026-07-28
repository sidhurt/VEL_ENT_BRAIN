/**
 * Seed one fully-formed sample Client Brain into the Totem org.
 *
 * Purpose: a first-login demo surface. Without at least one client brain the
 * product opens empty and the core loop (walled assembly → in-voice, rule-
 * respecting generation → receipt) is invisible. The client is fictional and
 * labelled as a sample so nobody mistakes it for a real account.
 *
 * Idempotent: exits early if the sample client already has active knowledge.
 */
import 'dotenv/config';
import {
    createClient, listClients, proposeKnowledge, getReviewQueue, reviewKnowledge,
    type KnowledgeItem,
} from './clientBrain';

const PRINCIPAL = 'user-totem-aakash'; // seeded member of the Totem org
const CLIENT_NAME = 'Meridian Foods (Sample)';
const SOURCE = 'sample-brand-guidelines.pdf';

const items: KnowledgeItem[] = [
    {
        kind: 'voice',
        title: 'Witty Hinglish, never formal',
        content: 'Speaks in playful Hinglish — Hindi warmth with English structure. Short punchy lines, everyday humour, never corporate or preachy. Writes like a friend recommending a snack, not a brand announcing one.',
        confidence: 95,
        evidence: 'Brand voice: playful Hinglish, conversational, never formal.',
    },
    {
        kind: 'rule',
        title: 'No health or nutrition claims',
        content: 'Never claim the product is healthy, low-fat, sugar-free, immunity-boosting or good for weight loss. No nutritional benefit may be implied, even indirectly. This is a hard legal constraint.',
        confidence: 99,
        evidence: 'Health claims are strictly forbidden in all consumer communication.',
    },
    {
        kind: 'rule',
        title: 'Never name competitors',
        content: 'No competitor brand may be named, referenced, or alluded to in any creative. Comparative advertising is prohibited without legal sign-off.',
        confidence: 98,
        evidence: 'Competitor mentions prohibited across all channels.',
    },
    {
        kind: 'rule',
        title: 'Festive creatives need brand approval',
        content: 'Any campaign tied to a religious or national festival must be reviewed by the brand team before publishing. No exceptions for organic social.',
        confidence: 90,
        evidence: 'Festive communication requires prior brand approval.',
    },
    {
        kind: 'fact',
        title: 'Hero SKU is the 40g masala pack',
        content: 'The 40g masala variant drives the majority of retail volume and anchors all campaign work. Priced for impulse purchase at kirana counters.',
        confidence: 92,
        evidence: 'Hero SKU: 40g masala pack, primary volume driver.',
    },
    {
        kind: 'fact',
        title: 'Core audience is 18–28 urban India',
        content: 'Primary audience is 18–28 year olds in tier-1 and tier-2 Indian cities: students and early-career professionals, mobile-first, heavy Instagram and YouTube consumption.',
        confidence: 94,
        evidence: 'Target audience: urban Indian youth, 18-28.',
    },
    {
        kind: 'fact',
        title: 'Distribution is kirana-led',
        content: 'Roughly three quarters of sales come through neighbourhood kirana stores rather than modern trade or e-commerce. Creative should reflect everyday local availability.',
        confidence: 88,
        evidence: 'Kirana channel dominates distribution.',
    },
    {
        kind: 'learning',
        title: 'Posts after 9pm outperform',
        content: 'Social posts published between 9pm and 11pm consistently outperform daytime slots on engagement — the audience snacks and scrolls late. Schedule launches accordingly.',
        confidence: 85,
        evidence: 'Engagement peaks 9-11pm across previous campaigns.',
    },
    {
        kind: 'learning',
        title: 'Meme formats beat polished films',
        content: 'Low-fi meme-style creatives have consistently outperformed high-production video on cost per engagement. Polish is not the win condition; timing and relatability are.',
        confidence: 82,
        evidence: 'Meme-format creatives delivered better CPE than produced films.',
    },
];

async function main() {
    const existing = await listClients(PRINCIPAL);
    const already = existing.find(c => c.name === CLIENT_NAME);
    if (already && Number(already.activeKnowledge ?? 0) > 0) {
        console.log(`Sample client already populated (${already.id}) — nothing to do.`);
        return;
    }

    const client = already ?? await createClient(PRINCIPAL, CLIENT_NAME, 'FMCG / Packaged Foods');
    const clientId = (client as any).id ?? (client as any).clientId;
    console.log(`Client: ${clientId}`);

    await proposeKnowledge(PRINCIPAL, clientId, items, SOURCE);

    const queue = await getReviewQueue(PRINCIPAL, clientId);
    console.log(`Proposed ${queue.length} items — approving all.`);
    let approved = 0;
    for (const q of queue as any[]) {
        await reviewKnowledge(PRINCIPAL, q.id, 'approve');
        approved++;
    }

    const after = await listClients(PRINCIPAL);
    const row = after.find((c: any) => c.id === clientId);
    console.log(`Approved ${approved}. Client row: ${JSON.stringify(row)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
