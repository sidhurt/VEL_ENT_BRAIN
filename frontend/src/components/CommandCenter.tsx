import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isTyping?: boolean;
};

export default function CommandCenter() {
    const [userId, setUserId] = useState('user-siddharth');
    const [messages, setMessages] = useState<Message[]>([
        { id: 'initial', role: 'assistant', content: 'Hello. I am connected to the Enterprise Unified Brain. How can I assist you today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Right Panel State
    const [contextPack, setContextPack] = useState<any>(null);
    const [receipt, setReceipt] = useState<any>(null);
    const [guardrails, setGuardrails] = useState<any[]>([]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !userId) return;
        
        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        setContextPack(null);
        setReceipt(null);
        setGuardrails([]);

        const typingMsgId = 'typing-' + Date.now();
        setMessages(prev => [...prev, { id: typingMsgId, role: 'assistant', content: '...', isTyping: true }]);

        let finalPrompt = userMsg.content;
        let localGuardrails: any[] = [];
        let isHardStopped = false;

        // FRONTEND-ONLY MOCK: Simulating Velocity Prompt Engine Guardrails
        const openAiKeyRegex = /(sk-|sp-|sk-proj-|sp-proj-)[A-Za-z0-9_-]+/g;
        
        if (/secret document|confidential|internal customer data/i.test(finalPrompt)) {
            finalPrompt = finalPrompt.replace(/secret document[s]?|confidential|internal customer data/gi, '[REDACTED_CONFIDENTIAL_INFO]');
            localGuardrails.push({
                policy: 'Client Confidentiality',
                reason: 'Request references confidential enterprise information or internal documents.',
                action: 'Confidential information blocked from payload.',
                redactedPrompt: finalPrompt
            });
        }
        
        if (/market forecast|finance report/i.test(finalPrompt)) {
            finalPrompt = finalPrompt.replace(/market forecast|finance report/gi, '[FLAGGED_FINANCIAL_REQUEST]');
            localGuardrails.push({
                policy: 'Financial Integrity',
                reason: 'Financial forecasts require approved source attribution.',
                action: 'Financial speculation blocked.',
                redactedPrompt: finalPrompt
            });
        }

        if (openAiKeyRegex.test(finalPrompt)) {
          finalPrompt = finalPrompt.replace(openAiKeyRegex, '[REDACTED_API_KEY]');
          localGuardrails.push({
            policy: 'Data Loss Prevention (DLP)',
            reason: 'Sensitive Content Removed: API Key detected.',
            action: 'HARD STOP: Payload interception. Action blocked.',
            redactedPrompt: finalPrompt
          });
          isHardStopped = true;
        }

        setTimeout(async () => {
            setGuardrails(localGuardrails);

            if (isHardStopped) {
                setMessages(prev => prev.filter(m => m.id !== typingMsgId).concat({
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: 'I cannot process this request due to a Data Loss Prevention hard stop.'
                }));
                setLoading(false);
                return;
            }

            try {
                const res = await axios.post(`${API_URL}/enhance`, { userId, prompt: finalPrompt, executionMode: 'execute' });
                
                setContextPack(res.data.contextPack);
                setReceipt(res.data.explainabilityReceipt);
                
                const answer = res.data.generatedOutcome || "Context successfully assembled. Proceeding with operation.";
                
                setMessages(prev => prev.filter(m => m.id !== typingMsgId).concat({
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: answer
                }));
            } catch (e) {
                console.error(e);
                setMessages(prev => prev.filter(m => m.id !== typingMsgId).concat({
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: 'Sorry, I encountered an error communicating with the Unified Brain.'
                }));
            } finally {
                setLoading(false);
            }
        }, 800); // slight delay for visual "brain thinking" effect
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 flex flex-col font-sans selection:bg-indigo-500/30 overflow-hidden">
            {/* Header */}
            <header className="glass relative z-50 px-8 py-4 flex justify-between items-center border-b border-slate-800/60 shadow-lg bg-[#0f172a]/80 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-wide">Jarvis</h1>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Enterprise Context Core</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="flex items-center bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/50">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mr-3 ml-2">Identity:</span>
                        <button 
                            onClick={() => setUserId('user-emma')} 
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${userId === 'user-emma' ? 'bg-fuchsia-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                            Emma
                        </button>
                        <button 
                            onClick={() => setUserId('user-siddharth')} 
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${userId === 'user-siddharth' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                            Siddharth
                        </button>
                        <button 
                            onClick={() => setUserId('user-michael')} 
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${userId === 'user-michael' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                            Michael
                        </button>
                    </div>
                    <Link to="/admin" className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Dev Mode
                    </Link>
                </div>
            </header>

            {/* Main Area */}
            <main className="flex-1 flex overflow-hidden relative z-10">
                {/* Left Pane: Chat */}
                <div className="w-[55%] flex flex-col border-r border-slate-800/60 bg-[#020617]/90 relative">
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="max-w-3xl mx-auto space-y-8 pb-10">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-lg bg-indigo-900/50 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                                        </div>
                                    )}
                                    <div className={`px-5 py-4 rounded-2xl max-w-[85%] text-[15px] leading-relaxed shadow-sm ${
                                        msg.role === 'user' 
                                        ? 'bg-slate-800 text-white rounded-br-sm' 
                                        : 'bg-slate-900/80 border border-slate-800 text-slate-300 rounded-bl-sm font-serif'
                                    }`}>
                                        {msg.isTyping ? (
                                            <span className="flex items-center gap-1.5 h-6">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"></span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: '0.2s'}}></span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: '0.4s'}}></span>
                                            </span>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{msg.content}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                    <div className="p-6 bg-gradient-to-t from-[#020617] to-transparent">
                        <div className="max-w-3xl mx-auto relative">
                            <textarea 
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if(e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Message Jarvis..."
                                className="w-full bg-slate-900 border border-slate-700/60 rounded-2xl py-4 pl-5 pr-16 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 resize-none shadow-lg"
                                rows={1}
                                style={{ minHeight: '60px' }}
                            />
                            <button 
                                onClick={handleSend}
                                disabled={loading || !input.trim()}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center disabled:opacity-50 transition-all shadow-md"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Pane: Live Brain Explainability */}
                <div className="w-[45%] bg-[#080f1e] overflow-y-auto p-8 custom-scrollbar">
                    <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-4">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-fuchsia-500"></span>
                        </span>
                        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest font-heading">Live Context Engine</h2>
                    </div>

                    {!contextPack && guardrails.length === 0 && !loading && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 -mt-20">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            <p className="font-medium text-sm">Awaiting Prompt Analysis</p>
                        </div>
                    )}

                    {loading && !guardrails.length && !contextPack && (
                        <div className="h-full flex flex-col items-center justify-center text-indigo-400/50 -mt-20">
                            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                            <p className="font-bold text-xs uppercase tracking-widest animate-pulse">Traversing Graph...</p>
                        </div>
                    )}

                    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
                        {/* Governance Block */}
                        {guardrails.length > 0 && (
                            <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-5 shadow-[0_0_30px_rgba(244,63,94,0.1)]">
                                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                    Enterprise Policy Override
                                </h3>
                                <div className="space-y-3">
                                    {guardrails.map((g, idx) => (
                                        <div key={idx} className="bg-[#020617]/50 border border-rose-900/50 p-4 rounded-xl">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Policy Triggered</span>
                                                <span className="text-xs font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">10,000 pts</span>
                                            </div>
                                            <div className="text-sm font-bold text-slate-200 mb-1">{g.policy}</div>
                                            <div className="text-xs text-slate-400 mb-3">{g.reason}</div>
                                            <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg text-xs font-medium text-rose-300">
                                                Action: {g.action}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {contextPack && (
                            <>
                                {/* Identity Block */}
                                <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-5">
                                    <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        Identity Anchor
                                    </h3>
                                    <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                                        <div>
                                            <div className="text-lg font-bold text-white mb-1">{contextPack.identityContext?.name}</div>
                                            <div className="flex gap-2">
                                                {contextPack.identityContext?.roles?.map((r: string, i: number) => (
                                                    <span key={i} className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-indigo-300 px-2 py-0.5 rounded">{r}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">+100 pts</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Context Block */}
                                <div className="bg-fuchsia-950/10 border border-fuchsia-500/20 rounded-2xl p-5">
                                    <h3 className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                        Active Context Assembled
                                    </h3>
                                    <div className="space-y-2">
                                        {receipt?.filter((r:any) => r.type === 'Project' || r.type === 'Task').map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                                                <div>
                                                    <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">{item.type}</div>
                                                    <div className="text-sm font-bold text-slate-200">{item.name}</div>
                                                </div>
                                                <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                                                    +{item.weight} pts
                                                </div>
                                            </div>
                                        ))}
                                        {receipt?.filter((r:any) => r.type === 'Project' || r.type === 'Task').length === 0 && (
                                            <div className="text-xs text-slate-500 italic p-2">No active projects matched semantic intent.</div>
                                        )}
                                    </div>
                                </div>

                                {/* Base Policy Block */}
                                {contextPack.policyContext?.length > 0 && (
                                    <div className="bg-emerald-950/10 border border-emerald-500/20 rounded-2xl p-5">
                                        <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                            Base Policies Injected
                                        </h3>
                                        <div className="space-y-2">
                                            {contextPack.policyContext?.map((p: any, i: number) => (
                                                <div key={i} className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex items-start gap-3">
                                                    <svg className="text-emerald-500 mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    <span className="text-xs font-medium text-slate-300">{p.ruleText}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>

            {/* Decorative Background Elements */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full mix-blend-screen"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 blur-[150px] rounded-full mix-blend-screen"></div>
            </div>
        </div>
    );
}
