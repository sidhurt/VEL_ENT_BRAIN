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
}

export const llmService = new LLMService();
