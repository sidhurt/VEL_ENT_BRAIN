import { useState } from 'react';
import axios from 'axios';

export default function EnhancementConsole({ userId, apiUrl }: { userId: string, apiUrl: string }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleEnhance = async () => {
    if (!prompt.trim() || !userId) return;
    setLoading(true);
    try {
      const res = await axios.post(`${apiUrl}/enhance`, { userId, prompt });
      setResult(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to generate context pack. Ensure graph is seeded.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 relative">
      <div className="p-4 border-b border-slate-800/60 bg-slate-900/60 flex justify-between items-center backdrop-blur-md z-10">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
           <svg className="text-fuchsia-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
           Context Pack Engine
        </h2>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-6 custom-scrollbar relative z-0">
        
        {/* Output area */}
        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
             
             {/* 1. Context Pack Viewer (Machine Readable) */}
             <div className="bg-[#0d1117] rounded-xl p-4 shadow-2xl border border-slate-800 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                        <svg className="text-emerald-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                        <h3 className="text-[10px] text-slate-400 uppercase font-mono tracking-widest font-bold">Generated Payload</h3>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">JSON</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar pb-2">
                    <pre className="text-xs font-mono leading-relaxed text-emerald-300/90">
                        {JSON.stringify(result.contextPack, null, 2)}
                    </pre>
                </div>
             </div>

             {/* 2. Explainability Receipt (Human Readable) */}
             <div>
                 <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2 ml-1">
                    <svg className="text-indigo-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Explainability Receipt
                </h3>
                <div className="space-y-3">
                    {result.explainabilityReceipt?.map((item: any, i: number) => {
                        let typeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                        if (item.type === 'Policy') typeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                        else if (item.type === 'Project') typeColor = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                        else if (item.type === 'Role') typeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                        
                        return (
                        <div key={i} className="flex flex-col gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-lg backdrop-blur-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className={`text-[9px] w-max px-2 py-0.5 rounded uppercase font-bold tracking-widest border mb-1.5 ${typeColor}`}>
                                        {item.type}
                                    </span>
                                    <span className="font-semibold text-sm text-slate-200">
                                        {item.name}
                                    </span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.confidence === 'High' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                    {item.confidence}
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex gap-2 items-center mt-1">
                                <span className="uppercase tracking-wider font-semibold text-slate-600">Reasons:</span>
                                <span className="text-indigo-300 font-medium">{item.reasons.join(' • ')}</span>
                            </div>
                        </div>
                    )})}
                </div>
             </div>

          </div>
        )}

      </div>

      <div className="p-4 bg-slate-900/80 border-t border-slate-800/60 backdrop-blur-xl relative z-10">
        <div className="relative">
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type a prompt to trigger context assembly..."
            className="w-full resize-none rounded-xl bg-slate-950/50 border border-slate-700/50 p-4 pr-36 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 focus:border-fuchsia-500 shadow-inner text-sm text-slate-200 placeholder:text-slate-600 transition-all"
            rows={3}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEnhance();
                }
            }}
          />
          <button 
            disabled={loading || !prompt.trim() || !userId}
            onClick={handleEnhance}
            className="absolute bottom-4 right-4 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(192,38,211,0.3)] transition-all disabled:opacity-50 disabled:grayscale"
          >
            {loading ? 'Processing...' : 'Assemble Context'}
          </button>
        </div>
      </div>
    </div>
  );
}
