import assert from 'node:assert/strict';
import { isInt } from 'neo4j-driver';
import { BACKFILL_BATCH_QUERY, loadNextBackfillBatch } from './backfillClientEmbeddingsCore';
import { rankFactAndLearningItems, type RetrievalItem } from './clientBrainRetrieval';

const embeddingModel = 'text-embedding-3-small';

const semanticRankingUsesMeaningRatherThanKeywordOverlap = async () => {
    const facts: RetrievalItem[] = [
        {
            id: 'fact-holiday-presentation',
            title: 'Holiday presentation guidance',
            content: 'Use celebratory wrapping and a limited-edition visual system.',
            usageCount: 0,
            embedding: [1, 0],
            embeddingModel,
        },
        {
            id: 'fact-loyalty-offer',
            title: 'Loyalty offer guidance',
            content: 'Prioritize repeat-purchase incentives for existing customers.',
            usageCount: 0,
            embedding: [0, 1],
            embeddingModel,
        },
    ];

    const result = await rankFactAndLearningItems(
        facts,
        [],
        'Create a festival box campaign',
        embeddingModel,
        async () => [0.98, 0.02],
    );

    assert.equal(result.retrieval, 'semantic');
    assert.equal(result.facts[0].item.id, 'fact-holiday-presentation');
    assert.equal(result.facts[0].reason, 'semantic match');
};

const missingEmbeddingsUseTheCompleteKeywordFallback = async () => {
    const facts: RetrievalItem[] = [
        {
            id: 'fact-festive',
            title: 'Festive packaging direction',
            content: 'Use celebratory gift boxes for the seasonal launch.',
            usageCount: 0,
        },
        {
            id: 'fact-loyalty',
            title: 'Loyalty program direction',
            content: 'Offer rewards for repeat purchases.',
            usageCount: 0,
        },
    ];

    const result = await rankFactAndLearningItems(
        facts,
        [],
        'Draft festive packaging copy',
        embeddingModel,
        async () => {
            throw new Error('Prompt embedding should not be requested before backfill');
        },
    );

    assert.equal(result.retrieval, 'keyword-fallback');
    assert.equal(result.facts.length, 2);
    assert.equal(result.facts[0].item.id, 'fact-festive');
    assert.equal(result.facts[0].reason, 'matched request');
};

const backfillUsesAnIntegerLimitParameter = async () => {
    let query = '';
    let parameters: any;
    const session = {
        run: async (receivedQuery: string, receivedParameters: any) => {
            query = receivedQuery;
            parameters = receivedParameters;
            return { records: [] };
        },
    };

    await loadNextBackfillBatch(session, 50, embeddingModel);

    assert.equal(query, BACKFILL_BATCH_QUERY);
    assert.match(query, /LIMIT \$batchSize/);
    assert.equal(isInt(parameters.batchSize), true);
    assert.equal(parameters.batchSize.toNumber(), 50);
    assert.equal(parameters.embeddingModel, embeddingModel);
};

const run = async () => {
    await semanticRankingUsesMeaningRatherThanKeywordOverlap();
    await missingEmbeddingsUseTheCompleteKeywordFallback();
    await backfillUsesAnIntegerLimitParameter();
    console.log('Client Brain semantic-retrieval behavior tests passed.');
};

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
