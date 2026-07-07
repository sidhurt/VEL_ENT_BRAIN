import neo4j from 'neo4j-driver';
import 'dotenv/config';

const uri = process.env.NEO4J_URI!;
const user = process.env.NEO4J_USER!;
const password = process.env.NEO4J_PASSWORD!;

const d = neo4j.driver(uri, neo4j.auth.basic(user, password));
const s = d.session();
s.run("MATCH (n {id: 'domain-emma-gov'}) RETURN labels(n), properties(n)").then(r => {
    console.log(JSON.stringify(r.records.map(rec => rec.toObject()), null, 2));
    s.close();
    d.close();
});
