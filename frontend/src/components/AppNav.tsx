import { Link, useLocation, useNavigate } from 'react-router-dom';

// Floating switcher + sign-out, rendered on every route. Bottom-right so it
// never collides with a page's own header. Lets you move between the three
// surfaces (Client Room / Workspace / Enterprise) without typing URLs.
const TABS = [
    { path: '/clients', label: 'Client Room' },
    { path: '/workspace', label: 'Workspace' },
    { path: '/enterprise', label: 'Enterprise' },
];

export default function AppNav() {
    const loc = useLocation();
    const nav = useNavigate();
    const active = (p: string) => loc.pathname === p || (p === '/clients' && loc.pathname === '/');

    const signOut = () => {
        localStorage.removeItem('vel_token');
        localStorage.removeItem('vel_principal');
        localStorage.removeItem('vel_userId');
        nav('/');
        window.location.reload();
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-0.5 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full px-1.5 py-1 shadow-2xl text-xs font-sans">
            {TABS.map(t => (
                <Link key={t.path} to={t.path}
                    className={`px-3 py-1.5 rounded-full transition-colors ${active(t.path) ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                    {t.label}
                </Link>
            ))}
            <button onClick={signOut} title="Sign out"
                className="px-3 py-1.5 rounded-full text-slate-500 hover:text-rose-300 border-l border-slate-700/70 ml-1">
                Sign out
            </button>
        </div>
    );
}
