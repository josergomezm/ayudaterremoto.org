/**
 * Guarda de arranque del backend. Es segura en producción real (desplegada, sin
 * emulador): solo aborta el caso peligroso — una sesión de emulador apuntando al
 * project id de producción.
 */
export declare function assertNotProdInEmulator(): void;
/**
 * Guarda dura para scripts de una sola vez (seed, migraciones). Solo pueden tocar
 * el emulador. Aborta si FIRESTORE_EMULATOR_HOST no está definido o si el project
 * id es el de producción.
 */
export declare function assertEmulator(label?: string): void;
