import { useState, useEffect } from 'react';
import axios from 'axios';

export default function GovernanceProfile({ graphData, apiUrl }: { graphData: any, apiUrl: string }) {
    const [enterprises, setEnterprises] = useState<any[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [orgDetails, setOrgDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get(`${apiUrl}/enterprises`).then(res => {
            setEnterprises(res.data);
            if (res.data.length > 0 && !selectedOrgId) {
                // Default to user's org if it exists in graph
                const userOrg = graphData?.nodes?.find((n:any) => n.label === 'Organization');
                if (userOrg) setSelectedOrgId(userOrg.id);
                else setSelectedOrgId(res.data[0].id);
            }
        }).catch(err => console.error("Failed to fetch enterprises", err));
    }, [apiUrl, graphData]);

    useEffect(() => {
        if (selectedOrgId) {
            setLoading(true);
            axios.get(`${apiUrl}/enterprise/${selectedOrgId}/details`).then(res => {
                setOrgDetails(res.data);
            }).catch(err => console.error(err)).finally(() => setLoading(false));
        }
    }, [selectedOrgId, apiUrl]);

    if (!enterprises || enterprises.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60 p-6 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-slate-600"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 9h18"></path><path d="M9 21V9"></path></svg>
                <p className="text-sm font-medium">Enterprise Explorer Empty</p>
                <p className="text-xs mt-1">Seed the database to view enterprise structures.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Explorer Header */}
            <div className="p-4 border-b border-slate-800/60 bg-slate-900/60 flex justify-between items-center backdrop-blur-md z-10 shrink-0">
                <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <svg className="text-emerald-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    Enterprise Explorer
                </h3>
                
                <select 
                    value={selectedOrgId} 
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="bg-slate-950/80 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner font-bold"
                >
                    {enterprises.map((e: any) => (
                        <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                    ))}
                </select>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar relative">
                {loading && (
                    <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm z-20 flex items-center justify-center">
                         <span className="text-xs text-slate-400 font-mono animate-pulse">Scanning Enterprise...</span>
                    </div>
                )}

                {orgDetails && orgDetails.organization && (
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path></svg>
                            </div>
                            <div>
                                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-widest">Organization Root</span>
                                <span className="text-sm font-bold text-slate-200">{orgDetails.organization.name}</span>
                            </div>
                        </div>

                        <div className="space-y-5 ml-2 border-l-2 border-slate-800 pl-4">
                            
                            {/* Policies */}
                            <div>
                                <span className="block text-[10px] text-rose-400 uppercase font-bold tracking-widest mb-2 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    Mandatory Policies Established
                                </span>
                                <div className="space-y-1.5">
                                    {orgDetails.policies && orgDetails.policies.length > 0 ? orgDetails.policies.map((p:any, i:number) => (
                                        <div key={i} className="flex items-start gap-2 bg-slate-950/50 border border-rose-900/30 px-3 py-1.5 rounded-md">
                                            <svg className="text-rose-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                            <span className="text-xs text-slate-300 font-medium">{p.ruleText}</span>
                                        </div>
                                    )) : <span className="text-xs text-slate-500 italic">No active policies.</span>}
                                </div>
                            </div>

                            {/* Projects */}
                            <div>
                                <span className="block text-[10px] text-fuchsia-400 uppercase font-bold tracking-widest mb-2 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                                    Enterprise Initiatives
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {orgDetails.projects && orgDetails.projects.length > 0 ? orgDetails.projects.map((p:any, i:number) => (
                                        <span key={i} className="text-[10px] bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 px-2 py-1 rounded font-bold uppercase tracking-widest">
                                            {p.name}
                                        </span>
                                    )) : <span className="text-xs text-slate-500 italic">No enterprise projects.</span>}
                                </div>
                            </div>

                            {/* Members */}
                            <div>
                                <span className="block text-[10px] text-sky-400 uppercase font-bold tracking-widest mb-2 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                    Employees Bound to Brain
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {orgDetails.members && orgDetails.members.length > 0 ? orgDetails.members.map((m:any, i:number) => (
                                        <span key={i} className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2 py-1 rounded font-bold tracking-widest">
                                            {m.name || m.id}
                                        </span>
                                    )) : <span className="text-xs text-slate-500 italic">No members attached.</span>}
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
