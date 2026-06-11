import { useState } from 'react';
import axios from 'axios';

export default function EnhancementConsole({ userId, apiUrl }: { userId: string, apiUrl: string }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleEnhance = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${apiUrl}/enhance`, { userId, prompt });
      setResult(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Enhancement Console</h2>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        
        {/* Output area */}
        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             
             {/* Explainability Receipt */}
             <div className="mb-4 p-4 rounded-lg bg-indigo-50 border border-indigo-100">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Explainability Receipt
                </h3>
                <p className="text-sm text-indigo-900 mb-1">This prompt was enhanced using:</p>
                <ul className="text-sm text-indigo-700 space-y-1">
                    {result.explainabilityReceipt.identity?.role && <li>✓ Role: {result.explainabilityReceipt.identity.role}</li>}
                    {result.explainabilityReceipt.project?.name && <li>✓ Active Project: {result.explainabilityReceipt.project.name}</li>}
                    {result.explainabilityReceipt.style?.formattingRules && <li>✓ Style: Personal Preference</li>}
                    {result.explainabilityReceipt.policies?.map((pol: string, i: number) => (
                        <li key={i} className="text-red-600 font-medium">✓ Policy Enforcement: {pol.substring(0,40)}...</li>
                    ))}
                </ul>
             </div>

             {/* Final Prompt */}
             <div className="bg-gray-900 rounded-lg p-4 text-gray-100 shadow-inner">
                <div className="text-xs text-gray-400 mb-2 uppercase font-mono tracking-wider">Final Output to LLM</div>
                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {result.enhancedPrompt}
                </pre>
             </div>
          </div>
        )}

      </div>

      <div className="p-4 bg-white border-t">
        <div className="relative">
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your prompt to the AI here..."
            className="w-full resize-none rounded-xl border border-gray-300 p-4 pr-24 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            rows={3}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEnhance();
                }
            }}
          />
          <button 
            disabled={loading || !prompt.trim()}
            onClick={handleEnhance}
            className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow transition-colors disabled:opacity-50"
          >
            {loading ? 'Enhancing...' : 'Enhance'}
          </button>
        </div>
      </div>
    </div>
  );
}
