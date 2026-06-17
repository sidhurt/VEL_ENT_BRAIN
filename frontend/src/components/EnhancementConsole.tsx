import { useState, useEffect } from 'react';
import axios from 'axios';

type ViewMode = 'production' | 'demonstration';
type ExecutionMode = 'assemble' | 'execute';

export default function EnhancementConsole({ userId, apiUrl }: { userId: string, apiUrl: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>('demonstration');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [guardrails, setGuardrails] = useState<{policy: string, reason: string, action: string, redactedPrompt?: string}[]>([]);
  const [disambiguationResolved, setDisambiguationResolved] = useState(false);

  // Reset state when user changes
  useEffect(() => {
    if (userId) {
        setResult(null);
        setGuardrails([]);
        setPrompt('');
        setDisambiguationResolved(false);
    }
  }, [userId]);

  const handleEnhance = async (mode: ExecutionMode) => {
    if (!prompt.trim() || !userId) return;
    setLoading(true);
    setGuardrails([]);
    setResult(null);
    setDisambiguationResolved(false);

    let finalPrompt = prompt;
    let localGuardrails: {policy: string, reason: string, action: string, redactedPrompt?: string}[] = [];

    let isHardStopped = false;
    // FRONTEND-ONLY MOCK: Simulating Velocity Prompt Engine Guardrails & Policy Triggers
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
    
    if (/epstein|blackmail|claim|speculat/i.test(finalPrompt)) {
        finalPrompt = finalPrompt.replace(/claim the client uses epstein files to blackmail people|epstein files|blackmail people/gi, '[REDACTED_UNVERIFIED_CLAIM]');
        localGuardrails.push({
            policy: 'No Speculation Presented As Fact',
            reason: 'Prompt contains unsupported allegations or speculative claims.',
            action: 'Claim flagged and blocked from generation.',
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
    
    setGuardrails(localGuardrails);

    if (isHardStopped) {
        setResult(null);
        setLoading(false);
        return;
    }

    try {
      const res = await axios.post(`${apiUrl}/enhance`, { userId, prompt: finalPrompt, executionMode: mode });
      setResult(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const hasCasualStyle = result?.contextPack?.styleContext?.some((s:string) => s.toLowerCase().includes('casual'));
  const hasProfPolicy = result?.contextPack?.policyContext?.some((p:any) => p.ruleText.toLowerCase().includes('professional'));
  const conflictDetected = hasCasualStyle && hasProfPolicy;

  const lowConfidenceItems = result?.explainabilityReceipt?.filter((i:any) => 
      (i.type === 'Project' || i.type === 'Task') && i.confidence === 'Low'
  ) || [];
  const requiresDisambiguation = !disambiguationResolved && lowConfidenceItems.length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-900/40 relative">
      <div className="p-4 border-b border-slate-800/60 bg-slate-900/60 flex justify-between items-center backdrop-blur-md z-10">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
           <svg className="text-fuchsia-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
           Context Pack Engine
        </h2>
        
        <div className="flex bg-slate-950/80 rounded-lg p-1 border border-slate-800">
          <button 
            onClick={() => setViewMode('demonstration')}
            className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all ${viewMode === 'demonstration' ? 'bg-fuchsia-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Demonstration
          </button>
          <button 
            onClick={() => setViewMode('production')}
            className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all ${viewMode === 'production' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Production JSON
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 custom-scrollbar relative z-0">

        {!result && guardrails.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                 <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-slate-600"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                 <p className="text-sm font-medium">Ready to Assemble Context</p>
                 <p className="text-xs mt-1">Select a Persona and run a prompt.</p>
             </div>
        )}

        {/* Output area */}
        {(result || guardrails.length > 0) && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
             
             {/* Guardrail Card (Only in Demo Mode if triggered) */}
             {viewMode === 'demonstration' && guardrails.length > 0 && (
               <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 shadow-xl relative overflow-hidden flex flex-col gap-4">
                 <div className="flex items-center gap-2 border-b border-rose-500/20 pb-2">
                   <svg className="text-rose-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                   <h3 className="text-sm font-bold text-rose-400">Governance Guardrails Enforced</h3>
                 </div>
                 
                 <div className="space-y-4">
                     {guardrails.map((g, idx) => (
                         <div key={idx} className="bg-slate-950/50 border border-rose-900/50 p-3 rounded-lg relative">
                             <div className="absolute top-0 right-0 p-2 opacity-10">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                             </div>
                             
                             <div className="relative z-10 grid grid-cols-1 gap-2">
                                 <div>
                                     <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Policy Triggered</span>
                                     <span className="text-xs font-bold text-rose-400">{g.policy}</span>
                                 </div>
                                 
                                 <div>
                                     <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Reason</span>
                                     <span className="text-[11px] text-slate-300">{g.reason}</span>
                                 </div>

                                 <div className="mt-1 bg-rose-500/10 border border-rose-500/20 px-2 py-1.5 rounded">
                                     <span className="block text-[9px] uppercase tracking-widest text-rose-500 font-bold mb-0.5">Governance Action</span>
                                     <span className="text-[11px] text-rose-200 font-medium">{g.action}</span>
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>

                 {guardrails.some(g => g.policy.includes('DLP')) && (
                     <div className="bg-rose-950/80 border border-rose-900/50 p-2 rounded text-xs font-mono text-rose-200/90 break-all mt-2">
                       {guardrails[guardrails.length-1].redactedPrompt}
                     </div>
                 )}
               </div>
             )}

              {viewMode === 'demonstration' && result ? (
                <div className="space-y-8">
                    
                    {/* SECTION 1: CONTEXT PACK */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                            Section 1: Context Pack
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4">
                                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Identity & Roles</span>
                                <div className="text-sm text-slate-200 font-semibold">{result.contextPack.identityContext?.name}</div>
                                {result.contextPack.identityContext?.roles?.map((r: string, i: number) => (
                                    <div key={i} className="text-xs text-amber-400 mt-1">{r}</div>
                                ))}
                            </div>
                            
                            <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4">
                                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Active Projects & Tasks</span>
                                {result.contextPack.projectContext?.map((p: any, i: number) => (
                                    <div key={i} className="text-xs text-fuchsia-400 mb-1 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg> {p.name}</div>
                                ))}
                                {result.contextPack.taskContext?.map((t: any, i: number) => (
                                    <div key={i} className="text-xs text-slate-400 mb-1 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> {t.name}</div>
                                ))}
                                {(!result.contextPack.projectContext?.length && !result.contextPack.taskContext?.length) && <span className="text-xs text-slate-600">None detected</span>}
                            </div>

                            <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 col-span-2">
                                <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Mandatory Enterprise Policies</span>
                                <div className="space-y-2">
                                    {result.contextPack.policyContext?.map((p:any, i:number) => (
                                        <div key={i} className="flex items-center gap-2 bg-slate-950/50 border border-emerald-900/30 px-3 py-1.5 rounded-md">
                                            <svg className="text-emerald-500 shrink-0" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            <span className="text-xs text-slate-300 font-medium">{p.ruleText}</span>
                                        </div>
                                    ))}
                                    {(!result.contextPack.policyContext || result.contextPack.policyContext.length === 0) && (
                                        <span className="text-xs text-slate-500 italic">No mandatory policies applied.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: PIPELINE TRACE */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                            Section 2: Pipeline Trace
                        </h3>
                        
                        {/* Conflict Resolution Visual */}
                        {conflictDetected && (
                            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 shadow-sm mb-4">
                                <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
                                    Enterprise Override Executed
                                </h4>
                                <div className="grid grid-cols-[1fr_24px_1fr] gap-2 items-center">
                                    <div className="bg-slate-900/80 border border-rose-500/20 p-2 rounded-lg text-center">
                                        <span className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">Personal Style</span>
                                        <span className="text-[10px] font-bold text-rose-400">Casual Communication</span>
                                    </div>
                                    <div className="flex justify-center text-slate-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13 17 5-5-5-5M6 17l5-5-5-5"/></svg>
                                    </div>
                                    <div className="bg-slate-900/80 border border-emerald-500/20 p-2 rounded-lg text-center">
                                        <span className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">Enterprise Policy</span>
                                        <span className="text-[10px] font-bold text-emerald-400">Professional Communication</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-2">
                            {result.explainabilityReceipt?.map((item: any, i: number) => {
                                let typeIcon;
                                if (item.type === 'Policy') typeIcon = <svg className="text-emerald-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M7 7h10"></path><path d="M7 12h10"></path><path d="M7 17h10"></path></svg>;
                                else if (item.type === 'Project') typeIcon = <svg className="text-fuchsia-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
                                else if (item.type === 'Role') typeIcon = <svg className="text-amber-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 15h6"/><path d="M3 19h6"/></svg>;
                                else if (item.type === 'Domain') typeIcon = <svg className="text-sky-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>;
                                else typeIcon = <svg className="text-slate-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>;
                                
                                return (
                                <div key={i} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-950 p-2 rounded-md border border-slate-800">
                                            {typeIcon}
                                        </div>
                                        <div>
                                            <span className="font-semibold text-xs text-slate-200 block">
                                                {item.name}
                                            </span>
                                            <span className="text-[9px] text-slate-500 font-medium">
                                                {item.type} • Reason: {item.reasons.join(', ')}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${item.confidence === 'High' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                        {item.confidence}
                                    </span>
                                </div>
                            )})}
                        </div>
                        
                        {requiresDisambiguation && (
                             <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 shadow-xl mt-4">
                                <h3 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    Clarification Required
                                </h3>
                                <p className="text-xs text-slate-300 mb-3">
                                    Based on your prompt, we are not fully confident which project you are referring to. Are you asking about <strong>{lowConfidenceItems[0]?.name}</strong>?
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={() => setDisambiguationResolved(true)} className="bg-emerald-600/80 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-[10px] font-bold transition-all">Yes, use this project</button>
                                    <button onClick={() => setResult(null)} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-[10px] font-bold transition-all">No, let me specify</button>
                                </div>
                             </div>
                        )}
                    </div>

                    {/* SECTION 3: GENERATED OUTCOME */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                Section 3: Generated Outcome
                            </span>
                            {result.executionMetadata && (
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                                    {result.executionMetadata.provider} | {result.executionMetadata.executionTime}ms
                                </span>
                            )}
                        </h3>
                        
                        {result.generatedOutcome ? (
                            <div className="bg-slate-50 rounded-xl p-6 shadow-xl border border-slate-200 text-slate-900 font-serif leading-relaxed text-sm">
                                <div className="text-[10px] uppercase font-sans font-bold text-slate-400 tracking-widest mb-4 pb-2 border-b border-slate-200">
                                    Outcome Generated Using Unified Brain Context
                                </div>
                                <div className="whitespace-pre-wrap">
                                    {result.generatedOutcome}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900/40 rounded-xl p-8 border border-slate-800 border-dashed flex flex-col items-center justify-center text-slate-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-2"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                <span className="text-xs">Context Assembled. Execute to generate outcome.</span>
                            </div>
                        )}
                    </div>

                </div>
              ) : (
                /* Production JSON View */
                result ? (
                <div className="bg-[#0d1117] rounded-xl p-4 shadow-2xl border border-slate-800 h-full relative">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                          <svg className="text-emerald-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                          <h3 className="text-[10px] text-slate-400 uppercase font-mono tracking-widest font-bold">API Context Response</h3>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">JSON</span>
                  </div>
                  <div className="overflow-y-auto h-[400px] custom-scrollbar pb-2">
                      <pre className="text-xs font-mono leading-relaxed text-emerald-300/90">
                          {JSON.stringify({
                              contextPack: result.contextPack,
                              explainabilityReceipt: result.explainabilityReceipt,
                              executionMetadata: result.executionMetadata,
                              generatedOutcome: result.generatedOutcome,
                              sanitizedPrompt: guardrails.length > 0 && guardrails[guardrails.length-1].redactedPrompt ? guardrails[guardrails.length-1].redactedPrompt : prompt
                          }, null, 2)}
                      </pre>
                  </div>
                </div>
                ) : null
              )}
          </div>
        )}

      </div>

      <div className="p-4 bg-slate-900/80 border-t border-slate-800/60 backdrop-blur-xl relative z-10">
        <div className="relative">
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type a prompt to trigger context assembly..."
            className="w-full resize-none rounded-xl bg-slate-950/50 border border-slate-700/50 p-4 pr-72 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 focus:border-fuchsia-500 shadow-inner text-sm text-slate-200 placeholder:text-slate-600 transition-all"
            rows={3}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEnhance('execute');
                }
            }}
          />
          <div className="absolute bottom-4 right-4 flex gap-2">
              <button 
                disabled={loading || !prompt.trim() || !userId}
                onClick={() => handleEnhance('assemble')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 disabled:grayscale"
              >
                Assemble Only
              </button>
              <button 
                disabled={loading || !prompt.trim() || !userId}
                onClick={() => handleEnhance('execute')}
                className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(192,38,211,0.3)] transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2"
              >
                {loading ? 'Processing...' : 'Execute w/ Context'}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
