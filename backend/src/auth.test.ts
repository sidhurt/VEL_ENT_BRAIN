import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';

// auth.ts derives JWT_SECRET, dev-login and admin gating from env at import
// time, so each scenario loads a fresh copy of the module under its own env.
const loadAuth = async (env: Record<string, string | undefined>) => {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) {
        if (v === undefined) vi.stubEnv(k, '');
        else vi.stubEnv(k, v);
    }
    return import('./auth');
};

const mockRes = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
};

const reqWithToken = (token?: string): Request =>
    ({ headers: token ? { authorization: `Bearer ${token}` } : {} } as unknown as Request);

beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('JWT_SECRET', 'test-secret');
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('token issue / verify round trip', () => {
    test('a valid issued token authenticates and carries the principal', async () => {
        const auth = await loadAuth({});
        const token = auth.issueToken({ id: 'u-1', name: 'Alice' });
        const req = reqWithToken(token);
        const res = mockRes();
        const next = vi.fn();

        auth.requireAuth(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(req.principal).toEqual({ id: 'u-1', name: 'Alice' });
    });

    test('missing Authorization header is rejected with 401', async () => {
        const auth = await loadAuth({});
        const res = mockRes();
        const next = vi.fn();

        auth.requireAuth(reqWithToken(), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a garbage token is rejected with 401', async () => {
        const auth = await loadAuth({});
        const res = mockRes();
        const next = vi.fn();

        auth.requireAuth(reqWithToken('not-a-jwt'), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a token signed with a different secret is rejected', async () => {
        const authA = await loadAuth({ JWT_SECRET: 'secret-a' });
        const token = authA.issueToken({ id: 'u-1', name: 'Alice' });

        const authB = await loadAuth({ JWT_SECRET: 'secret-b' });
        const res = mockRes();
        const next = vi.fn();

        authB.requireAuth(reqWithToken(token), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });
});

describe('production fail-closed behavior', () => {
    test('importing auth in production without JWT_SECRET throws', async () => {
        await expect(
            loadAuth({ NODE_ENV: 'production', JWT_SECRET: undefined })
        ).rejects.toThrow(/JWT_SECRET is required/);
    });

    test('dev login is disabled in production by default', async () => {
        const auth = await loadAuth({ NODE_ENV: 'production', JWT_SECRET: 's', ALLOW_DEV_LOGIN: undefined });
        expect(auth.devLoginAllowed).toBe(false);
    });

    test('dev login in production requires the explicit opt-in flag', async () => {
        const auth = await loadAuth({ NODE_ENV: 'production', JWT_SECRET: 's', ALLOW_DEV_LOGIN: 'true' });
        expect(auth.devLoginAllowed).toBe(true);
    });

    test('in production, admin routes fail closed when ADMIN_PRINCIPALS is unset', async () => {
        const auth = await loadAuth({ NODE_ENV: 'production', JWT_SECRET: 's', ADMIN_PRINCIPALS: undefined });
        const req = { principal: { id: 'anyone', name: 'Anyone' } } as unknown as Request;
        const res = mockRes();
        const next = vi.fn();

        auth.requireAdmin(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('in production, only listed ADMIN_PRINCIPALS pass the admin gate', async () => {
        const auth = await loadAuth({ NODE_ENV: 'production', JWT_SECRET: 's', ADMIN_PRINCIPALS: 'g-111, g-222' });

        const allowed = { principal: { id: 'g-222', name: 'Admin' } } as unknown as Request;
        const allowedNext = vi.fn();
        auth.requireAdmin(allowed, mockRes(), allowedNext);
        expect(allowedNext).toHaveBeenCalledOnce();

        const denied = { principal: { id: 'g-333', name: 'Not Admin' } } as unknown as Request;
        const deniedRes = mockRes();
        const deniedNext = vi.fn();
        auth.requireAdmin(denied, deniedRes, deniedNext);
        expect(deniedNext).not.toHaveBeenCalled();
        expect(deniedRes.status).toHaveBeenCalledWith(403);
    });
});

describe('requireAdmin outside production', () => {
    test('any authenticated principal passes (documented dev convenience)', async () => {
        const auth = await loadAuth({});
        const req = { principal: { id: 'dev-user', name: 'Dev' } } as unknown as Request;
        const next = vi.fn();

        auth.requireAdmin(req, mockRes(), next);

        expect(next).toHaveBeenCalledOnce();
    });

    test('an unauthenticated request is still rejected', async () => {
        const auth = await loadAuth({});
        const res = mockRes();
        const next = vi.fn();

        auth.requireAdmin({} as unknown as Request, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });
});

describe('requireSelf identity gate', () => {
    test('a claimed id matching the principal is accepted', async () => {
        const auth = await loadAuth({});
        const req = { principal: { id: 'u-1', name: 'Alice' } } as unknown as Request;
        expect(auth.requireSelf('u-1', req)).toBe('u-1');
    });

    test('an undefined claim falls back to the authenticated principal', async () => {
        const auth = await loadAuth({});
        const req = { principal: { id: 'u-1', name: 'Alice' } } as unknown as Request;
        expect(auth.requireSelf(undefined, req)).toBe('u-1');
    });

    test('claiming another identity throws 403', async () => {
        const auth = await loadAuth({});
        const req = { principal: { id: 'u-1', name: 'Alice' } } as unknown as Request;
        try {
            auth.requireSelf('u-2', req);
            expect.unreachable('requireSelf must throw on identity mismatch');
        } catch (err: any) {
            expect(err.status).toBe(403);
        }
    });
});
