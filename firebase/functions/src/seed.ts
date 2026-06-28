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

/**
 * Demo de coordinación de suministros (WS5): coordinadores de campo, zonas y
 * necesidades cubriendo los 4 estados (abierta / tomada / confirmada / reabierta)
 * y las 3 urgencias. Idempotente (marcador propio meta/supplyDemo). Solo emulador.
 */
export async function seedSupplyDemo(): Promise<void> {
  const marker = db.doc("meta/supplyDemo");
  if ((await marker.get()).exists) return;
  const now = new Date().toISOString();

  // Coordinadores de campo (users/) — dueños de zonas. Inicia sesión como uno de
  // estos en el emulador para ver la vista "Mi zona".
  await db.doc("users/maria@demo.com").set({ email: "maria@demo.com", role: "coordinador", name: "María González", updatedAt: now });
  await db.doc("users/carlos@demo.com").set({ email: "carlos@demo.com", role: "coordinador", name: "Carlos Pérez", updatedAt: now });
  // Un Organizador adicional (además del Fundador del seed).
  await db.doc("adminUsers/coordinacion@demo.com").set({ email: "coordinacion@demo.com", role: "organizador" });

  const zones = [
    { id: "zona-catia", name: "Refugio Catia La Mar", address: "Av. Soublette, Catia La Mar", lat: 10.5980, lng: -67.0220, createdBy: "maria@demo.com", contactName: "María González" },
    { id: "zona-maiquetia", name: "Punto Maiquetía", address: "Calle Real de Maiquetía", lat: 10.5970, lng: -66.9800, createdBy: "carlos@demo.com", contactName: "Carlos Pérez" },
  ];
  for (const z of zones) {
    await db.doc(`resourceHubs/${z.id}`).set({
      id: z.id, name: z.name, address: z.address, lat: z.lat, lng: z.lng,
      contactPhone: "+58 412 1112233", contactName: z.contactName,
      whatsappGroup: "https://chat.whatsapp.com/demo",
      status: "active", createdBy: z.createdBy, createdAt: now, updatedAt: now,
    });
  }

  // Necesidades (inventory) — id = doc id (lo usa /needs/:id por collection-group).
  const items: Array<{ hub: string; id: string; data: Record<string, unknown> }> = [
    // Zona Catia
    { hub: "zona-catia", id: "n-agua-catia", data: { category: "water", name: "Agua", quantity: 0, unit: "botellas", urgency: "depleted", status: "abierta", reopenedCount: 0 } },
    { hub: "zona-catia", id: "n-formula-catia", data: { category: "medical", name: "Fórmula", quantity: 30, unit: "latas", urgency: "low", status: "tomada", claimedBy: "carlos@demo.com", claimedByName: "Carlos Pérez", claimedAt: now } },
    { hub: "zona-catia", id: "n-vendas-catia", data: { category: "medical", name: "Vendas", quantity: 15, unit: "cajas", urgency: "available", status: "abierta", reopenedCount: 0 } },
    // Zona Maiquetía
    { hub: "zona-maiquetia", id: "n-agua-maiq", data: { category: "water", name: "Agua", quantity: 0, unit: "botellas", urgency: "depleted", status: "confirmada", claimedByName: "Pedro Ramos", confirmedBy: "maria@demo.com", confirmedByName: "María González", confirmedAt: now } },
    { hub: "zona-maiquetia", id: "n-mantas-maiq", data: { category: "shelter", name: "Mantas", quantity: 0, unit: "unidades", urgency: "depleted", status: "abierta", reopenedCount: 1, reopenedByName: "Carlos Pérez" } },
    { hub: "zona-maiquetia", id: "n-arroz-maiq", data: { category: "food", name: "Arroz", quantity: 40, unit: "kg", urgency: "available", status: "abierta", reopenedCount: 0 } },
  ];
  for (const it of items) {
    await db.doc(`resourceHubs/${it.hub}/inventory/${it.id}`).set({ id: it.id, updatedAt: now, ...it.data });
  }

  // Aviso de logística (como el "AVISO" del diseño).
  await db.doc("announcements/demo-logistica").set({
    id: "demo-logistica", category: "logistics",
    message: "Logística · priorizar agua en La Guaira. Zonas activas en Catia La Mar y Maiquetía.",
    createdAt: now,
  });

  await marker.set({ seededAt: now });
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
    await seedSupplyDemo();
    logger.info("seed: demo data written (emulator)");
    console.log("✓ Demo data seeded (emulator): zonas + necesidades de ejemplo.");
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
