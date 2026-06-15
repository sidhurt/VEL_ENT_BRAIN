export default function GovernanceProfile({ graphData }: { graphData: any }) {
    if (!graphData || !graphData.nodes) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60 p-6 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-slate-600"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 9h18"></path><path d="M9 21V9"></path></svg>
                <p className="text-sm font-medium">Governance Profile Empty</p>
                <p className="text-xs mt-1">Onboard a User or Enterprise to generate the Governance Ledger.</p>
            </div>
        );
    }

    const orgNode = graphData.nodes.find((n: any) => n.label === 'Organization');
    const userNode = graphData.nodes.find((n: any) => n.label === 'User');
    const policies = graphData.nodes.filter((n: any) => n.label === 'Policy');
    const entProjects = graphData.nodes.filter((n: any) => n.label === 'Project' && n.properties?.type === 'Enterprise');
    const personalProjects = graphData.nodes.filter((n: any) => n.label === 'Project' && n.properties?.type === 'Personal');
    const roleNode = graphData.nodes.find((n: any) => n.label === 'Role');

    return (
        <div className="p-4 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 custom-scrollbar">
            {/* Header section */}
            <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <svg className="text-emerald-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    Enterprise Governance Ledger
                </h3>
            </div>

            {/* If Organization Exists */}
            {orgNode && (
                <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path></svg>
                        </div>
                        <div>
                            <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-widest">Organization Head</span>
                            <span className="text-sm font-bold text-slate-200">{orgNode.properties.name}</span>
                        </div>
                    </div>

                    <div className="space-y-4 ml-2 border-l-2 border-slate-800 pl-4">
                        <div>
                            <span className="block text-[10px] text-rose-400 uppercase font-bold tracking-widest mb-2 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                Mandatory Policies Established
                            </span>
                            <div className="space-y-1.5">
                                {policies.length > 0 ? policies.map((p:any, i:number) => (
                                    <div key={i} className="flex items-start gap-2 bg-slate-950/50 border border-rose-900/30 px-3 py-1.5 rounded-md">
                                        <svg className="text-rose-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                        <span className="text-xs text-slate-300 font-medium">{p.properties.ruleText}</span>
                                    </div>
                                )) : <span className="text-xs text-slate-500 italic">No policies active.</span>}
                            </div>
                        </div>

                        {entProjects.length > 0 && (
                            <div>
                                <span className="block text-[10px] text-fuchsia-400 uppercase font-bold tracking-widest mb-2 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                                    Enterprise Initiatives
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {entProjects.map((p:any, i:number) => (
                                        <span key={i} className="text-[10px] bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 px-2 py-1 rounded font-bold uppercase tracking-widest">
                                            {p.properties.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* User Identity Passport */}
            {userNode && (
                <div className="bg-[#0d1117] border border-slate-800 rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-3 mb-4 border-b border-slate-800/80 pb-3">
                        <div className="bg-sky-500/20 p-2 rounded-full text-sky-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        <div>
                            <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-widest">Employee Passport</span>
                            <span className="text-sm font-bold text-slate-200">{userNode.properties.name || userNode.id}</span>
                        </div>
                        {roleNode && (
                            <span className="ml-auto text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-full font-bold uppercase tracking-widest">
                                {roleNode.properties.name}
                            </span>
                        )}
                    </div>

                    {personalProjects.length > 0 && (
                        <div>
                            <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-2 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                Personal Active Projects
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {personalProjects.map((p:any, i:number) => (
                                    <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">
                                        {p.properties.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
