import { getSession } from './db';
import { createEmbeddings } from './clientBrain';
import { loadNextBackfillBatch } from './backfillClientEmbeddingsCore';

const parsedBatchSize = Number(process.env.EMBEDDING_BACKFILL_BATCH_SIZE || 50);
const BATCH_SIZE = Number.isInteger(parsedBatchSize) && parsedBatchSize > 0
    ? Math.min(parsedBatchSize, 500)
    : 50;

const run = async () => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required to backfill client embeddings');
    }

    const session = getSession();
    let embedded = 0;
    try {
        for (;;) {
            const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
            const batch = await loadNextBackfillBatch(session, BATCH_SIZE, embeddingModel);
            if (batch.length === 0) break;

            const embeddings = await createEmbeddings(
                batch.map(item => `${item.title}\n\n${item.content}`)
            );

            for (let index = 0; index < batch.length; index += 1) {
                await session.run(`
                    MATCH (k:ClientKnowledge {id: $knowledgeId, status: 'active'})
                    WHERE k.embedding IS NULL OR k.embeddingModel <> $embeddingModel
                    SET k.embedding = $embedding,
                        k.embeddingModel = $embeddingModel,
                        k.embeddedAt = timestamp()
                `, {
                    knowledgeId: batch[index].id,
                    embedding: embeddings[index],
                    embeddingModel,
                });
                embedded += 1;
            }
            console.log(`Embedded ${embedded} client knowledge item${embedded === 1 ? '' : 's'}...`);
        }
    } finally {
        await session.close();
    }

    console.log(`Client-knowledge embedding backfill complete: ${embedded} item${embedded === 1 ? '' : 's'} embedded.`);
};

run().catch(err => {
    console.error(`Client-knowledge embedding backfill failed: ${err.message}`);
    process.exitCode = 1;
});
