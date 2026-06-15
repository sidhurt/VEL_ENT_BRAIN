

async function runTests() {
    const API_URL = process.env.API_URL || 'http://localhost:3000/api';
    const USER_ID = 'user-jane-doe';

    console.log("==========================================");
    console.log("   UNIFIED BRAIN - MEMORY ENGINE TEST     ");
    console.log("==========================================\n");

    try {
        // Test 1: Check initial Memory Cards to see memory states
        console.log("1. Fetching Initial Memory Cards for Jane...");
        const cardsRes = await fetch(`${API_URL}/cards/${USER_ID}`);
        if (!cardsRes.ok) throw new Error("Server not running or error fetching cards");
        const cards = await cardsRes.json();
        
        console.log("   Initial Projects State:");
        cards.projects.forEach((p: any) => {
            console.log(`     - ${p.data.name} (State: ${p.data.memoryState})`);
        });

        // Test 2: Trigger Enhance with an intent that matches the 'Archived' project
        console.log("\n------------------------------------------");
        console.log("2. Testing Context Assembly & Reactivation");
        console.log("   Prompt: 'Write a draft for the tech earnings reports'");
        
        const enhanceRes = await fetch(`${API_URL}/enhance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: USER_ID,
                prompt: 'Write a draft for the tech earnings reports'
            })
        });
        const enhanceData = await enhanceRes.json();
        
        console.log("\n   Explainability Receipt (Why contexts were selected):");
        enhanceData.explainabilityReceipt.forEach((receipt: any) => {
            console.log(`   -> [${receipt.node.type}] ${receipt.node.content}`);
            console.log(`      Reasons: ${receipt.reasons.join(', ')} (Confidence: ${receipt.confidence})`);
        });

        // Test 3: Check Memory Cards again to see if 'Q1 Tech Earnings' reactivated
        console.log("\n------------------------------------------");
        console.log("3. Fetching Memory Cards Post-Enhance to Verify Reactivation...");
        const cardsRes2 = await fetch(`${API_URL}/cards/${USER_ID}`);
        const cards2 = await cardsRes2.json();
        
        console.log("   Updated Projects State:");
        cards2.projects.forEach((p: any) => {
            console.log(`     - ${p.data.name} (State: ${p.data.memoryState})`);
        });

        // Test 4: Simulate Time Passing (Decay)
        console.log("\n------------------------------------------");
        console.log("4. Simulating 40 Days of Time Passing (Memory Decay)...");
        await fetch(`${API_URL}/simulate-time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, days: 40 })
        });
        console.log("   Time simulation complete.");

        // Test 5: Check Memory Cards Post-Decay
        console.log("\n------------------------------------------");
        console.log("5. Fetching Memory Cards Post-Decay...");
        const cardsRes3 = await fetch(`${API_URL}/cards/${USER_ID}`);
        const cards3 = await cardsRes3.json();
        
        console.log("   Final Projects State:");
        cards3.projects.forEach((p: any) => {
            console.log(`     - ${p.data.name} (State: ${p.data.memoryState})`);
        });

        console.log("\n==========================================");
        console.log("                TEST COMPLETE               ");
        console.log("==========================================");

    } catch (err: any) {
        console.error("Test Error:", err.message);
        console.log("Make sure Docker Desktop is running, Neo4j is up via docker-compose, and 'npm run dev' is running in another terminal.");
    }
}

runTests();
