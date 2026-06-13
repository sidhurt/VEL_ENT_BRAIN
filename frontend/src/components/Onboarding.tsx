import { useState } from 'react';
import axios from 'axios';

const InputLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{children}</label>
);

const InputField = (props: any) => (
  <input 
    {...props} 
    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
  />
);

const TextArea = (props: any) => (
  <textarea 
    {...props} 
    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner resize-none"
  />
);

export default function Onboarding({ apiUrl, onComplete, onUserChange }: { apiUrl: string, onComplete: () => void, onUserChange: (userId: string) => void }) {
  const [activeTab, setActiveTab] = useState<'personal' | 'enterprise'>('personal');
  const [loading, setLoading] = useState(false);

  // Personal Form State
  const [pUserId, setPUserId] = useState('');
  const [pName, setPName] = useState('');
  const [pRole, setPRole] = useState('');
  const [pDomains, setPDomains] = useState('');
  const [pProjects, setPProjects] = useState('');
  const [pTasks, setPTasks] = useState('');
  const [pStyle, setPStyle] = useState('');

  // Enterprise Form State
  const [eOrgId, setEOrgId] = useState('');
  const [eOrgName, setEOrgName] = useState('');
  const [ePolicies, setEPolicies] = useState('');
  const [eProjects, setEProjects] = useState('');

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pUserId) return;
    setLoading(true);
    try {
        await axios.post(`${apiUrl}/onboard/personal`, {
            userId: pUserId,
            name: pName,
            role: pRole,
            domains: pDomains.split(',').map(s => s.trim()).filter(Boolean),
            projects: pProjects.split(',').map(s => s.trim()).filter(Boolean),
            tasks: pTasks.split(',').map(s => s.trim()).filter(Boolean),
            style: pStyle
        });
        onUserChange(pUserId);
        onComplete();
        setPUserId(''); setPName(''); setPRole(''); setPDomains(''); setPProjects(''); setPTasks(''); setPStyle('');
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const handleEnterpriseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eOrgId) return;
    setLoading(true);
    
    // We need an active user to bind the organization to.
    const activeUserId = pUserId || prompt("Enter the User ID that belongs to this Organization:", "user-siddharth");
    if (!activeUserId) { setLoading(false); return; }

    try {
        await axios.post(`${apiUrl}/onboard/enterprise`, {
            userId: activeUserId,
            orgId: eOrgId,
            orgName: eOrgName,
            policies: ePolicies.split('\n').map(s => s.trim()).filter(Boolean),
            projects: eProjects.split(',').map(s => s.trim()).filter(Boolean)
        });
        onUserChange(activeUserId);
        onComplete();
        setEOrgId(''); setEOrgName(''); setEPolicies(''); setEProjects('');
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl relative">
      
      {/* Segmented Control Tabs */}
      <div className="p-2 bg-slate-900/40 border-b border-slate-800/60 backdrop-blur-md">
        <div className="flex bg-slate-950/50 rounded-lg p-1 border border-slate-800/50">
            <button 
                className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'personal' ? 'bg-slate-800 text-indigo-400 shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                onClick={() => setActiveTab('personal')}>Personal Brain</button>
            <button 
                className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'enterprise' ? 'bg-slate-800 text-fuchsia-400 shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                onClick={() => setActiveTab('enterprise')}>Enterprise Brain</button>
        </div>
      </div>

      <div className="p-4 relative z-10">
        {activeTab === 'personal' && (
          <form onSubmit={handlePersonalSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <InputLabel>User ID</InputLabel>
                    <InputField required value={pUserId} onChange={(e:any) => setPUserId(e.target.value)} placeholder="user-siddharth" />
                </div>
                <div>
                    <InputLabel>Name</InputLabel>
                    <InputField value={pName} onChange={(e:any) => setPName(e.target.value)} placeholder="Siddharth S." />
                </div>
            </div>
            <div>
                <InputLabel>Role</InputLabel>
                <InputField value={pRole} onChange={(e:any) => setPRole(e.target.value)} placeholder="Enterprise Architect" />
            </div>
            <div>
                <InputLabel>Domains <span className="normal-case text-slate-500 font-medium tracking-normal">(comma sep)</span></InputLabel>
                <InputField value={pDomains} onChange={(e:any) => setPDomains(e.target.value)} placeholder="SAP, BTP, AI" />
            </div>
            <div>
                <InputLabel>Projects <span className="normal-case text-slate-500 font-medium tracking-normal">(comma sep)</span></InputLabel>
                <InputField value={pProjects} onChange={(e:any) => setPProjects(e.target.value)} placeholder="Unified Brain, DMS Integration" />
            </div>
            <div>
                <InputLabel>Tasks <span className="normal-case text-slate-500 font-medium tracking-normal">(comma sep)</span></InputLabel>
                <InputField value={pTasks} onChange={(e:any) => setPTasks(e.target.value)} placeholder="Architecture Review" />
            </div>
            <div>
                <InputLabel>Personal Style</InputLabel>
                <TextArea value={pStyle} onChange={(e:any) => setPStyle(e.target.value)} placeholder="Direct, structured, bullet points..." rows={2} />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-widest text-xs py-3 px-4 rounded-xl disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:shadow-[0_0_25px_rgba(79,70,229,0.6)] mt-2">
                {loading ? 'Initializing Core...' : 'Generate Neural Graph'}
            </button>
          </form>
        )}

        {activeTab === 'enterprise' && (
          <form onSubmit={handleEnterpriseSubmit} className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <InputLabel>Org ID</InputLabel>
                    <InputField required value={eOrgId} onChange={(e:any) => setEOrgId(e.target.value)} placeholder="org-velocity" />
                </div>
                <div>
                    <InputLabel>Org Name</InputLabel>
                    <InputField value={eOrgName} onChange={(e:any) => setEOrgName(e.target.value)} placeholder="Velocity Media" />
                </div>
            </div>
            <div>
                <InputLabel>Enterprise Projects <span className="normal-case text-slate-500 font-medium tracking-normal">(comma sep)</span></InputLabel>
                <InputField value={eProjects} onChange={(e:any) => setEProjects(e.target.value)} placeholder="Q4 Rebrand, Security Audit" />
            </div>
            <div>
                <InputLabel>Policies & Guidelines <span className="normal-case text-slate-500 font-medium tracking-normal">(1 per line)</span></InputLabel>
                <TextArea value={ePolicies} onChange={(e:any) => setEPolicies(e.target.value)} placeholder="No speculation presented as fact.&#10;Professional communication only." rows={5} />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold uppercase tracking-widest text-xs py-3 px-4 rounded-xl disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(192,38,211,0.4)] hover:shadow-[0_0_25px_rgba(192,38,211,0.6)] mt-2">
                {loading ? 'Deploying...' : 'Establish Enterprise Node'}
            </button>
          </form>
        )}
      </div>

      <div className="p-3 bg-slate-950/80 border-t border-slate-800/50 flex justify-center backdrop-blur-md">
          <button 
              onClick={async () => {
                  if (confirm("Are you sure you want to permanently delete all nodes and edges in the graph?")) {
                      await axios.delete(`${apiUrl}/admin/clear`);
                      onUserChange('');
                      onComplete();
                  }
              }}
              className="text-[10px] text-rose-500/70 hover:text-rose-400 font-bold uppercase tracking-widest transition-colors flex items-center gap-1"
          >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Nuke Database (Reset All)
          </button>
      </div>
    </div>
  );
}
