const axios = require('axios');

async function test() {
    try {
        const res = await axios.post('https://vel-ent-brain-backend.vercel.app/api/enhance', {
            userId: 'user-emma',
            prompt: 'Draft a status update for Q4 Velocity Media.',
            executionMode: 'execute'
        });
        console.log("RESPONSE KEYS:", Object.keys(res.data));
        console.log("GENERATED OUTCOME:", res.data.generatedOutcome);
    } catch (e) {
        console.error(e.message);
    }
}
test();
