# Authorization

What is enforced today, precisely — and what is designed but not built. This
document does not overclaim; every statement below maps to code.

## 1. Implemented and enforced (fail-closed)

### Identity
- **Google Sign-In** (`POST /api/auth/google`) — verifies a Google ID token
  (`google-auth-library`, audience-checked against our OAuth client), MERGEs the
  `User` node, and issues a platform JWT. This is the verified-identity path.
- **Platform JWT** — all `/api` routes except `health` and the two login routes sit
  behind `requireAuth` (`backend/src/auth.ts`). Identity comes **only** from the
  validated token; caller-supplied identity in bodies or params is ignored or
  rejected.
- **Dev login** (`POST /api/auth/login`) — identity-asserted, no credential. Allowed
  in non-production; in production it is **disabled unless `ALLOW_DEV_LOGIN=true`**
  (currently set, because the Enterprise Console still uses it — see §3 cutover).

### Route-level enforcement
| Mechanism | Behavior |
|-----------|----------|
| `selfParam` | Any route addressing `:userId` returns **403** unless it equals the token principal |
| `requireAdmin` | Org-management routes are deny-by-default in production; only ids in `ADMIN_PRINCIPALS` pass. There is deliberately **no production default** — a well-known default admin id plus credential-less login would be a public backdoor |
| Production guards | `DELETE /api/admin/clear` (graph wipe) is refused outright in production |

### Graph-level enforcement (the walls)
- **Personal plane:** every query binds the owner at the anchor
  (`(u:User {id: $principalId})`). Other users' personal subgraphs are unreachable
  by construction — the traversal shape doesn't express them.
- **Client walls:** every Client Brain operation resolves the target client
  *through the caller's own org membership* in a single query
  (`requireClientAccess` in `backend/src/clientBrain.ts`). Zero rows → 403.
  Cross-client assembly is inexpressible — there is no query in the codebase that
  can read two clients' knowledge at once.
- **Trust queue scoping:** proposal review is limited to the reviewer's own
  proposals plus authors sharing an organization with the reviewer.
- **Fixed query shapes:** no dynamic Cypher, no unbounded variable-length
  traversal anywhere in an authorized path.

### Review/promotion authorization
- Knowledge review (`POST /api/knowledge/:id/review`) re-verifies that the item
  belongs to a client inside the reviewer's org before any action.
- Rejection **purges** the item (no rejected content is retained); every decision
  writes an immutable `PromotionEvent`.

## 2. Explicitly NOT implemented yet (future work)

These are designed (specs in [CLIENT_BRAIN_V1.md](CLIENT_BRAIN_V1.md) and
[PROJECT_STATE.md](PROJECT_STATE.md)) and intentionally sequenced after dogfood:

- **Org-level roles.** There is currently one binary role: admin (config allowlist)
  vs. member. Reviewer / governance-author roles as org-plane data are the next
  authorization milestone. Note: the `Role` node in the graph is a *persona*
  descriptor (job title used for context), not a permission.
- **Template registry + Policy Decision Point.** Today the "authorized templates"
  concept exists as a code discipline (fixed shapes, bound parameters). The formal
  registry (each query registered with declared revelation classes, CI-linted) and
  an in-process PDP issuing per-request `AuthorizationDecision`s with decision IDs
  on receipts are designed but not built.
- **OAuth for the Enterprise Console.** The console still authenticates via dev
  login with an unguessable admin id.

## 3. The dev-login cutover

The scheduled end of identity-asserted login: when the Client Room UI ships with
Google-only auth, set `ALLOW_DEV_LOGIN=false` on the backend deployment. From that
moment every production identity is Google-verified. Until then, production is
protected by (a) the unguessable admin id and (b) deployment-level access control,
and this is documented as a known limitation rather than hidden.

## 4. Known limitations (honest register)

- Dev login means production identity is currently assertable by anyone who knows
  a principal id. Mitigations: unguessable admin id; Vercel deployment protection
  recommended for the frontend; cutover plan above.
- New Google users have no org membership until an admin attaches them
  (`POST /api/enterprise/attach-user`) — they can authenticate but reach nothing
  (deny-by-default working as intended). The Client Room onboarding flow will
  absorb this step.
- Artifact feedback (`POST /api/artifacts/:id/feedback`) checks authentication but
  not yet artifact ownership — scheduled with the roles milestone.
