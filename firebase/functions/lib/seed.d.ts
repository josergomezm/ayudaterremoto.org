import type { AdminRole } from "./types";
/** Idempotently seed demo incidents, an alert, and a vouch code. */
export declare function seedDemoData(): Promise<void>;
/**
 * Demo de coordinación de suministros (WS5): coordinadores de campo, zonas y
 * necesidades cubriendo los 4 estados (abierta / tomada / confirmada / reabierta)
 * y las 3 urgencias. Idempotente (marcador propio meta/supplyDemo). Solo emulador.
 */
export declare function seedSupplyDemo(): Promise<void>;
/** Upsert an admin by email. Defaults to Fundador (rol raíz, solo por seed). */
export declare function ensureAdmin(email: string, role?: AdminRole): Promise<void>;
