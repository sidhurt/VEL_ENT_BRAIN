import OpenAI from 'openai';
import { AIProvider } from './AIProvider';

export class OpenAIProvider implements AIProvider {
    private openai: OpenAI | null = null;
    private model: string;

    constructor(model: string = 'gpt-4o-mini') {
        this.model = model;
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        }
    }

    async generate(systemPrompt: string, userPrompt: string): Promise<{ text: string; metadata: any }> {
        if (!this.openai) {
            throw new Error('OPENAI_API_KEY not configured');
        }

        const startTime = Date.now();
        const response = await this.openai.chat.completions.create({
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        });
        const executionTime = Date.now() - startTime;

        return {
            text: response.choices[0].message.content || '',
            metadata: {
                model: response.model,
                provider: 'OpenAI',
                executionTime,
                fallbackUsed: false
            }
        };
    }
}
