export interface RetrievalItem {
    id: string;
    title: string;
    content: string;
    usageCount: number;
    embedding?: unknown;
    embeddingModel?: string;
    [key: string]: unknown;
}

export interface RankedItem<T extends RetrievalItem = RetrievalItem> {
    item: T;
    score: number;
    reason: string;
}

export type RetrievalMode = 'semantic' | 'keyword-fallback';

export const isEmbedding = (value: unknown): value is number[] =>
    Array.isArray(value) && value.length > 0 && value.every(n => typeof n === 'number' && Number.isFinite(n));

export const cosineSimilarity = (left: number[], right: number[]) => {
    if (left.length !== right.length || left.length === 0) {
        throw new Error('Embedding dimensions do not match');
    }
    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;
    for (let i = 0; i < left.length; i += 1) {
        dot += left[i] * right[i];
        leftMagnitude += left[i] * left[i];
        rightMagnitude += right[i] * right[i];
    }
    if (leftMagnitude === 0 || rightMagnitude === 0) {
        throw new Error('Embedding magnitude must be non-zero');
    }
    return dot / Math.sqrt(leftMagnitude * rightMagnitude);
};

export const rankItemsByKeyword = <T extends RetrievalItem>(items: T[], prompt: string, cap: number): RankedItem<T>[] => {
    const promptLower = prompt.toLowerCase();
    return items
        .map(item => {
            const words = `${item.title} ${item.content}`.toLowerCase().split(/\s+/).filter(word => word.length > 3);
            const matches = words.filter(word => promptLower.includes(word)).length;
            const score = matches * 10 + Number(item.usageCount || 0);
            return { item, score, reason: matches > 0 ? 'matched request' : 'frequently used' };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, cap);
};

export const rankItemsByEmbedding = <T extends RetrievalItem>(items: T[], promptEmbedding: number[], cap: number): RankedItem<T>[] =>
    items
        .map(item => {
            if (!isEmbedding(item.embedding)) throw new Error(`Knowledge item ${item.id} has no valid embedding`);
            const similarity = cosineSimilarity(promptEmbedding, item.embedding);
            const usageBoost = Math.min(Math.log1p(Number(item.usageCount || 0)) * 0.02, 0.1);
            return {
                item,
                score: similarity + usageBoost,
                reason: usageBoost > 0 ? 'semantic match, reinforced by prior use' : 'semantic match',
            };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, cap);

export const rankFactAndLearningItems = async <T extends RetrievalItem>(
    facts: T[],
    learnings: T[],
    prompt: string,
    embeddingModel: string,
    embedPrompt: (prompt: string) => Promise<number[]>,
) => {
    const candidates = [...facts, ...learnings];
    if (candidates.length === 0) {
        return { facts: [] as RankedItem<T>[], learnings: [] as RankedItem<T>[], retrieval: 'semantic' as RetrievalMode };
    }

    try {
        if (candidates.some(item => !isEmbedding(item.embedding) || item.embeddingModel !== embeddingModel)) {
            throw new Error('One or more active knowledge items await embedding backfill');
        }
        const promptEmbedding = await embedPrompt(prompt);
        if (!isEmbedding(promptEmbedding)) throw new Error('Prompt embedding is invalid');
        return {
            facts: rankItemsByEmbedding(facts, promptEmbedding, 6),
            learnings: rankItemsByEmbedding(learnings, promptEmbedding, 4),
            retrieval: 'semantic' as RetrievalMode,
        };
    } catch (error: any) {
        return {
            facts: rankItemsByKeyword(facts, prompt, 6),
            learnings: rankItemsByKeyword(learnings, prompt, 4),
            retrieval: 'keyword-fallback' as RetrievalMode,
            fallbackReason: error.message,
        };
    }
};
