import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import GraphView from './GraphView';
import EnhancementConsole from './EnhancementConsole';
import MemoryEvolutionPanel from './MemoryEvolutionPanel';
import GovernanceProfile from './GovernanceProfile';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function EnterpriseBrain() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'orgs' | 'users' | 'governance' | 'graph' | 'evolution'>('overview');
    
    // Overview Data
    const [stats, setStats] = useState({ users: 0, orgs: 0 });

    // Org Creation Form
    const [orgName, setOrgName] = useState('');
    const [orgPolicies, setOrgPolicies] = useState('');
    const [orgProjects, setOrgProjects] = useState('');
    const [loading, setLoading] = useState(false);
    const [createdOrgId, setCreatedOrgId] = useState('');

    // User Creation Form
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');
    const [userDomains, setUserDomains] = useState('');
    const [userProjects, setUserProjects] = useState('');
    const [userStyle, setUserStyle] = useState('');
    const [userOrgId, setUserOrgId] = useState('');
    const [createdUserId, setCreatedUserId] = useState('');
    
    // Data for dropdowns
    const [enterprises, setEnterprises] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    
    // Admin context selection (for graph/evolution/governance)
    const [selectedUserId, setSelectedUserId] = useState('');
    const [graphData, setGraphData] = useState<any>(null);

    const loadData = async () => {
        try {
            const [uRes, eRes] = await Promise.all([
                axios.get(`${API_URL}/users`),
                axios.get(`${API_URL}/enterprises`)
            ]);
            setUsers(uRes.data);
            setEnterprises(eRes.data);
            setStats({ users: uRes.data.length, orgs: eRes.data.length });
            
            if (uRes.data.length > 0 && !selectedUserId) {
                setSelectedUserId(uRes.data[0].id);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const loadGraphData = async () => {
        if (!selectedUserId) return;
        try {
            const res = await axios.get(`${API_URL}/graph/${selectedUserId}`);
            setGraphData(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (['graph', 'evolution', 'governance'].includes(activeTab)) {
            loadGraphData();
        }
    }, [selectedUserId, activeTab]);

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const autoOrgId = 'org-' + orgName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        try {
            await axios.post(`${API_URL}/onboard/enterprise`, {
                userId: 'admin-seed-user', // temporary user to bind enterprise node initially if needed
                orgId: autoOrgId,
                orgName,
                policies: orgPolicies.split('\n').map(s => s.trim()).filter(Boolean),
                projects: orgProjects.split(',').map(s => s.trim()).filter(Boolean)
            });
            setCreatedOrgId(autoOrgId);
            setOrgName(''); setOrgPolicies(''); setOrgProjects('');
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const autoUserId = 'user-' + userName.toLowerCase().replace(/[^a-z0-9]/g, '');

        try {
            await axios.post(`${API_URL}/onboard/personal`, {
                userId: autoUserId,
                name: userName,
                role: userRole,
                domains: userDomains.split(',').map(s => s.trim()).filter(Boolean),
                projects: userProjects.split(',').map(s => s.trim()).filter(Boolean),
                tasks: [],
                style: userStyle
            });

            if (userOrgId) {
                await axios.post(`${API_URL}/enterprise/attach-user`, {
                    userId: autoUserId,
                    orgId: userOrgId
                });
            }

            setCreatedUserId(autoUserId);
            setUserName(''); setUserRole(''); setUserDomains(''); setUserProjects(''); setUserStyle('');
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPolicy = async (policyText: string) => {
        if (!selectedUserId || !policyText.trim()) return;
        try {
            await axios.post(`${API_URL}/forms/enterprise/policy`, {
                userId: selectedUserId,
                text: policyText
            });
            loadGraphData();
        } catch(e) { console.error(e); }
    };

    const openInWorkspace = (uid: string) => {
        localStorage.setItem('vel_userId', uid);
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 flex font-sans selection:bg-fuchsia-500/30">
            
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800/60 flex flex-col z-10">
                <div className="p-6 border-b border-slate-800/60">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_15px_rgba(192,38,211,0.5)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </div>
                        <h1 className="text-sm font-bold text-slate-200">Enterprise Brain</h1>
                    </div>
                    <Link to="/" className="text-[10px] uppercase font-bold text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Workspace
                    </Link>
                </div>
                
                <nav className="flex-1 p-4 space-y-2">
                    {[
                        { id: 'overview', label: 'Overview', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
                        { id: 'orgs', label: 'Organizations', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
                        { id: 'users', label: 'Users', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' },
                        { id: 'governance', label: 'Governance', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
                        { id: 'graph', label: 'Neural Graph', icon: 'M18 10a8 8 0 1 0-12 0' },
                        { id: 'evolution', label: 'Memory Evolution', icon: 'M23 4v6h-6' },
                    ].map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === item.id ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}></path></svg>
                            {item.label}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Panel */}
            <main className="flex-1 flex flex-col bg-[#0b1120] relative h-screen">
                
                {['graph', 'evolution', 'governance'].includes(activeTab) && (
                    <div className="absolute top-4 right-4 z-20 flex gap-4">
                        <select 
                            value={selectedUserId} 
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-fuchsia-500 shadow-xl"
                        >
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                )}

                <div className="flex-1 overflow-auto custom-scrollbar p-8">
                    
                    {activeTab === 'overview' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <h2 className="text-xl font-medium text-slate-100 font-serif border-b border-slate-800 pb-4">Enterprise Overview</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
                                    <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Total Users</h3>
                                    <p className="text-4xl font-light text-fuchsia-400">{stats.users}</p>
                                </div>
                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
                                    <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Organizations</h3>
                                    <p className="text-4xl font-light text-indigo-400">{stats.orgs}</p>
                                </div>
                            </div>
                            <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center mt-8">
                                <button 
                                    onClick={async () => {
                                        await axios.post(`${API_URL}/onboard/demo-personas`);
                                        loadData();
                                        alert('Demo Personas (Emma, Siddharth, Michael) seeded successfully!');
                                    }}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors border border-slate-700 mb-2"
                                >
                                    Seed Demo Graph
                                </button>
                                <p className="text-xs text-slate-500 max-w-md">Initialize the Neo4j Graph with sample data to test the end-to-end Enterprise Brain.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'orgs' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <h2 className="text-xl font-medium text-slate-100 font-serif border-b border-slate-800 pb-4">Create Organization</h2>
                            
                            {createdOrgId && (
                                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 flex justify-between items-center animate-in fade-in">
                                    <div>
                                        <h3 className="text-sm font-bold text-emerald-400">Organization Created</h3>
                                        <p className="text-xs text-emerald-200/60 mt-0.5">ID: {createdOrgId}</p>
                                    </div>
                                    <button onClick={() => setCreatedOrgId('')} className="text-emerald-400 hover:text-emerald-300 text-xs font-bold uppercase tracking-widest">Dismiss</button>
                                </div>
                            )}

                            <form onSubmit={handleCreateOrg} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Organization Name</label>
                                    <input required value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Velocity Media" className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-fuchsia-500 shadow-inner" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Enterprise Projects <span className="normal-case opacity-60">(comma sep)</span></label>
                                    <input value={orgProjects} onChange={e => setOrgProjects(e.target.value)} placeholder="Q4 Rebrand, Security Audit" className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-fuchsia-500 shadow-inner" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Mandatory Policies <span className="normal-case opacity-60">(one per line)</span></label>
                                    <textarea value={orgPolicies} onChange={e => setOrgPolicies(e.target.value)} placeholder="No speculation presented as fact.&#10;Professional communication only." rows={4} className="w-full resize-none bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-fuchsia-500 shadow-inner" />
                                </div>
                                <button type="submit" disabled={loading || !orgName} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold uppercase tracking-widest text-xs py-3 rounded-xl disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(192,38,211,0.4)]">
                                    {loading ? 'Creating...' : 'Establish Organization'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <h2 className="text-xl font-medium text-slate-100 font-serif border-b border-slate-800 pb-4">Provision User</h2>
                            
                            {createdUserId && (
                                <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 flex justify-between items-center animate-in fade-in">
                                    <div>
                                        <h3 className="text-sm font-bold text-indigo-400">User Created</h3>
                                        <p className="text-xs text-indigo-200/60 mt-0.5">ID: {createdUserId}</p>
                                    </div>
                                    <button onClick={() => openInWorkspace(createdUserId)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors shadow-lg">
                                        Open in Workspace →
                                    </button>
                                </div>
                            )}

                            <form onSubmit={handleCreateUser} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Full Name</label>
                                        <input required value={userName} onChange={e => setUserName(e.target.value)} placeholder="Sarah Chen" className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 shadow-inner" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Role</label>
                                        <input required value={userRole} onChange={e => setUserRole(e.target.value)} placeholder="Product Manager" className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 shadow-inner" />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Attach to Organization</label>
                                    <select value={userOrgId} onChange={e => setUserOrgId(e.target.value)} className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 shadow-inner">
                                        <option value="">(None)</option>
                                        {enterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Domains</label>
                                        <input value={userDomains} onChange={e => setUserDomains(e.target.value)} placeholder="Product, AI" className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 shadow-inner" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Projects</label>
                                        <input value={userProjects} onChange={e => setUserProjects(e.target.value)} placeholder="Q3 Roadmap" className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 shadow-inner" />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Personal Style</label>
                                    <textarea value={userStyle} onChange={e => setUserStyle(e.target.value)} placeholder="Direct, bullet points" rows={2} className="w-full resize-none bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 shadow-inner" />
                                </div>

                                <button type="submit" disabled={loading || !userName || !userRole} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-widest text-xs py-3 rounded-xl disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                                    {loading ? 'Provisioning...' : 'Provision User Node'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'governance' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <h2 className="text-xl font-medium text-slate-100 font-serif border-b border-slate-800 pb-4">Governance Profile</h2>
                            <GovernanceProfile userId={selectedUserId} graphData={graphData} />
                            
                            {/* Inline Policy Add */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mt-6">
                                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <svg className="text-emerald-500" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Inject Organization Policy
                                </h3>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const input = (e.target as HTMLFormElement).elements.namedItem('policyText') as HTMLInputElement;
                                    handleAddPolicy(input.value);
                                    input.value = '';
                                }} className="flex gap-2">
                                    <input name="policyText" required placeholder="e.g. Do not share financial data." className="flex-1 bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors">Apply</button>
                                </form>
                            </div>
                        </div>
                    )}

                    {activeTab === 'graph' && (
                        <div className="h-full max-h-[800px] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative bg-black/50">
                            {graphData ? <GraphView data={graphData} /> : <div className="p-8 text-center text-slate-500">Select a user to view Neural Graph.</div>}
                        </div>
                    )}

                    {activeTab === 'evolution' && (
                        <div className="max-w-4xl mx-auto h-full max-h-[800px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                            {selectedUserId ? <MemoryEvolutionPanel userId={selectedUserId} apiUrl={API_URL} /> : <div className="p-8 text-center text-slate-500">Select a user to view Memory Evolution.</div>}
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
