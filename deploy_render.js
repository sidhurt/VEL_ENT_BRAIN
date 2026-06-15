const https = require('https');

const token = 'rnd_XIPZruvE696orVD2sh3fVViuJ0DA';

const getOwnerId = () => {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'api.render.com',
      path: '/v1/owners',
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.length > 0) resolve(json[0].owner.id);
        else reject('No owner found');
      });
    }).on('error', reject);
  });
};

const createService = (ownerId) => {
  const data = JSON.stringify({
    type: 'web_service',
    name: 'unified-brain-backend',
    ownerId: ownerId,
    repo: 'https://github.com/sidhurt/VEL_ENT_BRAIN',
    autoDeploy: 'yes',
    branch: 'master',
    rootDir: 'backend',
    envVars: [
      { key: 'NEO4J_URI', value: 'neo4j+s://a8a7c224.databases.neo4j.io' },
      { key: 'NEO4J_USER', value: 'a8a7c224' },
      { key: 'NEO4J_PASSWORD', value: 'IyItyTGvbjd6-K_gArxS8ailG59et7oJT84TwRFtVgE' }
    ],
    serviceDetails: {
      env: 'node',
      envSpecificDetails: {
        buildCommand: 'npm install && npm run build',
        startCommand: 'npm run start'
      },
      healthCheckPath: '/api/health',
      plan: 'free',
      region: 'oregon'
    }
  });

  const options = {
    hostname: 'api.render.com',
    port: 443,
    path: '/v1/services',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, res => {
    let body = '';
    res.on('data', d => { body += d; });
    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      console.log(body);
    });
  });

  req.on('error', console.error);
  req.write(data);
  req.end();
};

getOwnerId().then(createService).catch(console.error);
