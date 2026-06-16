import { useState, useEffect } from 'react';
import axios from 'axios';

type Mode = 'production' | 'demonstration';

export default function EnhancementConsole({ userId, apiUrl }: { userId: string, apiUrl: string }) {
  const [mode, setMode] = useState<Mode>('demonstration');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [guardrails, setGuardrails] = useState<{policy: string, reason: string, action: string, redactedPrompt?: string}[]>([]);
  const [orgData, setOrgData] = useState<{orgName: string, policies: string[]} | null>(null);

  // Fetch Org data to display inheritance
  useEffect(() => {
    if (userId) {
        axios.get(`${apiUrl}/evolution/${userId}`)
            .then(res => setOrgData(res.data.inheritance))
            .catch(e => console.error(e));
        
        // Reset when user changes
        setResult(null);
        setGuardrails([]);
        setPrompt('');
    }
  }, [userId, apiUrl]);

  const handleEnhance = async () => {
    if (!prompt.trim() || !userId) return;
    setLoading(true);
    setGuardrails([]);
    setResult(null);

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
      const res = await axios.post(`${apiUrl}/enhance`, { userId, prompt: finalPrompt });
      setResult(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderPayloadPreview = () => {
    if (!result) return null;
    let text = `[SYSTEM INSTRUCTIONS]\n`;
    text += `You are an AI assistant. Use the following context to respond to the user.\n\n`;
    
    if (result.contextPack.policyContext?.length > 0) {
      text += `<CRITICAL_POLICIES>\n`;
      result.contextPack.policyContext.forEach((p: any) => text += `- ${p.ruleText}\n`);
      text += `</CRITICAL_POLICIES>\n\n`;
    }

    if (result.contextPack.identityContext?.name || result.contextPack.identityContext?.roles?.length > 0 || result.contextPack.projectContext?.length > 0) {
      text += `[USER CONTEXT]\n`;
      if (result.contextPack.identityContext?.name) {
          text += `- Name: ${result.contextPack.identityContext.name}\n`;
      }
      result.contextPack.identityContext?.roles?.forEach((r: any) => text += `- Role: ${r}\n`);
      result.contextPack.identityContext?.domains?.forEach((d: any) => text += `- Expert in: ${d}\n`);
      result.contextPack.projectContext?.forEach((p: any) => text += `- Active Project: ${p.name}\n`);
      result.contextPack.taskContext?.forEach((t: any) => text += `- Active Task: ${t.name}\n`);
      result.contextPack.styleContext?.forEach((s: any) => text += `- Communication Style: ${s}\n`);
      text += `\n`;
    }

    text += `[USER PROMPT]\n${guardrails.length > 0 && guardrails[guardrails.length-1].redactedPrompt ? guardrails[guardrails.length-1].redactedPrompt : prompt}`;
    return text;
  };

  const hasCasualStyle = result?.contextPack?.styleContext?.some((s:string) => s.toLowerCase().includes('casual'));
  const hasProfPolicy = result?.contextPack?.policyContext?.some((p:any) => p.ruleText.toLowerCase().includes('professional'));
  const conflictDetected = hasCasualStyle && hasProfPolicy;

  const lowConfidenceItems = result?.explainabilityReceipt?.filter((i:any) => 
      (i.type === 'Project' || i.type === 'Task') && i.confidence === 'Low'
  ) || [];
  const requiresDisambiguation = lowConfidenceItems.length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-900/40 relative">
      <div className="p-4 border-b border-slate-800/60 bg-slate-900/60 flex justify-between items-center backdrop-blur-md z-10">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
           <svg className="text-fuchsia-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
           Context Pack Engine
        </h2>
        
        <div className="flex bg-slate-950/80 rounded-lg p-1 border border-slate-800">
          <button 
            onClick={() => setMode('demonstration')}
            className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all ${mode === 'demonstration' ? 'bg-fuchsia-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Demonstration
          </button>
          <button 
            onClick={() => setMode('production')}
            className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all ${mode === 'production' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
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
             {mode === 'demonstration' && guardrails.length > 0 && (
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

             {/* Conflict Resolution Visual */}
             {mode === 'demonstration' && conflictDetected && (
                 <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 shadow-xl">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
                        Conflict Detected
                    </h3>
                    <div className="grid grid-cols-[1fr_24px_1fr] gap-2 items-center">
                        <div className="bg-slate-900/80 border border-rose-500/20 p-3 rounded-lg text-center">
                            <span className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">Personal Preference</span>
                            <span className="text-xs font-bold text-rose-400">Casual Communication</span>
                        </div>
                        <div className="flex justify-center text-slate-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13 17 5-5-5-5M6 17l5-5-5-5"/></svg>
                        </div>
                        <div className="bg-slate-900/80 border border-emerald-500/20 p-3 rounded-lg text-center">
                            <span className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">Enterprise Requirement</span>
                            <span className="text-xs font-bold text-emerald-400">Professional Communication</span>
                        </div>
                    </div>
                    <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded p-2 text-center">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Resolution: Enterprise Policy Applied</span>
                    </div>
                 </div>
             )}

              {mode === 'demonstration' ? (
                /* Enterprise Governance Dominant UI */
                <div className="space-y-6">
                    {/* 1. Inheritance Hierarchy */}
                    {result && (
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        </div>
                        <h3 className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                            Inherited Enterprise Context
                        </h3>
                        
                        <div className="space-y-4 relative z-10">
                            <div className="flex items-start gap-3">
                                <div className="mt-1 bg-indigo-500/20 p-1.5 rounded-md text-indigo-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path></svg>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-widest">Organization</span>
                                    <span className="text-sm font-bold text-slate-200">{orgData?.orgName || 'Velocity Media'}</span>
                                </div>
                            </div>
                            
                            <div className="ml-[15px] border-l-2 border-slate-800 pl-6 space-y-4">
                                <div className="flex items-start gap-3 relative">
                                    <div className="absolute -left-[25px] top-3 w-4 h-0.5 bg-slate-800"></div>
                                    <div className="mt-1 bg-fuchsia-500/20 p-1.5 rounded-md text-fuchsia-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-widest">Applied To</span>
                                        <span className="text-sm font-bold text-slate-200">
                                            {result.contextPack.identityContext?.roles?.[0] ? `${userId.split('-')[1].charAt(0).toUpperCase() + userId.split('-')[1].slice(1)}` : userId}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 relative">
                                    <div className="absolute -left-[25px] top-3 w-4 h-0.5 bg-slate-800"></div>
                                    <div className="w-full">
                                        <span className="block text-[10px] text-rose-400 uppercase font-bold tracking-widest mb-2">Inherited Policies</span>
                                        <div className="space-y-1.5">
                                            {result.contextPack.policyContext?.map((p:any, i:number) => (
                                                <div key={i} className="flex items-center gap-2 bg-slate-950/50 border border-slate-800 px-3 py-1.5 rounded-md">
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
                        </div>
                    </div>
                    )}

                    {/* 2. Employee Context (Explainability Receipt Redesign) */}
                    {result && (
                    <div>
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 ml-1">
                            <svg className="text-sky-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                            Assembled Employee Context
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {result.explainabilityReceipt?.filter((i:any) => i.type !== 'Policy').map((item: any, i: number) => {
                                let typeIcon;
                                if (item.type === 'Project') typeIcon = <svg className="text-fuchsia-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
                                else if (item.type === 'Role') typeIcon = <svg className="text-amber-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 15h6"/><path d="M3 19h6"/></svg>;
                                else if (item.type === 'Domain') typeIcon = <svg className="text-sky-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>;
                                else typeIcon = <svg className="text-slate-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>;
                                
                                return (
                                <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-slate-900/40 border border-slate-800/80 hover:bg-slate-900/60 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-950 p-2 rounded-md border border-slate-800">
                                            {typeIcon}
                                        </div>
                                        <div>
                                            <span className="font-semibold text-sm text-slate-200 block">
                                                {item.name}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-medium">
                                                Reason: {item.reasons.join(' • ')}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${item.confidence === 'High' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                        {item.confidence}
                                    </span>
                                </div>
                            )})}
                        </div>
                    </div>
                    )}

                    {/* 3. LLM Payload Preview */}
                    {result && requiresDisambiguation && (
                         <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 shadow-xl mt-6">
                            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                Clarification Required
                            </h3>
                            <p className="text-sm text-slate-300 mb-4">
                                Based on your prompt, we are not fully confident which project you are referring to. Are you asking about <strong>{lowConfidenceItems[0].name}</strong>?
                            </p>
                            <div className="flex gap-3">
                                <button className="bg-emerald-600/80 hover:bg-emerald-500 text-white px-4 py-2 rounded text-xs font-bold transition-all">Yes, use this project</button>
                                <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-xs font-bold transition-all">No, let me specify</button>
                            </div>
                    )}
                    {result && !requiresDisambiguation && (
                    <div className="bg-[#0d1117] rounded-xl p-4 shadow-xl border border-slate-800 mt-6 group">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <svg className="text-fuchsia-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                <h3 className="text-[9px] text-slate-400 uppercase font-mono tracking-widest font-bold">Generated AI Payload</h3>
                            </div>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <pre className="text-[10px] font-mono leading-relaxed text-fuchsia-300/80 whitespace-pre-wrap">
                                {renderPayloadPreview()}
                            </pre>
                        </div>
                    </div>
                    )}
                </div>
             ) : (
                /* Production Context Pack (JSON) */
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
                              sanitizedPrompt: guardrails.length > 0 && guardrails[guardrails.length-1].redactedPrompt ? guardrails[guardrails.length-1].redactedPrompt : prompt
                          }, null, 2)}
                      </pre>
                  </div>
                </div>
                ) : (
                    <div className="bg-[#0d1117] rounded-xl p-4 shadow-2xl border border-slate-800 h-full relative flex items-center justify-center text-slate-500 text-sm">
                        Action blocked by Enterprise Governance. Payload not generated.
                    </div>
                )
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
