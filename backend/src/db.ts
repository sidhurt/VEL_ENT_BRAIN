import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.NEO4J_URI || 'neo4j+s://a8a7c224.databases.neo4j.io';
const user = process.env.NEO4J_USER || 'a8a7c224';
const password = process.env.NEO4J_PASSWORD || 'IyItyTGvbjd6-K_gArxS8ailG59et7oJT84TwRFtVgE';

export const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

export const getSession = () => driver.session();

export const closeDriver = () => driver.close();
