import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

if (!uri || !user || !password) {
  throw new Error(
    'Missing required Neo4j environment variables. Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD before starting the server.'
  );
}

export const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

export const getSession = () => driver.session();

export const closeDriver = () => driver.close();
