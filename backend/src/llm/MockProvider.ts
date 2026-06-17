import { AIProvider } from './AIProvider';

export class MockProvider implements AIProvider {
    async generate(systemPrompt: string, userPrompt: string): Promise<{ text: string; metadata: any }> {
        const startTime = Date.now();
        
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 800));

        let generatedText = "Default Mock Response.";

        const promptLower = userPrompt.toLowerCase();
        
        // Demo 1: Context Tax (Architecture proposal)
        if (promptLower.includes("architecture proposal")) {
            generatedText = `## Unified Brain Architecture Proposal

**Executive Summary**
Based on my context as an Enterprise Architect, here is the proposal for the Unified Brain implementation, deeply integrated with our AWS infrastructure.

**1. Core Components**
- Context Assembly Engine
- Neo4j Graph Database
- API Gateway (AWS API Gateway)
- Compute (AWS Lambda or ECS)

**2. Integration Points**
- DMS Integration
- SAP Integration

**3. Execution Strategy**
We will focus on providing a secure, governed context layer that sits between the end user and our downstream AI providers, ensuring absolute compliance with all enterprise standards.`;
        } 
        // Demo 2: Governance Override (Sarcastic update)
        else if (promptLower.includes("sarcastic") || promptLower.includes("update")) {
            // Check if professional policy is in system prompt
            if (systemPrompt.toLowerCase().includes("professional communication")) {
                generatedText = `Subject: Client Project Update

Dear Client,

I am writing to provide a formal update on the status of our current project engagement. The team is making consistent progress against the established milestones.

Key Updates:
- Deliverable A is currently in the review phase.
- Deliverable B remains on track for the scheduled date.

We remain committed to ensuring the highest quality of delivery and will continue to monitor the timeline closely. Please reach out if you have any questions or require further details.

Best regards,
Michael T.
Client Success Director`;
            } else {
                generatedText = "Oh fantastic, another client update. Because we definitely haven't spent the entire week doing absolutely everything requested. The project is *fine*, milestones are *sort of* being hit, and we'll probably deliver something eventually. Have a great day!";
            }
        }
        else {
            // Generic mock response
            generatedText = `Based on the provided context and the prompt "${userPrompt}", here is the generated output. \n\nThe system has correctly consumed the enterprise context and generated a response that adheres to any enforced policies.`;
        }

        const executionTime = Date.now() - startTime;

        return {
            text: generatedText,
            metadata: {
                model: 'mock-model-v1',
                provider: 'Mock',
                executionTime,
                fallbackUsed: true
            }
        };
    }
}
