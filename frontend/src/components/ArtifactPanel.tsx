export default function ArtifactPanel({ outcome, contextPack }: { outcome: string, contextPack: any }) {
    if (!outcome) return null;

    const inferArtifactType = (taskContext: any[] = [], roles: string[] = []) => {
        const tasks = taskContext.map((t:any) => t.name.toLowerCase()).join(' ');
        if (tasks.includes('architecture') || tasks.includes('review')) return 'Architecture Document';
        if (tasks.includes('qbr') || tasks.includes('report')) return 'Executive Report';
        if (tasks.includes('policy') || tasks.includes('compliance')) return 'Compliance Assessment';
        if (tasks.includes('design') || tasks.includes('proposal')) return 'Design Proposal';
        return 'Enterprise Work Product';
    };

    const artifactType = inferArtifactType(contextPack?.taskContext, contextPack?.identityContext?.roles);

    return (
        <div className="bg-slate-100 rounded-xl shadow-2xl border border-slate-300 overflow-hidden">
            <div className="bg-slate-200/50 border-b border-slate-300 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-1.5 rounded-md text-white shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">{artifactType}</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Powered by Unified Brain</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => navigator.clipboard.writeText(outcome)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
                        Copy
                    </button>
                </div>
            </div>
            
            <div className="p-8 prose prose-slate prose-sm max-w-none text-slate-900 font-serif leading-relaxed">
                <div className="whitespace-pre-wrap">{outcome}</div>
            </div>
        </div>
    );
}
