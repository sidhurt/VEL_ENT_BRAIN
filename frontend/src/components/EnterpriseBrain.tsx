import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import GraphView from './GraphView';
import MemoryEvolutionPanel from './MemoryEvolutionPanel';
import GovernanceProfile from './GovernanceProfile';
import { loginAs } from '../lib/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function EnterpriseBrain() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'orgs' | 'users' | 'governance' | 'graph' | 'evolution' | 'trust'>('overview');
    
    // Overview Data
    const [stats, setStats] = useState({ users: 0, orgs: 0 });

    // Forms Visibility
    const [showOrgForm, setShowOrgForm] = useState(false);
    const [showUserForm, setShowUserForm] = useState(false);

    // Org Creation Form
    const [orgName, setOrgName] = useState('');
    const [orgPolicies, setOrgPolicies] = useState('');
    const [orgProjects, setOrgProjects] = useState('');
    const [loading, setLoading] = useState(false);

    // User Creation Form
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');
    const [userDomains, setUserDomains] = useState('');
    const [userProjects, setUserProjects] = useState('');
    const [userStyle, setUserStyle] = useState('');
    const [userOrgId, setUserOrgId] = useState('');
    
    // Data for dropdowns and tables
    const [enterprises, setEnterprises] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    
    // Admin context selection (for graph/evolution/governance)
    const [selectedUserId, setSelectedUserId] = useState('');
    const [graphData, setGraphData] = useState<any>(null);

    // Inspection & Deletion Modals
    const [inspectEntity, setInspectEntity] = useState<{type: 'org' | 'user', data: any} | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<{type: 'org' | 'user', data: any} | null>(null);


    // Trust Layer
    const [trustQueue, setTrustQueue] = useState<any[]>([]);

    const loadData = async () => {

        try {
            // Console operates as the admin principal. Must match the backend's
            // ADMIN_PRINCIPALS list — configurable so production can use an
            // unguessable id (set VITE_ADMIN_PRINCIPAL at build time).
            await loginAs(import.meta.env.VITE_ADMIN_PRINCIPAL || 'enterprise-admin');

            const [uRes, eRes, tRes] = await Promise.all([
                axios.get(`${API_URL}/users`),
                axios.get(`${API_URL}/enterprises`),
                axios.get(`${API_URL}/trust/queue`)
            ]);
            setUsers(uRes.data);
            setEnterprises(eRes.data);
            setTrustQueue(tRes.data);

            setStats({ users: uRes.data.length, orgs: eRes.data.length });
            
            if (uRes.data.length > 0 && !selectedUserId) {
                setSelectedUserId(uRes.data[0].id);
            }
        } catch (e: any) {
            console.error(e);
            alert("Failed to load Enterprise Data: " + (e.response?.data?.error || e.message));
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
                userId: 'admin-seed-user',
                orgId: autoOrgId,
                orgName,
                policies: orgPolicies.split('\n').map(s => s.trim()).filter(Boolean),
                projects: orgProjects.split(',').map(s => s.trim()).filter(Boolean)
            });
            setOrgName(''); setOrgPolicies(''); setOrgProjects(''); setShowOrgForm(false);
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
            await axios.post(`${API_URL}/admin/provision-user`, {
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
            setUserName(''); setUserRole(''); setUserDomains(''); setUserProjects(''); setUserStyle(''); setShowUserForm(false);
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    const handleReviewArtifact = async (artifactId: string, action: string) => {
        setLoading(true);
        try {
            await axios.post(`${API_URL}/trust/review/${artifactId}`, { action });
            loadData();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {

        if (!deleteCandidate) return;
        setLoading(true);
        try {
            if (deleteCandidate.type === 'org') {
                await axios.delete(`${API_URL}/enterprises/${deleteCandidate.data.id}`);
            } else {
                await axios.delete(`${API_URL}/users/${deleteCandidate.data.id}`);
            }
            setDeleteCandidate(null);
            setInspectEntity(null);
            loadData();
            loadGraphData();
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
        <div className="flex h-screen bg-[#0b1120] text-slate-300 font-sans">
            
            {/* Sidebar */}
            <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col z-30">
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                            <svg className="text-slate-300" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                        </div>
                        <span className="text-sm font-bold text-slate-100 uppercase tracking-widest">Enterprise Brain</span>
                    </div>
                </div>

                <div className="p-4 border-b border-slate-800/60 bg-slate-900/20">
                    <button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-slate-700/50 hover:bg-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                        ← Back to Workspace
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                    {[
                        { id: 'overview', label: 'Overview', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
                        { id: 'orgs', label: 'Organizations', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
                        { id: 'users', label: 'Users', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' },
                        { id: 'governance', label: 'Governance', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
                        { id: 'trust', label: 'Trust Layer', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
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
                        <div className="max-w-5xl mx-auto space-y-6">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                <h2 className="text-xl font-medium text-slate-100 font-serif">Organizations</h2>
                                <button onClick={() => setShowOrgForm(!showOrgForm)} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors">
                                    {showOrgForm ? 'Cancel' : '+ Create Organization'}
                                </button>
                            </div>

                            {showOrgForm && (
                                <form onSubmit={handleCreateOrg} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg animate-in slide-in-from-top-4 fade-in">
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
                                    <button type="submit" disabled={loading || !orgName} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold uppercase tracking-widest text-xs py-3 rounded-xl disabled:opacity-50 transition-all">
                                        {loading ? 'Creating...' : 'Establish Organization'}
                                    </button>
                                </form>
                            )}

                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-slate-500 uppercase tracking-widest bg-slate-950/50 border-b border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4 font-bold">Organization</th>
                                            <th className="px-6 py-4 font-bold">Members</th>
                                            <th className="px-6 py-4 font-bold">Projects</th>
                                            <th className="px-6 py-4 font-bold">Policies</th>
                                            <th className="px-6 py-4 font-bold">Artifacts</th>
                                            <th className="px-6 py-4 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {enterprises.map(org => (
                                            <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-200">{org.name}</td>
                                                <td className="px-6 py-4 text-slate-400">{org.membersCount || 0}</td>
                                                <td className="px-6 py-4 text-slate-400">{org.projectsCount || 0}</td>
                                                <td className="px-6 py-4 text-slate-400">{org.policiesCount || 0}</td>
                                                <td className="px-6 py-4 text-slate-400">{org.artifactsCount || 0}</td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-3">
                                                    <button onClick={() => setInspectEntity({ type: 'org', data: org })} className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300">View</button>
                                                    <button onClick={() => setDeleteCandidate({ type: 'org', data: org })} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300">Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="max-w-5xl mx-auto space-y-6">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                <h2 className="text-xl font-medium text-slate-100 font-serif">Users</h2>
                                <button onClick={() => setShowUserForm(!showUserForm)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors">
                                    {showUserForm ? 'Cancel' : '+ Provision User'}
                                </button>
                            </div>

                            {showUserForm && (
                                <form onSubmit={handleCreateUser} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg animate-in slide-in-from-top-4 fade-in">
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
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Organization</label>
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
                                    
                                    <button type="submit" disabled={loading || !userName || !userRole} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-widest text-xs py-3 rounded-xl disabled:opacity-50 transition-all">
                                        {loading ? 'Provisioning...' : 'Provision User'}
                                    </button>
                                </form>
                            )}

                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-slate-500 uppercase tracking-widest bg-slate-950/50 border-b border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4 font-bold">Name</th>
                                            <th className="px-6 py-4 font-bold">Role</th>
                                            <th className="px-6 py-4 font-bold">Organization</th>
                                            <th className="px-6 py-4 font-bold">Projects</th>
                                            <th className="px-6 py-4 font-bold">Knowledge Created</th>
                                            <th className="px-6 py-4 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {users.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-200">{u.name}</td>
                                                <td className="px-6 py-4 text-slate-400">{u.role}</td>
                                                <td className="px-6 py-4 text-slate-400">{u.organization}</td>
                                                <td className="px-6 py-4 text-slate-400">{u.projectsCount || 0}</td>
                                                <td className="px-6 py-4 text-slate-400">{u.artifactsCount || 0}</td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-3">
                                                    <button onClick={() => setInspectEntity({ type: 'user', data: u })} className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300">View</button>
                                                    <button onClick={() => openInWorkspace(u.id)} className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300">Login</button>
                                                    <button onClick={() => setDeleteCandidate({ type: 'user', data: u })} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300">Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'governance' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <h2 className="text-xl font-medium text-slate-100 font-serif border-b border-slate-800 pb-4">Governance Profile</h2>
                            <GovernanceProfile apiUrl={API_URL} graphData={graphData} />
                            
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


                    {activeTab === 'trust' && (
                        <div className="max-w-6xl mx-auto space-y-6">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                <h2 className="text-xl font-medium text-slate-100 font-serif">Review Queue (Proposed Knowledge)</h2>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-slate-500 uppercase tracking-widest bg-slate-950/50 border-b border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4 font-bold">Summary</th>
                                            <th className="px-6 py-4 font-bold">Author</th>
                                            <th className="px-6 py-4 font-bold">Source</th>
                                            <th className="px-6 py-4 font-bold">Context Used</th>
                                            <th className="px-6 py-4 font-bold">Date</th>
                                            <th className="px-6 py-4 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {trustQueue.length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No proposed knowledge in the queue.</td></tr>
                                        ) : trustQueue.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-200 max-w-sm truncate" title={item.summary}>{item.summary}</td>
                                                <td className="px-6 py-4 text-slate-400">{item.author}</td>
                                                <td className="px-6 py-4 text-slate-400">
                                                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase">{item.source}</span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    {item.references?.length || 0} nodes
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">{new Date(item.timestamp).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button onClick={() => handleReviewArtifact(item.id, 'Validate')} className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">Validate</button>
                                                    <button onClick={() => handleReviewArtifact(item.id, 'Promote')} className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">Promote</button>
                                                    <button onClick={() => handleReviewArtifact(item.id, 'Reject')} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">Reject</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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

            {/* Inspection Panel Modal */}
            {inspectEntity && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
                            <h2 className="text-xl font-medium text-slate-100 font-serif">
                                {inspectEntity.data.name}
                            </h2>
                            <button onClick={() => setInspectEntity(null)} className="text-slate-500 hover:text-slate-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {inspectEntity.type === 'org' ? (
                                <>
                                    <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                        <span className="text-sm text-slate-400">Members</span>
                                        <span className="text-sm font-bold text-slate-200">{inspectEntity.data.membersCount || 0}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                        <span className="text-sm text-slate-400">Projects</span>
                                        <span className="text-sm font-bold text-slate-200">{inspectEntity.data.projectsCount || 0}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                        <span className="text-sm text-slate-400">Policies</span>
                                        <span className="text-sm font-bold text-slate-200">{inspectEntity.data.policiesCount || 0}</span>
                                    </div>
                                    <div className="flex justify-between pb-2">
                                        <span className="text-sm text-slate-400">Enterprise Knowledge Objects</span>
                                        <span className="text-sm font-bold text-slate-200">{inspectEntity.data.artifactsCount || 0}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                        <span className="text-sm text-slate-400">Role</span>
                                        <span className="text-sm font-bold text-slate-200">{inspectEntity.data.role}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                        <span className="text-sm text-slate-400">Organization</span>
                                        <span className="text-sm font-bold text-slate-200">{inspectEntity.data.organization}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                        <span className="text-sm text-slate-400">Active Projects</span>
                                        <span className="text-sm font-bold text-slate-200">{inspectEntity.data.projectsCount || 0}</span>
                                    </div>
                                    <div className="flex justify-between pb-2">
                                        <span className="text-sm text-slate-400">Authored Knowledge Objects</span>
                                        <span className="text-sm font-bold text-slate-200">{inspectEntity.data.artifactsCount || 0}</span>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="mt-8 text-center">
                            <button onClick={() => setInspectEntity(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors">
                                Close Inspection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Deletion Confirmation Modal */}
            {deleteCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-red-900/50 rounded-2xl p-8 max-w-lg w-full shadow-[0_0_40px_rgba(220,38,38,0.15)] animate-in zoom-in-95">
                        <div className="mb-6">
                            <h2 className="text-xl font-medium text-red-400 font-serif mb-1">
                                Delete {deleteCandidate.type === 'org' ? 'Organization' : 'User'}
                            </h2>
                            <p className="text-2xl font-bold text-slate-100">{deleteCandidate.data.name}</p>
                        </div>
                        
                        <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 mb-8">
                            <p className="text-sm text-red-200/80 mb-3 font-medium">This will permanently remove:</p>
                            <ul className="space-y-2 text-sm text-slate-300">
                                {deleteCandidate.type === 'org' ? (
                                    <>
                                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{deleteCandidate.data.membersCount || 0} Members</li>
                                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{deleteCandidate.data.projectsCount || 0} Projects</li>
                                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{deleteCandidate.data.policiesCount || 0} Policies</li>
                                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{deleteCandidate.data.artifactsCount || 0} Enterprise Knowledge Objects</li>
                                    </>
                                ) : (
                                    <>
                                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>User Identity & Roles</li>
                                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{deleteCandidate.data.projectsCount || 0} Personal Projects</li>
                                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{deleteCandidate.data.artifactsCount || 0} Enterprise Knowledge Links</li>
                                    </>
                                )}
                            </ul>
                            <p className="mt-4 text-xs font-bold text-red-400 uppercase tracking-widest">This action cannot be undone.</p>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setDeleteCandidate(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleDelete} disabled={loading} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50">
                                {loading ? 'Deleting...' : `Delete ${deleteCandidate.type === 'org' ? 'Organization' : 'User'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
