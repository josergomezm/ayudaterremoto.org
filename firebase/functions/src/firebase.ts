import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { assertNotProdInEmulator } from "./guard";

// Anti-production guard: aborta si un emulador local quedó apuntando al proyecto
// real. Segura en producción desplegada (no hace nada ahí).
assertNotProdInEmulator();

// One admin app per instance. In the Emulator Suite the admin SDK auto-connects
// to the Firestore and Auth emulators via the FIRESTORE_EMULATOR_HOST and
// FIREBASE_AUTH_EMULATOR_HOST env vars the emulator sets — no credentials needed.
if (getApps().length === 0) initializeApp();

export const db = getFirestore();
// Optional fields are often undefined (e.g. a personal report has no subjectName);
// without this, Firestore throws "Cannot use undefined as a Firestore value".
db.settings({ ignoreUndefinedProperties: true });
export const adminAuth = getAuth();
