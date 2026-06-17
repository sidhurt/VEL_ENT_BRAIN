import { OpenAIProvider } from './llm/OpenAIProvider';
import { MockProvider } from './llm/MockProvider';
import { AIProvider } from './llm/AIProvider';

export class LLMService {
    private primaryProvider: AIProvider;
    private fallbackProvider: AIProvider;

    constructor() {
        this.primaryProvider = new OpenAIProvider('gpt-4o-mini');
        this.fallbackProvider = new MockProvider();
    }

    private translateContextPack(contextPack: any): string {
        let narrative = `[ENTERPRISE CONTEXT BRIEFING]\n\n`;

        if (contextPack.identityContext) {
            const id = contextPack.identityContext;
            if (id.name) {
                narrative += `The user is ${id.name}.\n`;
            }
            if (id.roles && id.roles.length > 0) {
                narrative += `Role(s): ${id.roles.join(', ')}\n`;
            }
            if (id.domains && id.domains.length > 0) {
                narrative += `Relevant expertise:\n${id.domains.map((d: string) => `- ${d}`).join('\n')}\n`;
            }
            narrative += `\n`;
        }

        if (contextPack.projectContext && contextPack.projectContext.length > 0) {
            narrative += `Current active project(s):\n${contextPack.projectContext.map((p: any) => `- ${p.name}`).join('\n')}\n\n`;
        }

        if (contextPack.taskContext && contextPack.taskContext.length > 0) {
            narrative += `Current active task(s):\n${contextPack.taskContext.map((t: any) => `- ${t.name}`).join('\n')}\n\n`;
        }

        if (contextPack.policyContext && contextPack.policyContext.length > 0) {
            narrative += `Mandatory enterprise policies:\n${contextPack.policyContext.map((p: any) => `- ${p.ruleText}`).join('\n')}\n`;
            narrative += `These constraints are mandatory and override user preferences.\n\n`;
        }

        if (contextPack.styleContext && contextPack.styleContext.length > 0) {
            narrative += `Preferred communication style(s):\n${contextPack.styleContext.map((s: string) => `- ${s}`).join('\n')}\n\n`;
        }

        return narrative;
    }

    async execute(contextPack: any, userPrompt: string): Promise<{ generatedOutcome: string; executionMetadata: any }> {
        const systemPrompt = this.translateContextPack(contextPack);

        try {
            // Attempt to use primary provider
            const result = await this.primaryProvider.generate(systemPrompt, userPrompt);
            return {
                generatedOutcome: result.text,
                executionMetadata: result.metadata
            };
        } catch (error) {
            console.error('Primary LLM provider failed, falling back to MockProvider:', error);
            // Fallback to mock provider
            const result = await this.fallbackProvider.generate(systemPrompt, userPrompt);
            return {
                generatedOutcome: result.text,
                executionMetadata: result.metadata
            };
        }
    }

    async extractCandidateEntities(prompt: string): Promise<{ type: string, name: string, confidence: number }[]> {
        const systemPrompt = `You are an Information Extraction engine. Analyze the user's prompt. Does it mention any specific new Projects, Tasks, or Domains of expertise they are working on? 
Return a JSON array of objects with keys: "type" (must be "Project", "Task", or "Domain"), "name", and "confidence" (0-100). If none, return []. Do not include markdown formatting like \`\`\`json. Return only raw JSON.`;
        
        try {
            const result = await this.primaryProvider.generate(systemPrompt, prompt);
            let text = result.text.trim();
            if (text.startsWith('\`\`\`json')) text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            if (text.startsWith('\`\`\`')) text = text.replace(/\`\`\`/g, '').trim();
            
            const entities = JSON.parse(text);
            if (Array.isArray(entities)) {
                return entities.filter(e => e.type && e.name && typeof e.confidence === 'number' && e.confidence >= 70);
            }
        } catch (e) {
            console.error('Extraction failed or not JSON:', e);
            // Deterministic mock extraction for Demo
            if (prompt.toLowerCase().includes('q4 velocity media')) {
                return [{ type: 'Project', name: 'Q4 Velocity Media', confidence: 91 }];
            }
        }
        return [];
    }
}

export const llmService = new LLMService();
