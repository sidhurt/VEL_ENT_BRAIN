import neo4j from 'neo4j-driver';
import 'dotenv/config';

const uri = process.env.NEO4J_URI!;
const user = process.env.NEO4J_USER!;
const password = process.env.NEO4J_PASSWORD!;

const d = neo4j.driver(uri, neo4j.auth.basic(user, password));
const s = d.session();
const clearQuery = `
    MATCH (n) WHERE n.id IN [
        'org-velocity-media', 'team-velocity-hq', 'pol-prof', 'pol-nospec', 'pol-conf', 
        'user-emma', 'user-siddharth', 'user-michael', 
        'role-emma', 'role-siddharth', 'role-michael', 
        'proj-emma', 'proj-siddharth', 'proj-siddharth-ub', 'proj-siddharth-dms', 'proj-michael', 
        'style-emma', 'style-siddharth', 'style-michael',
        'domain-emma-gov', 'domain-emma-marketing', 'task-emma-review',
        'domain-siddharth-aws', 'domain-siddharth-sap', 'task-siddharth-arch', 
        'domain-michael', 'domain-michael-research', 'domain-michael-sales', 'task-michael-qbr'
    ]
    DETACH DELETE n
`;
s.run(clearQuery).then(r => {
    console.log("Cleared.");
    s.run("MATCH (n {id: 'domain-emma-gov'}) RETURN labels(n), properties(n)").then(r2 => {
        console.log(JSON.stringify(r2.records.map(rec => rec.toObject()), null, 2));
        s.close();
        d.close();
    });
});
