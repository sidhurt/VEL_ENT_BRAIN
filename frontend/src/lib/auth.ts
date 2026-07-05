import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'vel_token';
const PRINCIPAL_KEY = 'vel_principal';

export interface Principal {
    id: string;
    name: string;
}

// Exchange a principal id for a platform-issued token (V1 dev-grade login;
// OIDC replaces this before any external pilot). Sets the token for all
// subsequent axios requests via the interceptor below.
export async function loginAs(principalId: string, name?: string): Promise<Principal> {
    const res = await axios.post(`${API_URL}/auth/login`, {
        principalId,
        name: name || principalId,
    });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    localStorage.setItem(PRINCIPAL_KEY, res.data.principal.id);
    return res.data.principal;
}

export function currentPrincipalId(): string | null {
    return localStorage.getItem(PRINCIPAL_KEY);
}

// Attach the bearer token to every request except login itself.
axios.interceptors.request.use(config => {
    if (config.url?.endsWith('/auth/login')) return config;
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
});

// Expired/invalid token: drop it so the workspace re-logs-in on next load.
axios.interceptors.response.use(undefined, err => {
    if (err.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(err);
});
