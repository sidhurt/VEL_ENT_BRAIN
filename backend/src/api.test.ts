import { describe, test, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// These tests exercise the HTTP surface in front of the database: the auth
// gate, identity walls, input validation, and the auth rate limiter. No route
// under test reaches Neo4j, so the connection config is a dummy (the driver
// is created lazily, on first session use).
let app: Express;

beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('JWT_SECRET', 'api-test-secret');
    vi.stubEnv('NEO4J_URI', 'bolt://localhost:9999');
    vi.stubEnv('NEO4J_USER', 'neo4j');
    vi.stubEnv('NEO4J_PASSWORD', 'unused');
    app = (await import('./index')).default;
});

const login = async (): Promise<string> => {
    const res = await request(app).post('/api/auth/login').send({ principalId: 'u-test', name: 'Test User' });
    expect(res.status).toBe(200);
    return res.body.token;
};

describe('unauthenticated surface', () => {
    test('health check responds without auth', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    test('API routes behind the gate reject missing tokens with 401', async () => {
        for (const path of ['/api/clients', '/api/cards/u-test', '/api/trust/queue']) {
            const res = await request(app).get(path);
            expect(res.status, path).toBe(401);
        }
    });

    test('a forged token is rejected with 401', async () => {
        const res = await request(app)
            .get('/api/clients')
            .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.forged.signature');
        expect(res.status).toBe(401);
    });

    test('google sign-in without a credential is a 422, not a crash', async () => {
        const res = await request(app).post('/api/auth/google').send({});
        expect(res.status).toBe(422);
    });
});

describe('identity walls', () => {
    test("reading another principal's cards is forbidden", async () => {
        const token = await login();
        const res = await request(app)
            .get('/api/cards/someone-else')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    test("reading another principal's graph, evolution and workspace is forbidden", async () => {
        const token = await login();
        for (const path of [
            '/api/graph/someone-else',
            '/api/evolution/someone-else',
            '/api/workspace/state/someone-else',
            '/api/artifacts/someone-else',
        ]) {
            const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
            expect(res.status, path).toBe(403);
        }
    });
});

describe('input validation (fails before touching the graph)', () => {
    let token: string;
    beforeAll(async () => {
        token = await login();
    });

    const post = (path: string, body: object) =>
        request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);

    test('creating a client requires a non-empty name', async () => {
        expect((await post('/api/clients', {})).status).toBe(422);
        expect((await post('/api/clients', { name: '   ' })).status).toBe(422);
    });

    test('proposing knowledge requires a non-empty items array', async () => {
        expect((await post('/api/clients/c-1/knowledge', {})).status).toBe(422);
        expect((await post('/api/clients/c-1/knowledge', { items: [] })).status).toBe(422);
    });

    test('ingest requires at least 100 chars of document text', async () => {
        expect((await post('/api/clients/c-1/ingest', { text: 'too short' })).status).toBe(422);
    });

    test('knowledge review only accepts approve or reject', async () => {
        expect((await post('/api/knowledge/k-1/review', { action: 'maybe' })).status).toBe(422);
    });

    test('client enhance requires a prompt', async () => {
        expect((await post('/api/clients/c-1/enhance', {})).status).toBe(422);
    });

    test('dev login requires a principalId or name', async () => {
        expect((await request(app).post('/api/auth/login').send({})).status).toBe(422);
    });
});

describe('auth rate limiting', () => {
    test('repeated auth attempts from one IP eventually get 429', async () => {
        let sawTooMany = false;
        for (let i = 0; i < 40; i++) {
            const res = await request(app).post('/api/auth/login').send({ principalId: 'burst' });
            if (res.status === 429) {
                sawTooMany = true;
                break;
            }
        }
        expect(sawTooMany).toBe(true);
    });
});
