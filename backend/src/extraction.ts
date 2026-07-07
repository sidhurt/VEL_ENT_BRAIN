import { OpenAIProvider } from './llm/OpenAIProvider';
import { KnowledgeItem, KnowledgeKind } from './clientBrain';

// ============================================================================
// EXTRACTION ENGINE — turns raw client documents (brand decks, campaign
// reports, briefs) into structured, reviewable Client Brain candidates.
// This is the product's quality bottleneck: if week-one extractions feel like
// generic filler, account leads never come back. The system prompt below is
// engineered specifically against that failure mode.
// ============================================================================

const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = (clientName: string, sourceName: string) => `You are the knowledge-extraction engine of a marketing agency's Client Brain. You are reading a document ("${sourceName}") about the client "${clientName}". Extract ONLY knowledge that is specific to this client and useful for producing future work for them.

THE SPECIFICITY TEST (apply to every candidate before including it):
"Would this statement be WRONG, or at least useless, if applied to a different brand?"
If the statement could apply to almost any brand — discard it. Examples of items you must DISCARD: "post consistently", "engage with the audience", "quality content matters", "maintain brand consistency". Examples of items you must KEEP: "never uses Hindi puns — English-only brand voice", "target buyer is tier-2 city parents aged 28–40", "CEO must approve any post mentioning pricing", "carousel posts outperformed reels 3:1 in the March campaign".

CLASSIFY each item as exactly one kind:
- "voice" — how the brand speaks: tone, vocabulary, language mix, formality, humor, words/phrases they use or ban. These will be injected into every piece of generated content.
- "rule" — hard constraints: legal/compliance requirements, approval workflows, things the client has explicitly forbidden or mandated, competitor mentions policy, claims that need substantiation.
- "fact" — durable client facts: audience/segments, products and pricing, platforms and handles, key people and roles, competitors, brand assets, market positioning.
- "learning" — evidence from past work: what performed or failed, with the campaign or period it comes from. A learning without its evidence is a "fact" at best; prefer keeping the evidence in the content.

FOR EACH ITEM return:
- "kind": voice | rule | fact | learning
- "title": ≤ 60 characters, specific (a reviewer must understand it from the title alone in a list)
- "content": ≤ 350 characters, self-contained and actionable — written so it can be dropped directly into an AI prompt without the source document
- "confidence": 0–100. 90+ = stated explicitly in the document. 70–89 = strongly implied. Below 70 = do not include the item at all.
- "evidence": a short verbatim quote (≤ 25 words) from the document that supports the item

RULES:
- Output a raw JSON array only. No markdown fences, no commentary.
- 0 items is a valid answer for a document with no client-specific knowledge. Never pad.
- Do not merge unrelated facts into one item; one reviewable claim per item.
- Do not editorialize or improve the client's strategy; extract what the document says.`;

const VALID_KINDS: KnowledgeKind[] = ['voice', 'rule', 'fact', 'learning'];

const parseItems = (raw: string): KnowledgeItem[] => {
    let text = raw.trim();
    if (text.startsWith('```')) text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    // Tolerate leading prose before the array
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end < start) return [];
    let parsed: any;
    try {
        parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
        .filter((i: any) =>
            i && VALID_KINDS.includes(i.kind) &&
            typeof i.title === 'string' && i.title.trim() &&
            typeof i.content === 'string' && i.content.trim() &&
            typeof i.confidence === 'number' && i.confidence >= 70
        )
        .map((i: any) => ({
            kind: i.kind as KnowledgeKind,
            title: String(i.title).trim().slice(0, 120),
            content: String(i.content).trim().slice(0, 500),
            confidence: Math.min(100, Math.round(i.confidence)),
            evidence: i.evidence ? String(i.evidence).slice(0, 300) : undefined,
        }));
};

// Long documents are processed in overlapping chunks; items are deduplicated
// across chunks by normalized title.
const chunkText = (text: string, maxLen = 9000, overlap = 600): string[] => {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let pos = 0;
    while (pos < text.length) {
        chunks.push(text.slice(pos, pos + maxLen));
        pos += maxLen - overlap;
    }
    return chunks;
};

const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const extractClientKnowledge = async (
    text: string,
    clientName: string,
    sourceName: string
): Promise<{ items: KnowledgeItem[]; chunks: number; model: string }> => {
    const provider = new OpenAIProvider(EXTRACTION_MODEL);
    const chunks = chunkText(text);
    const seen = new Map<string, KnowledgeItem>();

    for (const chunk of chunks) {
        const result = await provider.generate(SYSTEM_PROMPT(clientName, sourceName), chunk);
        for (const item of parseItems(result.text)) {
            const key = `${item.kind}:${normalizeTitle(item.title)}`;
            const existing = seen.get(key);
            if (!existing || (item.confidence ?? 0) > (existing.confidence ?? 0)) {
                seen.set(key, item);
            }
        }
    }

    return { items: Array.from(seen.values()), chunks: chunks.length, model: EXTRACTION_MODEL };
};
