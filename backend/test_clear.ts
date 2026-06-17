import neo4j from 'neo4j-driver';
const d = neo4j.driver('neo4j+s://a8a7c224.databases.neo4j.io', neo4j.auth.basic('a8a7c224', 'IyItyTGvbjd6-K_gArxS8ailG59et7oJT84TwRFtVgE'));
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
