import { int } from 'neo4j-driver';

export type KnowledgeRow = { id: string; title: string; content: string };

export const BACKFILL_BATCH_QUERY = `
    MATCH (:Client)-[:HAS_KNOWLEDGE]->(k:ClientKnowledge {status: 'active'})
    WHERE k.kind IN ['fact', 'learning']
      AND (k.embedding IS NULL OR k.embeddingModel <> $embeddingModel)
    RETURN k.id as id, k.title as title, k.content as content
    ORDER BY k.reviewedAt ASC, k.id ASC
    LIMIT $batchSize
`;

export const backfillBatchParameters = (batchSize: number, embeddingModel: string) => ({
    // The driver packs plain JavaScript numbers as floats, which Neo4j rejects in LIMIT.
    batchSize: int(batchSize),
    embeddingModel,
});

export const loadNextBackfillBatch = async (session: any, batchSize: number, embeddingModel: string): Promise<KnowledgeRow[]> => {
    const result = await session.run(BACKFILL_BATCH_QUERY, backfillBatchParameters(batchSize, embeddingModel));
    return result.records.map((record: any) => ({
        id: record.get('id'),
        title: record.get('title'),
        content: record.get('content'),
    }));
};
