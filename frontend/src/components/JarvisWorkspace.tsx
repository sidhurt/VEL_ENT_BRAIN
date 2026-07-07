import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import ArtifactPanel from './ArtifactPanel';
import BrainActivityAccordion from './BrainActivityAccordion';
import BrainToast from './BrainToast';
import BrainPanel from './BrainPanel';
import { loginAs, currentPrincipalId } from '../lib/auth';
import GoogleSignIn from './GoogleSignIn';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function JarvisWorkspace() {
  const [userId, setUserId] = useState(() => localStorage.getItem('vel_userId') || '');
  const [identity, setIdentity] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeWork, setActiveWork] = useState<any>(null);
  
  // Phase 7 State
  const [workspaceState, setWorkspaceState] = useState<any>(null);
  const [timelineArtifacts, setTimelineArtifacts] = useState<any[]>([]);
  const [pipelineTrace, setPipelineTrace] = useState<any[]>([]);

  const [candidates, setCandidates] = useState<any[]>([]);
  const [showBrainPanel, setShowBrainPanel] = useState(false);

  // Setup form
  const [setupUserId, setSetupUserId] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadWorkspace = async () => {
    if (!userId) return;
    localStorage.setItem('vel_userId', userId);

    // Clear previous user's state
    setIdentity(null);
    setWorkspaceState(null);
    setTimelineArtifacts([]);
    setActiveWork(null);
    setPipelineTrace([]);

    // Authenticate as this principal before loading anything.
    // If a valid token for this principal already exists (e.g. Google sign-in
    // just completed), do NOT dev-login over it — that would replace a
    // verified identity with an asserted one (and 403s in production).
    if (currentPrincipalId() !== userId) {
      try {
        await loginAs(userId);
      } catch (err) {
        console.error('Login failed:', err);
        return;
      }
    }

    // Load Identity
    axios.get(`${API_URL}/cards/${userId}`).then(res => setIdentity(res.data)).catch(err => console.error(err));

    // Load Proactive State
    axios.get(`${API_URL}/workspace/state/${userId}`).then(res => setWorkspaceState(res.data)).catch(err => console.error(err));

    // Load Timeline
    axios.get(`${API_URL}/artifacts/${userId}`).then(res => setTimelineArtifacts(res.data)).catch(err => console.error(err));
  };

  useEffect(() => {
    loadWorkspace();
  }, [userId]);

  const handleGenerate = async (presetPrompt?: string) => {
    const finalPromptText = presetPrompt || prompt;
    if (!finalPromptText.trim() || !userId) return;
    setLoading(true);
    setCandidates([]);
    setPipelineTrace([]);
    setActiveWork(null);
    
    // Explicit DLP Check ONLY (no governance policies checked here)
    let isHardStopped = false;
    const openAiKeyRegex = /(sk-|sp-|sk-proj-|sp-proj-)[A-Za-z0-9_-]+/g;
    let finalPrompt = finalPromptText;
    if (openAiKeyRegex.test(finalPrompt)) {
        finalPrompt = finalPrompt.replace(openAiKeyRegex, '[REDACTED_API_KEY]');
        alert('DLP TRIGGERED: API Key detected. Request blocked.');
        isHardStopped = true;
    }

    if (isHardStopped) {
        setLoading(false);
        return;
    }

    try {
      const res = await axios.post(`${API_URL}/enhance`, { userId, prompt: finalPrompt, executionMode: 'execute' });
      
      const newWork = {
          id: Date.now().toString(),
          result: res.data,
          prompt: finalPrompt,
          timestamp: new Date()
      };
      
      setActiveWork(newWork);
      setPipelineTrace(res.data.pipelineTrace || []);
      setPrompt('');

      // Refresh timeline silently to show the new artifact at top
      axios.get(`${API_URL}/artifacts/${userId}`).then(res => setTimelineArtifacts(res.data)).catch(err => console.error(err));

      // Fetch candidates after a short delay
      setTimeout(() => {
          axios.get(`${API_URL}/evolution/${userId}/candidates`).then(candRes => {
              const cands = candRes.data;
              if (cands && cands.length > 0) setCandidates(cands);
          }).catch(err => console.error(err));
      }, 3000);

    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.error || e.message || 'An error occurred during workflow execution.');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (artifactId: string, feedbackType: string) => {
    try {
        await axios.post(`${API_URL}/artifacts/${artifactId}/feedback`, { feedbackType });
        // Optimistically update timeline weight visually
        setTimelineArtifacts(prev => prev.map(a => {
            if (a.id === artifactId) {
                let w = a.weight || 1;
                if (feedbackType === 'Helpful') w += 1;
                if (feedbackType === 'Promote to Enterprise Knowledge') w += 5;
                if (feedbackType === 'Needs Revision') w -= 1;
                if (feedbackType === 'Archive') w -= 10;
                return { ...a, weight: w };
            }
            return a;
        }));
    } catch(e) {
        console.error(e);
    }
  };

  if (!userId) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans text-slate-300">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
                  <div className="flex justify-center mb-6">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      </div>
                  </div>
                  <h1 className="text-xl font-bold text-slate-100 text-center mb-2">Welcome to Jarvis</h1>
                  <p className="text-sm text-slate-400 text-center mb-8">Sign in to connect to the Enterprise Brain.</p>

                  <GoogleSignIn onSignIn={(principal) => setUserId(principal.id)} />

                  <div className="flex items-center gap-3 my-6">
                      <div className="flex-1 h-px bg-slate-800"></div>
                      <span className="text-[10px] uppercase tracking-widest text-slate-600">or dev access</span>
                      <div className="flex-1 h-px bg-slate-800"></div>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); setUserId(setupUserId); }} className="space-y-4">
                      <div>
                          <input 
                              type="text" 
                              value={setupUserId}
                              onChange={e => setSetupUserId(e.target.value)}
                              placeholder="e.g. user-siddharth"
                              className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 shadow-inner"
                          />
                      </div>
                      <button type="submit" disabled={!setupUserId.trim()} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-50">
                          Connect Workspace
                      </button>
                  </form>

                  <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                      <p className="text-xs text-slate-500">Administrator? <Link to="/enterprise" className="text-fuchsia-400 hover:underline">Go to Enterprise Brain</Link></p>
                  </div>
              </div>
          </div>
      );
  }

  const identityName = identity?.role?.data?.name || userId;
  const identityRole = identity?.role?.data?.role || 'Enterprise User';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Workspace Header */}
      <header className="glass sticky top-0 z-40 px-6 py-3 flex justify-between items-center border-b border-slate-800/60 shadow-lg">
        <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            
            <div className="bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300">
                        {identityName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-slate-200">{identityName}</span>
                </div>
                <div className="w-px h-4 bg-slate-700"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">{identityRole}</span>
                <button onClick={() => { localStorage.removeItem('vel_userId'); setUserId(''); setSetupUserId(''); }} className="ml-2 text-[10px] text-slate-500 hover:text-slate-300 underline">Logout</button>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
            <Link to="/enterprise" className="text-[10px] uppercase font-bold text-slate-500 hover:text-fuchsia-400 transition-colors mr-2">
                Enterprise Brain →
            </Link>
            <button 
                onClick={() => setShowBrainPanel(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-fuchsia-500 text-slate-300 hover:text-fuchsia-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
            >
                <svg className="text-fuchsia-500" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                Enterprise State
            </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-4xl mx-auto py-8 px-6 pb-40">
              
              {/* Dynamic Greeting & Proactive Suggestions */}
              {!activeWork && (
                  <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <h1 className="text-3xl font-medium text-slate-100 font-serif mb-3">
                          Good morning, {identityName.split(' ')[0]}.
                      </h1>
                      
                      {workspaceState && (
                          <div className="mt-8">
                              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Enterprise Context (Graph Derived)</h2>
                              <div className="flex flex-wrap gap-3">
                                  {workspaceState.activeProjects?.map((p: any) => (
                                      <button 
                                          key={p.id} 
                                          onClick={() => handleGenerate(`Continue work on project: ${p.name}`)}
                                          className="bg-indigo-950/30 border border-indigo-500/30 hover:border-indigo-400 px-4 py-2 rounded-lg text-sm text-indigo-300 transition-colors text-left flex flex-col"
                                      >
                                          <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest">Active Project</span>
                                          {p.name}
                                      </button>
                                  ))}
                                  {workspaceState.pendingCandidates?.length > 0 && (
                                      <button 
                                          onClick={() => setShowBrainPanel(true)}
                                          className="bg-fuchsia-950/30 border border-fuchsia-500/30 hover:border-fuchsia-400 px-4 py-2 rounded-lg text-sm text-fuchsia-300 transition-colors text-left flex flex-col"
                                      >
                                          <span className="text-[10px] uppercase font-bold text-fuchsia-500 tracking-widest">Candidate Memory</span>
                                          Review {workspaceState.pendingCandidates.length} new insights
                                      </button>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* Explainability Pipeline Trace */}
              {(loading || pipelineTrace.length > 0) && activeWork === null && (
                  <div className="mb-8 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl animate-in fade-in">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                          <svg className={`text-indigo-400 ${loading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                          Cognitive Pipeline Execution
                      </h3>
                      <div className="space-y-3 pl-2 border-l-2 border-slate-800 ml-2">
                          {pipelineTrace.map((trace, i) => (
                              <div key={i} className="flex items-center gap-3 animate-in slide-in-from-left-2">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 -ml-[21px] ring-4 ring-slate-900"></div>
                                  <span className="text-sm font-medium text-slate-300">{trace.step}</span>
                                  {i > 0 && (
                                      <span className="text-xs text-slate-500 font-mono">+{trace.time - pipelineTrace[i-1].time}ms</span>
                                  )}
                                  <svg className="text-emerald-500 ml-auto" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              </div>
                          ))}
                          {loading && (
                              <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse -ml-[21px] ring-4 ring-slate-900"></div>
                                  <span className="text-sm font-medium text-slate-400">Processing...</span>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* Work History Rendering */}
              {activeWork && (
                  <div className="mb-8 space-y-6 animate-in fade-in duration-500">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                              {identityName.charAt(0).toUpperCase()}
                          </div>
                          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-300 max-w-2xl">
                              {activeWork.prompt}
                          </div>
                      </div>

                      <ArtifactPanel outcome={activeWork.result.generatedOutcome} contextPack={activeWork.result.contextPack} />
                      
                      <BrainActivityAccordion result={activeWork.result} />
                  </div>
              )}

              {/* Knowledge Timeline */}
              {!activeWork && timelineArtifacts.length > 0 && (
                  <div className="mt-16">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 border-b border-slate-800 pb-2">Knowledge Timeline (Organizational Memory)</h2>
                      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
                          {timelineArtifacts.map((artifact) => (
                              <div key={artifact.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active animate-in fade-in slide-in-from-bottom-2">
                                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-700 bg-slate-900 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl z-10">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                  </div>
                                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 shadow-lg hover:border-slate-700 transition-colors">
                                      <div className="flex items-center justify-between mb-2">
                                          
                                          <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">{artifact.type}</span>
                                              {artifact.status === 'Proposed' && <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">Proposed</span>}
                                              {artifact.status === 'Validated' && <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">{artifact.authority}</span>}
                                              {artifact.status === 'Rejected' && <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">Rejected</span>}
                                          </div>

                                          <span className="text-[10px] text-slate-500">{new Date(artifact.timestamp).toLocaleString()}</span>
                                      </div>
                                      <h3 className="text-sm font-bold text-slate-200 mb-1">{artifact.prompt}</h3>
                                      <p className="text-xs text-slate-400 mb-4 line-clamp-2">{artifact.knowledgeSummary}</p>
                                      
                                      {artifact.references?.length > 0 && (
                                          <div className="mb-4 space-y-1">
                                              <span className="text-[10px] uppercase font-bold text-slate-500">Knowledge Provenance:</span>
                                              {artifact.references.map((ref: any, i: number) => (
                                                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-2 py-1 rounded">
                                                      <span className="text-emerald-500">↳</span>
                                                      <span className="opacity-60">{ref.type === 'REFERENCES' ? 'Referenced' : ref.type === 'COMPLIES_WITH' ? 'Complied with' : 'Related to'}</span>
                                                      <span className="font-medium text-indigo-300">{ref.contextName}</span>
                                                  </div>
                                              ))}
                                          </div>
                                      )}

                                      <div className="mt-4 pt-4 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-500 bg-slate-950/50 p-2 rounded-lg">
                                          <div>Model: <span className="text-slate-300">{artifact.generationModel || 'Unknown'}</span></div>
                                          <div>Brain Ver: <span className="text-slate-300">{artifact.brainVersion || 'v1.0'}</span></div>
                                          <div className="truncate" title={artifact.promptHash}>Hash: <span className="text-slate-300">{artifact.promptHash || 'N/A'}</span></div>
                                          <div>Confidence: <span className="text-emerald-400">{artifact.retrievalConfidence || '0'}%</span></div>
                                      </div>

                                      <div className="flex items-center gap-2 pt-4 mt-auto">
                                          <button onClick={() => handleFeedback(artifact.id, 'Helpful')} className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-widest">Helpful</button>
                                          <button onClick={() => handleFeedback(artifact.id, 'Needs Revision')} className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-widest">Revise</button>
                                          <button onClick={() => handleFeedback(artifact.id, 'Promote to Enterprise Knowledge')} className="ml-auto text-[10px] px-2 py-1 rounded bg-fuchsia-900/30 hover:bg-fuchsia-900/50 text-fuchsia-300 border border-fuchsia-500/30 font-bold uppercase tracking-widest flex items-center gap-1">
                                              Reinforce
                                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                          </button>
                                      </div>
                                      <div className="text-[10px] text-right mt-2 text-slate-500">Graph Weight: {artifact.weight}</div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              <div ref={messagesEndRef} />
          </div>
      </main>

      {/* Composer Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pt-10 pb-6 px-6 z-30 pointer-events-none">
          <div className="max-w-4xl mx-auto relative pointer-events-auto">
              {activeWork && (
                  <button onClick={() => { setActiveWork(null); setPipelineTrace([]); }} className="absolute -top-12 left-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-200 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
                      ← Back to Workspace
                  </button>
              )}
              <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Execute enterprise workflow or generate artifact..."
                  className="w-full resize-none rounded-xl bg-slate-900/90 border border-slate-700/80 p-5 pr-48 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xl text-sm text-slate-200 placeholder:text-slate-500 transition-all backdrop-blur-xl"
                  rows={3}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleGenerate();
                      }
                  }}
              />
              <div className="absolute bottom-5 right-5">
                  <button 
                      disabled={loading || !prompt.trim()}
                      onClick={() => handleGenerate()}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                      {loading ? 'Executing...' : 'Execute Workflow →'}
                  </button>
              </div>
          </div>
      </footer>

      <BrainToast 
          candidates={candidates} 
          onReview={() => { setShowBrainPanel(true); setCandidates([]); }} 
          onClose={() => setCandidates([])} 
      />

      {showBrainPanel && <BrainPanel userId={userId} apiUrl={API_URL} onClose={() => setShowBrainPanel(false)} />}

    </div>
  );
}
