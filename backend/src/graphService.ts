// Legacy façade over the domain-split graph modules (graph/*). Kept so
// existing imports keep working; new code should import the domain module
// directly. M1 migrates these off db.ts onto planes.ts.
export * from './graph/personalMemory';
export * from './graph/enterprise';
export * from './graph/candidates';
export * from './graph/artifacts';
export * from './graph/trust';
