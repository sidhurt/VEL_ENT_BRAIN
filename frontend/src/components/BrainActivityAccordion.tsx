import { useState } from 'react';

export default function BrainActivityAccordion({ result }: { result: any }) {
    const [expanded, setExpanded] = useState(false);

    if (!result || !result.contextPack) return null;

    const policies = result.contextPack.policyContext || [];
    const projects = result.contextPack.projectContext || [];
    const tasks = result.contextPack.taskContext || [];
    const receipts = result.explainabilityReceipt || [];

    const numNodes = (result.contextPack.identityContext?.roles?.length || 0) + 
                     (result.contextPack.identityContext?.domains?.length || 0) + 
                     projects.length + tasks.length + policies.length;

    return (
        <div className="mt-4 border border-slate-800 rounded-lg bg-slate-900/30 overflow-hidden text-sm">
            <button 
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-3 bg-slate-900/50 hover:bg-slate-800/60 transition-colors text-slate-300 font-medium text-xs uppercase tracking-wider"
            >
                <div className="flex items-center gap-2">
                    <svg className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    <span>Brain Activity</span>
                </div>
                <div className="flex gap-4 text-slate-500 font-normal normal-case tracking-normal">
                    <span>{numNodes} context nodes assembled</span>
                    {policies.length > 0 && <span className="text-emerald-400 font-medium">{policies.length} {policies.length === 1 ? 'policy' : 'policies'} applied</span>}
                </div>
            </button>

            {expanded && (
                <div className="p-4 border-t border-slate-800 space-y-5 bg-slate-900/20">
                    
                    {/* Identity */}
                    <div>
                        <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">Identity</h4>
                        <div className="text-sm font-medium text-slate-300">
                            {result.contextPack.identityContext?.name}
                            <span className="text-slate-500 mx-2">·</span>
                            <span className="text-amber-400">{result.contextPack.identityContext?.roles?.join(', ')}</span>
                        </div>
                    </div>

                    {/* Projects & Tasks */}
                    {(projects.length > 0 || tasks.length > 0) && (
                        <div>
                            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">Projects & Tasks</h4>
                            <div className="flex flex-wrap gap-2">
                                {projects.map((p: any, i: number) => (
                                    <span key={`p-${i}`} className="text-xs bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 px-2 py-1 rounded">{p.name}</span>
                                ))}
                                {tasks.map((t: any, i: number) => (
                                    <span key={`t-${i}`} className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded">{t.name}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Policies */}
                    {policies.length > 0 && (
                        <div>
                            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">Enterprise Policies</h4>
                            <div className="space-y-2">
                                {policies.map((p: any, i: number) => (
                                    <div key={`pol-${i}`} className="flex items-start gap-2 bg-emerald-950/20 border border-emerald-900/30 p-2 rounded-md">
                                        <svg className="text-emerald-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                        <span className="text-xs text-emerald-200/90 leading-tight">{p.ruleText}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Explainability Receipt Details */}
                    {receipts.length > 0 && (
                        <div>
                            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">Retrieval Confidence</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {receipts.slice(0, 6).map((item: any, i: number) => (
                                    <div key={`rec-${i}`} className="flex justify-between items-center p-2 rounded-md bg-slate-950/50 border border-slate-800/80">
                                        <div className="truncate pr-2">
                                            <span className="font-semibold text-[11px] text-slate-300 truncate">{item.name}</span>
                                        </div>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${item.confidence === 'High' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                            {item.confidence}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}
