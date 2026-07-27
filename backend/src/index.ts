import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { requireAuth } from './auth';
import authRoutes from './routes/authRoutes';
import personalBrainRoutes from './routes/personalBrainRoutes';
import adminRoutes from './routes/adminRoutes';
import clientBrainRoutes from './routes/clientBrainRoutes';
import enhanceRoutes from './routes/enhanceRoutes';

const app = express();
// Vercel terminates TLS and forwards the client IP in X-Forwarded-For;
// trust exactly one proxy hop so rate limiting keys on the real client.
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// Credential endpoints are the brute-force surface; throttle per IP.
// In-memory store: per-instance on serverless, still bounds a single hot path.
const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Try again later.' },
});
app.use('/api/auth', authLimiter);

const PORT = process.env.PORT || 3000;

// Health Check for Cloud Deployment
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Deep health: runs a trivial read against Neo4j. Hit daily by the Vercel cron
// so the Aura Free instance never idles into a pause (paused ~30 days = deleted).
app.get('/api/health/db', async (req, res) => {
    const { getSession } = await import('./db');
    const session = getSession();
    try {
        await session.run('RETURN 1');
        res.json({ status: 'ok', db: 'reachable', timestamp: new Date().toISOString() });
    } catch (e) {
        res.status(503).json({ status: 'degraded', db: 'unreachable' });
    } finally {
        await session.close();
    }
});

// Unauthenticated surface: token issuance only (health above, auth routes here).
app.use(authRoutes);

// Everything below this gate requires an authenticated principal.
// Identity comes from the token, never from the caller's body or params.
app.use('/api', requireAuth);

app.use(personalBrainRoutes);
app.use(adminRoutes);
app.use(clientBrainRoutes);
app.use(enhanceRoutes);

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Unified Brain Backend running on http://localhost:${PORT}`);
    });
}

export default app;
