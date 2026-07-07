# Implementation Guide

This guide is for contributors and engineers actively building or maintaining Unified Brain. 

## Repository Structure

```text
├── backend/                  # The Assembly Engine & Graph Service
│   ├── src/
│   │   ├── auth.ts           # Authentication & ReBAC
│   │   ├── db.ts             # Legacy DB export (deprecated)
│   │   ├── graphService.ts   # Core Graph traversals & Context Assembly
│   │   ├── index.ts          # Express Server and API Routes
│   │   ├── llmService.ts     # OpenAI integrations
│   │   ├── planes.ts         # Plane configurations and DB drivers
│   │   └── seed.ts           # Demo Database Initialization
│   └── test-engine.ts        # Integration testing suite
│
├── frontend/                 # The Enterprise Console & User Workspace
│   ├── src/
│   │   ├── components/       # UI Components (EnterpriseBrain.tsx, MemoryEvolutionPanel, etc)
│   │   ├── lib/auth.ts       # Axios interceptors and token management
│   │   ├── App.tsx           # React Router
│   │   └── index.css         # Styling (Tailwind)
│
└── docs/                     # Layered Information Architecture (You are here)
```

## Backend
The backend is an Express/TypeScript application. It is the sole component allowed to hold credentials to the Neo4j databases (Planes).
- Starts via `npm run dev`.
- Uses `tsx` for hot-reloading TypeScript.

## Frontend
The frontend is a React application built with Vite.
- Starts via `npm run dev` on port 5173.
- Relies on `VITE_API_URL` to communicate with the backend.

## Neo4j
Unified Brain heavily leverages Neo4j for its graph-based Assembly Engine.
- Requires Neo4j Aura (production) or a local Docker instance.
- Cypher queries should **never** be dynamically constructed strings that cross plane boundaries. Queries must use parameters (e.g. `ownerId: $userId`).

## Environment Variables

### Backend (`backend/.env`)
| Variable | Purpose |
|----------|---------|
| `NEO4J_URI` | Database connection string (e.g. `neo4j+s://...`) |
| `NEO4J_USER` | Database user (typically `neo4j`) |
| `NEO4J_PASSWORD` | Database password |
| `OPENAI_API_KEY` | Used by `llmService.ts` to power the Assembly Engine witness. |
| `JWT_SECRET` | Required in production to sign Auth tokens. |
| `ADMIN_PRINCIPALS` | Required in production. Comma-separated list of unguessable IDs allowed to access the Enterprise Console. |
| `SEED_ALLOW_WIPE` | Must be explicitly set to `true` to run the database seed script on a non-empty database. |

### Frontend (`frontend/.env`)
| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | URL of the backend API (defaults to `http://localhost:3000/api`) |
| `VITE_ADMIN_PRINCIPAL` | The ID used to automatically log in to the Enterprise Console in production. Must match one of the `ADMIN_PRINCIPALS` in the backend. |

## Authentication
Unified Brain currently uses platform-issued JSON Web Tokens (JWT) (Derogation D4).
- **Backend:** Tokens are extracted from the `Authorization: Bearer <token>` header. The identity is sourced *only* from the token (`req.principal.id`), never from the request body.
- **Frontend:** Handled by `lib/auth.ts`, which injects the Bearer token into all Axios requests.

## Running Locally

1. Create a `backend/.env` file with your database credentials.
2. In Terminal 1:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
3. In Terminal 2:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Access `http://localhost:5173`.

## Seeding
To initialize the graph with the required schema and constraints:
```bash
cd backend
npm run seed
```
> [!WARNING]
> The seed script executes `MATCH (n) DETACH DELETE n;`. It will wipe the database. It refuses to run against a non-empty database unless you explicitly set `SEED_ALLOW_WIPE=true` in your environment.

## Testing (`backend/test-engine.ts`)
The project includes a robust integration test script for the memory engine. It authenticates as a user, fetches initial state, triggers context assembly (Enhance), simulates time decay, and verifies reactivation.

To run it (ensure the backend server is running first):
```bash
cd backend
npx tsx test-engine.ts
```

## Deployment
- Deployed via **Vercel**.
- Auto-triggered on pushes to the `master` branch.
- **Critical:** Environment variable changes on Vercel require a manual Redeploy to take effect, as frontend variables (`VITE_ADMIN_PRINCIPAL`) are baked in at build time.

## Common Problems

### Enterprise Console shows no users/orgs (403 Forbidden)
- **Cause:** In production, `ADMIN_PRINCIPALS` (backend) and `VITE_ADMIN_PRINCIPAL` (frontend) must match. If they are missing or mismatched, the frontend login fails the backend's `requireAdmin` gate, returning `403 Forbidden`.
- **Fix:** Update Vercel environment variables with matching, unguessable IDs (e.g. `admin-x7k2p9`) and redeploy.

### "Failed to connect to server" on Backend Startup
- **Cause:** Invalid or rotated `NEO4J_PASSWORD`.
- **Fix:** Ensure `backend/.env` matches the current credentials in the Neo4j Aura console.
