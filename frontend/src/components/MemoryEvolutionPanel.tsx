import { useState, useEffect } from 'react';
import axios from 'axios';

export default function MemoryEvolutionPanel({ userId, apiUrl }: { userId: string, apiUrl: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchEvolution = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${apiUrl}/evolution/${userId}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvolution();
  }, [userId, apiUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900/40">
        <p className="text-slate-400 font-mono text-sm animate-pulse">Synchronizing with Graph Server...</p>
      </div>
    );
  }

  if (!data) return null;

  const totalMemories = (data.health.Active || 0) + (data.health.Recent || 0) + (data.health.Archived || 0);

  return (
    <div className="flex flex-col h-full bg-slate-900/40 relative">
      <div className="p-4 border-b border-slate-800/60 bg-slate-900/60 flex justify-between items-center backdrop-blur-md z-10">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
           <svg className="text-emerald-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"></path><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path><path d="M12 2v2"></path><path d="M12 22v-2"></path><path d="m17 20.66-1-1.73"></path><path d="M11 10.27 7 3.34"></path><path d="m20.66 17-1.73-1"></path><path d="m3.34 7 1.73 1"></path><path d="M14 12h8"></path><path d="M2 12h2"></path><path d="m20.66 7-1.73 1"></path><path d="m3.34 17 1.73-1"></path><path d="m17 3.34-1 1.73"></path><path d="m11 13.73-4 6.93"></path></svg>
           Memory Evolution
        </h2>
        <button onClick={fetchEvolution} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold uppercase tracking-wider transition-colors">
            Refresh Metrics
        </button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-8">
        
        {/* Narrative Intro */}
        <div className="text-center max-w-2xl mx-auto space-y-2 mb-4">
            <h1 className="text-xl font-bold text-slate-100">The Brain Adapts to How People Work</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
                The Unified Brain isn't a static database. It actively monitors Context Pack assembly events, learning which projects, tasks, and policies are dominating your workflows. Active knowledge is promoted, while dormant concepts safely fade away.
            </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
            {/* Memory Health Dashboard */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <svg className="text-sky-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    Memory Health Dashboard
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-emerald-400">{data.health.Active || 0}</span>
                        <span className="text-[10px] uppercase font-bold text-emerald-500/80 mt-1">Active</span>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-amber-400">{data.health.Recent || 0}</span>
                        <span className="text-[10px] uppercase font-bold text-amber-500/80 mt-1">Recent</span>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-slate-400">{data.health.Archived || 0}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500/80 mt-1">Archived</span>
                    </div>
                </div>
                <p className="text-xs text-slate-500 mt-4 text-center">
                    Out of <strong className="text-slate-300">{totalMemories}</strong> total trackable knowledge nodes.
                </p>
            </div>

            {/* Graph Growth & Enterprise */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm flex flex-col gap-5">
                <div>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <svg className="text-indigo-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                        Graph Size
                    </h3>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-indigo-300">{data.metrics.nodes}</span> Nodes
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-fuchsia-300">{data.metrics.edges}</span> Edges
                        </div>
                    </div>
                </div>
                
                <div className="pt-4 border-t border-slate-800/50">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <svg className="text-fuchsia-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path></svg>
                        Enterprise Inheritance
                    </h3>
                    <div className="text-sm text-slate-400">
                        Inheriting <strong className="text-rose-400">{data.inheritance?.policies?.length || 0} mandatory policies</strong> directly from org: <span className="text-slate-200">{data.inheritance?.orgName || 'N/A'}</span>.
                    </div>
                </div>
            </div>
        </div>

        {/* Relevance Trends & Activity Timeline */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm">
             <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                <svg className="text-rose-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                Relevance Trends (Top Usages)
            </h3>
            
            <div className="space-y-3">
                {data.topUsages && data.topUsages.length > 0 ? data.topUsages.map((mem: any, i: number) => {
                    let trendColor = 'text-slate-500';
                    let trendLabel = 'Low Relevance';
                    let stateBadge = 'bg-slate-800 text-slate-400';
                    
                    if (mem.usageCount >= 10) {
                        trendColor = 'text-emerald-400';
                        trendLabel = 'High Relevance';
                    } else if (mem.usageCount >= 5) {
                        trendColor = 'text-amber-400';
                        trendLabel = 'Medium Relevance';
                    }

                    if (mem.state === 'Active') stateBadge = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                    else if (mem.state === 'Recent') stateBadge = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';

                    return (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="text-center w-10">
                                    <span className="block text-xl font-bold text-slate-200">{mem.usageCount}</span>
                                    <span className="block text-[8px] uppercase tracking-widest text-slate-500">Uses</span>
                                </div>
                                <div className="h-8 w-px bg-slate-800"></div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${mem.type === 'Project' ? 'bg-sky-500/10 text-sky-400' : 'bg-slate-800 text-slate-300'}`}>{mem.type}</span>
                                        <span className="text-sm font-bold text-slate-200">{mem.name}</span>
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${trendColor} flex items-center gap-1`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                                        {trendLabel}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ${stateBadge}`}>
                                    {mem.state}
                                </span>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-6 text-slate-500 text-sm">
                        No usage data recorded yet. Assemble context packs to build usage.
                    </div>
                )}
            </div>
        </div>

        {/* Future Capabilities Placeholder */}
        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-6 text-center shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500 opacity-50"></div>
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>
                Future Capability
            </h3>
            <p className="text-sm text-indigo-200/80 max-w-lg mx-auto leading-relaxed">
                Future versions may automatically discover new concepts, domains, and relationships by ingesting enterprise event streams (Slack, Jira, Email). 
                <br/><span className="text-indigo-400/60 text-xs italic mt-2 block">This feature is conceptual and not currently implemented.</span>
            </p>
        </div>

      </div>
    </div>
  );
}
