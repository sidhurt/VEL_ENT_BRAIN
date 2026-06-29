import MemoryEvolutionPanel from './MemoryEvolutionPanel';

export default function BrainPanel({ userId, apiUrl, onClose }: { userId: string, apiUrl: string, onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}></div>
            
            {/* Slide-in Panel */}
            <div className="relative w-full max-w-2xl bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300 border-l border-slate-800/80">
                <div className="flex items-center justify-between p-4 border-b border-slate-800/60 bg-slate-950/50">
                    <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                        <svg className="text-fuchsia-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        My Unified Brain
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <MemoryEvolutionPanel userId={userId} apiUrl={apiUrl} />
                </div>
            </div>
        </div>
    );
}
