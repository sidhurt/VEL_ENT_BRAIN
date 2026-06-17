import neo4j from 'neo4j-driver';
const d = neo4j.driver('neo4j+s://a8a7c224.databases.neo4j.io', neo4j.auth.basic('a8a7c224', 'IyItyTGvbjd6-K_gArxS8ailG59et7oJT84TwRFtVgE'));
const s = d.session();
s.run("MATCH (n {id: 'domain-emma-gov'}) RETURN labels(n), properties(n)").then(r => {
    console.log(JSON.stringify(r.records.map(rec => rec.toObject()), null, 2));
    s.close();
    d.close();
});
