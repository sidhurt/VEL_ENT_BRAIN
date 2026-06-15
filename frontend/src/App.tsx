import { useState, useEffect } from 'react'
import axios from 'axios'
import GraphView from './components/GraphView'
import EnhancementConsole from './components/EnhancementConsole'
import MemoryEvolutionPanel from './components/MemoryEvolutionPanel'
import Onboarding from './components/Onboarding'
import GovernanceProfile from './components/GovernanceProfile'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function App() {
  const [userId, setUserId] = useState('')
  const [graphData, setGraphData] = useState<any>(null)
  const [rightPanelTab, setRightPanelTab] = useState<'console' | 'evolution'>('console')

  const loadData = async () => {
    if (!userId) {
        setGraphData(null);
        return;
    }
    try {
      const graphRes = await axios.get(`${API_URL}/graph/${userId}`)
      setGraphData(graphRes.data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [userId])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Sleek Glassmorphic Header */}
      <header className="glass sticky top-0 z-50 px-8 py-4 flex justify-between items-center border-b border-slate-800/60 shadow-lg">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent tracking-wide">
                ThinkVelocity Unified Brain
            </h1>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={async () => {
                    await axios.post(`${API_URL}/onboard/demo-personas`);
                    alert('Demo Personas (Emma, Siddharth, Michael) have been seeded!');
                }}
                className="mr-2 text-[10px] uppercase font-bold text-slate-500 hover:text-indigo-400 transition-colors border border-slate-800 px-2 py-1 rounded"
                title="Initialize the Neo4j Graph with Demo Personas"
            >
                Seed Demo Graph
            </button>
            <div className="flex gap-1 items-center bg-slate-900/50 p-1 rounded-lg border border-slate-800/80 shadow-inner">
                <button 
                    onClick={() => setUserId('user-emma')} 
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${userId === 'user-emma' ? 'bg-fuchsia-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                >
                    Emma (Content)
                </button>
                <button 
                    onClick={() => setUserId('user-siddharth')} 
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${userId === 'user-siddharth' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                >
                    Siddharth (Architect)
                </button>
                <button 
                    onClick={() => setUserId('user-michael')} 
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${userId === 'user-michael' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                >
                    Michael (Success)
                </button>
                <form 
                    onSubmit={(e) => { 
                        e.preventDefault(); 
                        const val = (e.target as any).elements.uid.value.trim(); 
                        if(val) setUserId(val); 
                    }} 
                    className="flex items-center ml-2 border-l border-slate-700/50 pl-3"
                >
                    <input name="uid" type="text" placeholder="Custom User ID..." className="bg-slate-950 border border-slate-700/50 text-xs px-2 py-1.5 rounded-l-md text-slate-300 w-32 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 shadow-inner" />
                    <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-wider px-2 py-1.5 rounded-r-md text-[10px] border border-l-0 border-slate-700/50 transition-colors">Load</button>
                </form>
            </div>
            {userId && <div className="ml-2 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse shrink-0"></div>}
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 h-[calc(100vh-73px)] relative z-10 overflow-hidden">
        
        {/* Left Col: Onboarding */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          <div className="mb-2 px-1">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">Seed the Brain</h2>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">Initialize a new Context Graph from scratch.</p>
          </div>
          <Onboarding apiUrl={API_URL} onComplete={loadData} onUserChange={setUserId} />
        </div>

        {/* Mid Col: Dual-Pane Validation (Ledger + Graph) */}
        <div className="col-span-5 flex flex-col gap-4">
          
          {/* Top Half: Governance Profile Ledger */}
          <div className="h-[45%] glass-panel rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none"></div>
              <GovernanceProfile graphData={graphData} />
          </div>

          {/* Bottom Half: Graph Vis */}
          <div className="h-[55%] glass-panel rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>

            <div className="p-3 border-b border-slate-800/60 bg-slate-900/40 flex justify-between items-center backdrop-blur-md z-10">
              <h2 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                 <svg className="text-indigo-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path></svg>
                 Graph Architecture
              </h2>
              <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <span className="text-[9px] text-indigo-400 uppercase tracking-widest font-bold">Live View</span>
              </div>
            </div>

            <div className="flex-1 relative z-0">
               {graphData ? <GraphView data={graphData} /> : <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-600 font-medium">Enter a User ID to load the graph</div>}
            </div>
          </div>
        </div>

        {/* Right Col: Enhance Console / Evolution Panel */}
        <div className="col-span-4 glass-panel rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
            
            {/* Top Level Tab Bar */}
            <div className="flex bg-slate-900/80 border-b border-slate-800/60 backdrop-blur-md z-20">
              <button 
                onClick={() => setRightPanelTab('console')}
                className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-all ${rightPanelTab === 'console' ? 'bg-indigo-600/20 text-indigo-300 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border-b-2 border-transparent'}`}
              >
                Pipeline Simulator
              </button>
              <button 
                onClick={() => setRightPanelTab('evolution')}
                className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold transition-all ${rightPanelTab === 'evolution' ? 'bg-emerald-600/20 text-emerald-300 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border-b-2 border-transparent'}`}
              >
                Memory Evolution
              </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {rightPanelTab === 'console' ? (
                  <EnhancementConsole userId={userId} apiUrl={API_URL} />
              ) : (
                  <MemoryEvolutionPanel userId={userId} apiUrl={API_URL} />
              )}
            </div>
        </div>

      </main>

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-fuchsia-600/10 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>
    </div>
  )
}

export default App
