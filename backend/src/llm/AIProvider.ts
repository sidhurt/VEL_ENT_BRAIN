export interface AIProvider {
    generate(systemPrompt: string, userPrompt: string): Promise<{ text: string; metadata: any }>;
}
