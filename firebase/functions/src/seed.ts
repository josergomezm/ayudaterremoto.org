// One-off seed script. Run with `npm run seed` (see functions/package.json).
//
//   npm run seed                       # demo data only (emulator)
//   npm run seed -- you@example.com    # demo data + make that email a Command admin
//
// Demo data is only written when talking to the Firestore EMULATOR
// (FIRESTORE_EMULATOR_HOST is set) so you can never accidentally pour fake
// incidents into a real database. Creating a Command admin works in either
// environment. For production you can instead just add the `adminUsers/{email}`
// document by hand in the Firebase console.

import { db } from "./firebase";
import { logger } from "firebase-functions/v2";
import type { Incident, AdminRole } from "./types";

/** Idempotently seed demo incidents, an alert, and a vouch code. */
export async function seedDemoData(): Promise<void> {
  const meta = db.doc("meta/seed");
  if ((await meta.get()).exists) return;

  const now = new Date().toISOString();
  const incidents: Incident[] = [
    { id: "1", category: "structural", triageLevel: 1, status: "red", lat: 10.5012, lng: -66.9146, description: "Edificio parcialmente colapsado, personas atrapadas en el 3er piso.", isProxy: false, reporterId: "12345678", evacuated: false, resolved: false, resolutionConfirmed: null, createdAt: now },
    { id: "2", category: "medical", triageLevel: 2, status: "yellow", lat: 10.4998, lng: -66.9032, description: "Persona mayor con dificultad para respirar.", isProxy: true, subjectName: "Sr. Carlos (Apt 4B)", reporterId: "87654321", evacuated: false, resolved: false, resolutionConfirmed: null, createdAt: now },
    { id: "3", category: "obstruction", triageLevel: 4, status: "green", lat: 10.5061, lng: -66.9210, description: "Vía bloqueada por escombros; sin heridos.", isProxy: false, reporterId: "11223344", evacuated: true, resolved: false, resolutionConfirmed: null, createdAt: now },
  ];

  const batch = db.batch();
  for (const i of incidents) batch.set(db.doc(`incidents/${i.id}`), i);
  batch.set(db.doc("announcements/1"), {
    id: "1",
    category: "urgent",
    message: "Réplica posible en las próximas horas. Aléjese de estructuras dañadas y de fachadas, postes y cables caídos. Si está dentro de un edificio con daños, evacúe con calma por las escaleras —nunca el ascensor— y diríjase a un punto abierto. Mantenga este canal abierto para nuevas instrucciones.",
    createdAt: now,
  });
  batch.set(db.doc("vouchCodes/DEMO1234"), { code: "DEMO1234", used: false, voucher: "seed", createdAt: now });
  batch.set(meta, { seededAt: now });
  await batch.commit();
}

/** Upsert an admin by email. Defaults to Fundador (rol raíz, solo por seed). */
export async function ensureAdmin(email: string, role: AdminRole = "fundador"): Promise<void> {
  const key = email.toLowerCase();
  await db.doc(`adminUsers/${key}`).set({ email: key, role });
}

async function main(): Promise<void> {
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  const email = process.argv[2] || process.env.SEED_ADMIN_EMAIL;

  if (isEmulator) {
    await seedDemoData();
    logger.info("seed: demo data written (emulator)");
    console.log("✓ Demo data seeded (emulator).");
  } else {
    console.log("• No emulator detected (FIRESTORE_EMULATOR_HOST unset) — skipping demo data.");
  }

  if (email) {
    await ensureAdmin(email);
    console.log(`✓ Fundador admin set: ${email.toLowerCase()}`);
  } else {
    console.log("• Tip: create a Fundador admin with  npm run seed -- you@example.com");
  }
  process.exit(0);
}

// Run only when invoked directly (not when imported).
if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
