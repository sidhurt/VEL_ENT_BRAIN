# Unified Brain (VelEntRun)

**A constitutional context operating system** — Unified Brain assembles the
highest-quality context that can *legitimately* participate in an AI reasoning act,
for a given principal, under explicit governance. It solves context deficiency
without solving it by surveillance.

## Start here

| Document | What it answers |
|----------|-----------------|
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | What is this, what exists today, where is it going |
| [docs/CONSTITUTION.md](docs/CONSTITUTION.md) | The product philosophy as ratified constitutional articles (v1.0) |
| [docs/V1_ARCHITECTURE.md](docs/V1_ARCHITECTURE.md) | The production architecture, invariants, milestones, derogations |

## Run it locally

Backend needs `backend/.env` with `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`,
`OPENAI_API_KEY` (the server fails closed if the database vars are missing).
Point them at a Neo4j Aura instance, or run one locally with `docker compose up -d`.

```bash
# terminal 1 — backend on http://localhost:3000
cd backend && npm install && npm run dev

# terminal 2 — frontend on http://localhost:5173
cd frontend && npm install && npm run dev
```

> ⚠️ **`npm run seed` WIPES THE DATABASE** before inserting demo data
> (`neo4j-init.cypher` starts with `MATCH (n) DETACH DELETE n`). Only run it
> against a brand-new, empty database. The script now refuses to run against a
> non-empty database unless `SEED_ALLOW_WIPE=true` is set.

Integration test for the memory engine (server must be running):

```bash
cd backend && npx tsx test-engine.ts
```

## Production

Deployment is Vercel, auto-triggered on push. Production additionally requires
`JWT_SECRET` and `ADMIN_PRINCIPALS` env vars — admin routes are deny-by-default,
and the graph-wipe endpoint is disabled outright in production. Until real login
(OIDC) lands, keep deployments behind Vercel's deployment protection: the V1 login
issues tokens without credential verification (documented as Derogation D4).

## Stack

React/Vite · Express/TypeScript · Neo4j (Aura or Docker) · OpenAI · Vercel

## Architecture in one paragraph

The graph is a federation of constitutional planes: a **personal plane** (cognition,
owned by the person) and an **org plane** (promoted knowledge, owned by the
organization), connected only by the **promotion bridge** — an explicit, reviewed
governance act. Context assembly computes authorization *before* retrieval as
registered, parameter-bound query templates, composes only pre-authorized fragments,
and returns an ExplainabilityReceipt for every pack. Deny is the default; failures
close.
