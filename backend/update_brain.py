import re

file_path = r"d:\ProjectNecessity\VelEntRun\frontend\src\components\EnterpriseBrain.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add activeTab 'trust'
content = content.replace(
    "const [activeTab, setActiveTab] = useState<'overview' | 'orgs' | 'users' | 'governance' | 'graph' | 'evolution'>('overview');",
    "const [activeTab, setActiveTab] = useState<'overview' | 'orgs' | 'users' | 'governance' | 'graph' | 'evolution' | 'trust'>('overview');"
)

# 2. Add Trust Queue State & Fetching
trust_state = """
    // Trust Layer
    const [trustQueue, setTrustQueue] = useState<any[]>([]);

    const loadData = async () => {
"""
content = content.replace("    const loadData = async () => {", trust_state)

fetch_logic = """
            const [uRes, eRes, tRes] = await Promise.all([
                axios.get(`${API_URL}/users`),
                axios.get(`${API_URL}/enterprises`),
                axios.get(`${API_URL}/trust/queue`)
            ]);
            setUsers(uRes.data);
            setEnterprises(eRes.data);
            setTrustQueue(tRes.data);
"""
content = re.sub(r"            const \[uRes, eRes\] = await Promise\.all\(\[\s*axios\.get\(`\$\{API_URL\}/users`\),\s*axios\.get\(`\$\{API_URL\}/enterprises`\)\s*\]\);\s*setUsers\(uRes\.data\);\s*setEnterprises\(eRes\.data\);", fetch_logic, content)

# 3. Add handleReviewArtifact
review_func = """
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
"""
content = content.replace("    const handleDelete = async () => {", review_func)

# 4. Add Sidebar Tab
sidebar_tabs_old = """                        { id: 'governance', label: 'Governance', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },"""
sidebar_tabs_new = sidebar_tabs_old + """\n                        { id: 'trust', label: 'Trust Layer', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },"""
content = content.replace(sidebar_tabs_old, sidebar_tabs_new)

# 5. Add Trust Tab Content
trust_tab = """
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
"""
content = content.replace("                    {activeTab === 'graph' && (", trust_tab)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated EnterpriseBrain.tsx")
