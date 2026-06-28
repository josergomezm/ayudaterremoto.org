// Anti-production guard (Workstream 0). Git aísla el código, no los datos: si un
// proceso local apunta al proyecto Firebase real, escribe en producción aunque
// estés en otra rama. Estas guardas fallan ruidosamente antes de que eso pase.

const PROD_PROJECT = "ayudaterremotovenezuela";

function projectId(): string {
  return process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
}

/**
 * Guarda de arranque del backend. Es segura en producción real (desplegada, sin
 * emulador): solo aborta el caso peligroso — una sesión de emulador apuntando al
 * project id de producción.
 */
export function assertNotProdInEmulator(): void {
  const inEmulator =
    !!process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR === "true";
  if (inEmulator && projectId() === PROD_PROJECT) {
    throw new Error(
      `[GUARDA] El emulador está apuntando al proyecto de PRODUCCIÓN "${PROD_PROJECT}". ` +
        `Abortando para no escribir en datos reales. Arranca con --project demo-app.`,
    );
  }
}

/**
 * Guarda dura para scripts de una sola vez (seed, migraciones). Solo pueden tocar
 * el emulador. Aborta si FIRESTORE_EMULATOR_HOST no está definido o si el project
 * id es el de producción.
 */
export function assertEmulator(label = "script"): void {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      `[GUARDA:${label}] FIRESTORE_EMULATOR_HOST no está definido. Este script SOLO corre ` +
        `contra el emulador. Abortando.`,
    );
  }
  if (projectId() === PROD_PROJECT) {
    throw new Error(
      `[GUARDA:${label}] Se detectó el proyecto de producción "${PROD_PROJECT}". Abortando.`,
    );
  }
}
