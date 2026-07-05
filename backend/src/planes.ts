import neo4j, { Driver } from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

// Constitutional planes (AQ1, docs/V1_ARCHITECTURE.md §1).
// Planes are a separation of AUTHORITY, not necessarily of infrastructure:
// each plane has its own driver/config, and callers must declare which plane
// they act in. Whether the two configs point at one instance, two databases,
// or two instances is deployment mapping (env), invisible to calling code.
//
// M0 note: query-to-plane assignment for existing graphService functions
// happens in M1 with the template registry. Until then, legacy code uses the
// shared driver via db.ts, and new code must use getPersonalSession/getOrgSession.

export type Plane = 'personal' | 'org';

interface PlaneConfig {
    uri: string;
    user: string;
    password: string;
    database?: string;
}

const required = (name: string): string => {
    const v = process.env[name];
    if (!v) {
        throw new Error(
            `Missing required environment variable ${name}. ` +
            `Set NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD (shared) or per-plane NEO4J_PERSONAL_*/NEO4J_ORG_* variables.`
        );
    }
    return v;
};

const planeConfig = (prefix: 'NEO4J_PERSONAL' | 'NEO4J_ORG'): PlaneConfig => ({
    uri: process.env[`${prefix}_URI`] ?? required('NEO4J_URI'),
    user: process.env[`${prefix}_USER`] ?? required('NEO4J_USER'),
    password: process.env[`${prefix}_PASSWORD`] ?? required('NEO4J_PASSWORD'),
    database: process.env[`${prefix}_DATABASE`],
});

const configs: Record<Plane, PlaneConfig> = {
    personal: planeConfig('NEO4J_PERSONAL'),
    org: planeConfig('NEO4J_ORG'),
};

const drivers: Partial<Record<Plane, Driver>> = {};

const driverFor = (plane: Plane): Driver => {
    if (!drivers[plane]) {
        const cfg = configs[plane];
        drivers[plane] = neo4j.driver(cfg.uri, neo4j.auth.basic(cfg.user, cfg.password));
    }
    return drivers[plane]!;
};

const separated =
    configs.personal.uri !== configs.org.uri ||
    configs.personal.database !== configs.org.database;

console.log(
    separated
        ? '[planes] personal and org planes mapped to separate infrastructure.'
        : '[planes] planes share one instance — authority separation only (V1 Derogation D1).'
);

export const getPersonalSession = () =>
    driverFor('personal').session(configs.personal.database ? { database: configs.personal.database } : {});

export const getOrgSession = () =>
    driverFor('org').session(configs.org.database ? { database: configs.org.database } : {});

// Shared/legacy access for code not yet migrated to a plane (M1 migrates it).
export const getSharedSession = () => driverFor('personal').session();

export const closePlanes = async () => {
    await Promise.all(Object.values(drivers).map(d => d?.close()));
};

// Constitution stamp applied to every new persisted object (Invariant I10).
export const CONSTITUTION_VERSION = '1.0';
