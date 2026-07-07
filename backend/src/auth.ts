import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

// Platform-issued identity (V1, Derogation D4 in docs/V1_ARCHITECTURE.md).
// Org membership is org-plane data, never identity: offboarding must never
// revoke a principal's ability to authenticate.

const JWT_SECRET: string = (() => {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is required in production.');
    }
    console.warn('[auth] JWT_SECRET not set — using ephemeral dev secret; tokens expire on restart.');
    return crypto.randomBytes(32).toString('hex');
})();

const TOKEN_TTL = '12h';

export interface Principal {
    id: string;
    name: string;
}

declare global {
    namespace Express {
        interface Request {
            principal?: Principal;
        }
    }
}

export const issueToken = (principal: Principal): string =>
    jwt.sign({ sub: principal.id, name: principal.name }, JWT_SECRET, { expiresIn: TOKEN_TTL });

// --- Google Sign-In (B2) ----------------------------------------------------
// The client ID is public by design (it ships in the frontend bundle); env
// override exists for future deployments with their own OAuth client.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
    || '754202982237-k1v6n4u2kihs0g68am5164nq4p5ku88r.apps.googleusercontent.com';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface GoogleIdentity {
    id: string;      // 'g-' + Google's stable subject id
    name: string;
    email?: string;
}

export const verifyGoogleCredential = async (credential: string): Promise<GoogleIdentity> => {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error('Google token has no subject');
    return {
        id: 'g-' + payload.sub,
        name: payload.name || payload.email || 'Google User',
        email: payload.email,
    };
};

// Dev login (password-less, identity-asserted) is a pre-OAuth scaffold.
// Non-production: allowed. Production: only with explicit ALLOW_DEV_LOGIN=true
// (currently required by the admin console; flipped off when the Client Room
// ships with Google-only auth).
export const devLoginAllowed =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === 'true';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const payload = jwt.verify(header.slice(7), JWT_SECRET) as jwt.JwtPayload;
        if (!payload.sub) throw new Error('missing subject');
        req.principal = { id: String(payload.sub), name: String(payload.name ?? payload.sub) };
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Route param/body userId must match the authenticated principal (fail closed).
// Invariant: no route acts on a caller-asserted identity.
export const requireSelf = (claimedId: string | undefined, req: Request): string => {
    const principalId = req.principal!.id;
    if (claimedId !== undefined && claimedId !== principalId) {
        const err: any = new Error('Forbidden: identity mismatch');
        err.status = 403;
        throw err;
    }
    return principalId;
};

// Admin gate. Fail closed in production: only principals listed in
// ADMIN_PRINCIPALS (comma-separated ids). There is deliberately NO production
// default — login is unauthenticated (Derogation D4), so a well-known default
// admin id would let anyone on the internet become admin. Non-production
// defaults to 'enterprise-admin' for local convenience.
const adminEnv = process.env.ADMIN_PRINCIPALS
    ?? (process.env.NODE_ENV !== 'production' ? 'enterprise-admin' : '');
const adminList = adminEnv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

if (adminList.length === 0 && process.env.NODE_ENV === 'production') {
    console.warn('[auth] ADMIN_PRINCIPALS not set — all admin routes will return 403 until it is configured.');
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const id = req.principal?.id;
    if (id && adminList.includes(id)) return next();
    if (process.env.NODE_ENV !== 'production' && id) return next();
    return res.status(403).json({ error: 'Admin privileges required' });
};
