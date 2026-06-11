import fs from 'fs';
import path from 'path';
import { getSession, closeDriver } from './db';

const seedDatabase = async () => {
    const session = getSession();
    try {
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
