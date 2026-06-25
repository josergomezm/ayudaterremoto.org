import type { AdminRole } from "./types";
/** Idempotently seed demo incidents, an alert, and a vouch code. */
export declare function seedDemoData(): Promise<void>;
/** Upsert a Command/Authority admin by email. */
export declare function ensureAdmin(email: string, role?: AdminRole): Promise<void>;
