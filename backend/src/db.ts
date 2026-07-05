// Legacy shared-session accessor. New code must use planes.ts
// (getPersonalSession / getOrgSession); M1 migrates graphService off this.
import { getSharedSession, closePlanes } from './planes';

export const getSession = getSharedSession;

export const closeDriver = closePlanes;
