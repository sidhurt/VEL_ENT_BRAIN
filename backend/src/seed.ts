import fs from 'fs';
import path from 'path';
import { getSession, closeDriver } from './db';

// neo4j-init.cypher begins with `MATCH (n) DETACH DELETE n` — it WIPES the
// database before seeding. Running it against a database with real data
// destroys everything (this happened once; restored from an Aura snapshot).
// Guard: refuse to run against a non-empty database unless explicitly forced.
const seedDatabase = async () => {
    const session = getSession();
    try {
        const countRes = await session.run('MATCH (n) RETURN count(n) as c');
        const nodeCount = countRes.records[0].get('c').toNumber();

        if (nodeCount > 0 && process.env.SEED_ALLOW_WIPE !== 'true') {
            console.error(
                `\nABORTED: database is not empty (${nodeCount} nodes).\n` +
                `Seeding starts by DELETING EVERYTHING in the database.\n` +
                `If you truly want to wipe and reseed, run:\n` +
                `  SEED_ALLOW_WIPE=true npm run seed   (bash)\n` +
                `  $env:SEED_ALLOW_WIPE='true'; npm run seed   (PowerShell)\n`
            );
            return;
        }

        const cypherFile = path.join(__dirname, '../../neo4j-init.cypher');
        const fileContent = fs.readFileSync(cypherFile, 'utf-8');
        // Remove comments before splitting
        const cleanContent = fileContent.replace(/\/\/.*$/gm, '');
        const cypherQueries = cleanContent
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0);

        for (const query of cypherQueries) {
            console.log(`Executing: ${query.substring(0, 50)}...`);
            await session.run(query);
        }
        console.log('Database seeding complete!');
    } catch (err) {
        console.error('Seeding error:', err);
    } finally {
        await session.close();
        await closeDriver();
    }
};

seedDatabase();
