export default function BrainToast({ candidates, onReview, onClose }: { candidates: any[], onReview: () => void, onClose: () => void }) {
    if (!candidates || candidates.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-slate-900 border border-slate-700/80 shadow-2xl rounded-xl p-4 flex flex-col gap-3 min-w-[300px]">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <svg className="text-emerald-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">Brain Evolution</span>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <p className="text-sm text-slate-300">
                    Discovered <span className="text-emerald-400 font-bold">{candidates.length}</span> new concept{candidates.length > 1 ? 's' : ''} from your work.
                </p>
                
                <button 
                    onClick={onReview}
                    className="mt-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 rounded-lg transition-colors border border-slate-700/50"
                >
                    Review & Add to Memory →
                </button>
            </div>
        </div>
    );
}
