import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { loginAs, currentPrincipalId } from '../lib/auth';
import GoogleSignIn from './GoogleSignIn';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ============================================================================
// CLIENT ROOM — the front door to the Client Brain.
// One screen: pick a client, see its brain, upload docs to teach it, review
// what gets in, and generate on-brand work with a receipt proving what was used
// and that no other client's knowledge was touched.
// ============================================================================

type Kind = 'voice' | 'rule' | 'fact' | 'learning';
const KIND_LABEL: Record<Kind, string> = { voice: 'Brand Voice', rule: 'Hard Rules', fact: 'Facts', learning: 'Learnings' };
const KIND_ACCENT: Record<Kind, string> = {
    voice: 'text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/10',
    rule: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
    fact: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
    learning: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
};

interface Client { id: string; name: string; industry?: string; activeKnowledge: number; pendingReview: number; }

export default function ClientRoom() {
    const [principalId, setPrincipalId] = useState<string | null>(currentPrincipalId());
    const [devId, setDevId] = useState('user-siddharth');

    const [clients, setClients] = useState<Client[]>([]);
    const [selected, setSelected] = useState<Client | null>(null);
    const [brain, setBrain] = useState<Record<Kind, any[]>>({ voice: [], rule: [], fact: [], learning: [] });
    const [queue, setQueue] = useState<any[]>([]);

    const [prompt, setPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<{ outcome: string; receipt: any } | null>(null);

    const [busy, setBusy] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [showNewClient, setShowNewClient] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const notify = (e: any) => alert(e.response?.data?.error || e.message || 'Something went wrong');

    // --- data loaders ---
    const loadClients = async () => {
        try { setClients((await axios.get(`${API_URL}/clients`)).data); }
        catch (e) { notify(e); }
    };
    const openClient = async (c: Client) => {
        setSelected(c); setResult(null); setPrompt('');
        try {
            const [b, q] = await Promise.all([
                axios.get(`${API_URL}/clients/${c.id}/brain`),
                axios.get(`${API_URL}/clients/${c.id}/review-queue`),
            ]);
            setBrain(b.data.brain); setQueue(q.data);
        } catch (e) { notify(e); }
    };
    const refreshSelected = async () => { if (selected) { await openClient(selected); await loadClients(); } };

    useEffect(() => { if (principalId) loadClients(); }, [principalId]);

    // --- actions ---
    const createClient = async () => {
        if (!newClientName.trim()) return;
        setBusy(true);
        try {
            await axios.post(`${API_URL}/clients`, { name: newClientName.trim() });
            setNewClientName(''); setShowNewClient(false);
            await loadClients();
        } catch (e) { notify(e); } finally { setBusy(false); }
    };

    const uploadDoc = async (file: File) => {
        if (!selected) return;
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await axios.post(`${API_URL}/clients/${selected.id}/ingest-file`, fd);
            alert(`Extracted ${res.data.extracted} candidate${res.data.extracted === 1 ? '' : 's'} from ${res.data.file}. Review them below.`);
            await refreshSelected();
        } catch (e) { notify(e); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
    };

    const review = async (knowledgeId: string, action: 'approve' | 'reject') => {
        setBusy(true);
        try {
            await axios.post(`${API_URL}/knowledge/${knowledgeId}/review`, { action });
            await refreshSelected();
        } catch (e) { notify(e); } finally { setBusy(false); }
    };

    const generate = async () => {
        if (!selected || !prompt.trim()) return;
        setGenerating(true); setResult(null);
        try {
            const res = await axios.post(`${API_URL}/clients/${selected.id}/enhance`, { prompt: prompt.trim(), executionMode: 'execute' });
            setResult({ outcome: res.data.generatedOutcome, receipt: res.data.receipt });
            await loadClients();
        } catch (e) { notify(e); } finally { setGenerating(false); }
    };

    // --- login gate ---
    if (!principalId) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans text-slate-300 px-4">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
                    <h1 className="text-2xl font-bold text-slate-100 text-center mb-1">Client Room</h1>
                    <p className="text-sm text-slate-400 text-center mb-8">Sign in to open your client brains.</p>
                    <GoogleSignIn onSignIn={(p) => setPrincipalId(p.id)} />
                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-slate-800" />
                        <span className="text-[10px] uppercase tracking-widest text-slate-600">or dev access</span>
                        <div className="flex-1 h-px bg-slate-800" />
                    </div>
                    <form onSubmit={async (e) => { e.preventDefault(); try { const p = await loginAs(devId.trim()); setPrincipalId(p.id); } catch (err) { notify(err); } }} className="flex gap-2">
                        <input value={devId} onChange={(e) => setDevId(e.target.value)} placeholder="user-siddharth"
                            className="flex-1 bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                        <button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 rounded-lg text-sm">Enter</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex">
            {/* Sidebar: clients */}
            <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
                <div className="h-16 flex items-center px-5 border-b border-slate-800 justify-between">
                    <span className="font-bold text-slate-100">Client Room</span>
                    <button onClick={() => setShowNewClient(v => !v)} className="text-xs text-indigo-400 hover:text-indigo-300">+ New</button>
                </div>
                {showNewClient && (
                    <div className="p-3 border-b border-slate-800 flex gap-2">
                        <input autoFocus value={newClientName} onChange={e => setNewClientName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createClient()} placeholder="Client name"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500" />
                        <button onClick={createClient} disabled={busy} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 rounded disabled:opacity-50">Add</button>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto">
                    {clients.length === 0 && <p className="text-sm text-slate-600 p-5">No clients yet. Add one to start.</p>}
                    {clients.map(c => (
                        <button key={c.id} onClick={() => openClient(c)}
                            className={`w-full text-left px-5 py-3 border-b border-slate-900 hover:bg-slate-900 transition-colors ${selected?.id === c.id ? 'bg-slate-900' : ''}`}>
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-200">{c.name}</span>
                                {c.pendingReview > 0 && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">{c.pendingReview} to review</span>}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{c.industry || 'Client account'} · {c.activeKnowledge} in brain</div>
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-800 text-xs text-slate-600 truncate">Signed in as {principalId}</div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-y-auto">
                {!selected ? (
                    <div className="h-full flex items-center justify-center text-slate-600">Select a client to open its brain.</div>
                ) : (
                    <div className="max-w-5xl mx-auto p-8 space-y-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-100">{selected.name}</h1>
                                <p className="text-sm text-slate-500">{selected.industry || 'Client account'}</p>
                            </div>
                            <div>
                                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden"
                                    onChange={e => e.target.files?.[0] && uploadDoc(e.target.files[0])} />
                                <button onClick={() => fileRef.current?.click()} disabled={busy}
                                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm px-4 py-2 rounded-lg disabled:opacity-50">
                                    {busy ? 'Working…' : '↑ Upload document'}
                                </button>
                            </div>
                        </div>

                        {/* Ask box */}
                        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                            <label className="text-sm font-semibold text-slate-200">Generate on-brand work</label>
                            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
                                placeholder={`e.g. Write 3 launch captions for ${selected.name}'s new product`}
                                className="w-full mt-2 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 resize-none" />
                            <button onClick={generate} disabled={generating || !prompt.trim()}
                                className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                                {generating ? 'Generating…' : 'Generate'}
                            </button>

                            {result && (
                                <div className="mt-5 space-y-4">
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 whitespace-pre-wrap text-sm text-slate-100 leading-relaxed">{result.outcome}</div>
                                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                                        <div className="text-xs font-semibold text-indigo-300 mb-2">✓ Context Receipt</div>
                                        <p className="text-xs text-emerald-300/90 mb-3">{result.receipt.walls}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {result.receipt.itemsUsed.map((it: any) => (
                                                <span key={it.id} className={`text-[11px] px-2 py-1 rounded-md border ${KIND_ACCENT[it.kind as Kind]}`} title={it.reason}>
                                                    {it.title}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Review queue */}
                        {queue.length > 0 && (
                            <section>
                                <h2 className="text-sm font-semibold text-amber-300 mb-3">Pending review · {queue.length}</h2>
                                <div className="space-y-2">
                                    {queue.map(item => (
                                        <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${KIND_ACCENT[item.kind as Kind]}`}>{KIND_LABEL[item.kind as Kind]}</span>
                                                    <span className="font-medium text-slate-200 text-sm truncate">{item.title}</span>
                                                </div>
                                                <p className="text-xs text-slate-400">{item.content}</p>
                                                {item.source && <p className="text-[10px] text-slate-600 mt-1">from {item.source}</p>}
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={() => review(item.id, 'approve')} disabled={busy}
                                                    className="bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">Approve</button>
                                                <button onClick={() => review(item.id, 'reject')} disabled={busy}
                                                    className="bg-rose-600/10 text-rose-300 border border-rose-500/30 hover:bg-rose-600/20 text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">Reject</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* The brain */}
                        <section>
                            <h2 className="text-sm font-semibold text-slate-200 mb-3">Client Brain</h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {(['voice', 'rule', 'fact', 'learning'] as Kind[]).map(kind => (
                                    <div key={kind} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                        <div className={`text-xs font-semibold mb-3 inline-block px-2 py-0.5 rounded border ${KIND_ACCENT[kind]}`}>{KIND_LABEL[kind]}</div>
                                        {brain[kind].length === 0 ? (
                                            <p className="text-xs text-slate-600">Nothing yet.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {brain[kind].map(k => (
                                                    <li key={k.id} className="text-sm">
                                                        <div className="text-slate-200 font-medium">{k.title}</div>
                                                        <div className="text-xs text-slate-400">{k.content}</div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
}
