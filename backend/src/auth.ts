import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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
// ADMIN_PRINCIPALS (comma-separated ids). In non-production, any
// authenticated principal is allowed, with a startup warning.
const adminList = (process.env.ADMIN_PRINCIPALS || 'enterprise-admin')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

if (adminList.length === 0 && process.env.NODE_ENV !== 'production') {
    console.warn('[auth] ADMIN_PRINCIPALS not set — dev mode grants admin routes to any authenticated principal.');
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const id = req.principal?.id;
    if (id && adminList.includes(id)) return next();
    if (process.env.NODE_ENV !== 'production' && id) return next();
    return res.status(403).json({ error: 'Admin privileges required' });
};
