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
import type { Incident, AdminRole, InventoryCategory, InventoryMovement, HubNeed } from "./types";

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
  await db.doc("users/maria@demo.com").set({ email: "maria@demo.com", role: "coordinator", name: "María González", updatedAt: now });
  await db.doc("users/carlos@demo.com").set({ email: "carlos@demo.com", role: "coordinator", name: "Carlos Pérez", updatedAt: now });
  await db.doc("users/rescatista@demo.com").set({ email: "rescatista@demo.com", role: "rescuer", name: "Juan Rescate", updatedAt: now });
  // Un Organizador adicional (además del Fundador del seed).
  await db.doc("adminUsers/coordinacion@demo.com").set({ email: "coordinacion@demo.com", role: "admin" });

  // Seed pending responder requests (one Coordinator, one Rescuer)
  await db.doc("responderRequests/solicitud.coordinador@demo.com").set({
    email: "solicitud.coordinador@demo.com",
    name: "Ana Suministros",
    phone: "+58 414 7778899",
    note: "Coordinadora de la brigada de recolección en Petare.",
    requestedRole: "coordinator",
    requestedAt: now,
    requestedHubId: "zona-catia",
    requestedHubName: "Refugio Catia La Mar"
  });
  await db.doc("responderRequests/solicitud.rescatista@demo.com").set({
    email: "solicitud.rescatista@demo.com",
    name: "Luis Salvamento",
    phone: "+58 412 9991122",
    note: "Paramédico y socorrista de Protección Civil.",
    requestedRole: "rescuer",
    requestedAt: now,
    requestedHubId: "zona-maiquetia",
    requestedHubName: "Brigada Móvil Maiquetía"
  });
 
  const zones = [
    { id: "zona-catia", name: "Refugio Catia La Mar", address: "Av. Soublette, Catia La Mar", lat: 10.5980, lng: -67.0220, createdBy: "maria@demo.com", contactName: "María González", hubType: "static" },
    { id: "zona-maiquetia", name: "Brigada Móvil Maiquetía", address: "Calle Real de Maiquetía", lat: 10.5970, lng: -66.9800, createdBy: "carlos@demo.com", contactName: "Carlos Pérez", hubType: "mobile" },
  ];
  for (const z of zones) {
    await db.doc(`resourceHubs/${z.id}`).set({
      id: z.id, name: z.name, address: z.address, lat: z.lat, lng: z.lng,
      contactPhone: "+58 412 1112233", contactName: z.contactName,
      whatsappGroup: "https://chat.whatsapp.com/demo",
      status: "active", createdBy: z.createdBy, createdAt: now, updatedAt: now,
      hubType: z.hubType,
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

/**
 * Demo de inventario + movimientos (lotes) para un centro YA existente
 * (Refugio Catia La Mar / `zona-catia`). Deja el inventario con stock real y un
 * historial de entradas/salidas repartido en hoy / ayer / días previos, para que
 * el ledger agrupado por día se vea completo. Aditiva e idempotente (marcador
 * propio `meta/inventoryMovementsDemo`, distinto del de supplyDemo) — así corre
 * aunque ya hubieras seedeado la demo de zonas. Solo emulador.
 *
 * Coordinadora del centro: María González (maria@demo.com) — queda en `createdBy`
 * (del seed de zonas) y también en el array `coordinators` que agregamos aquí,
 * de modo que "Administrar" y el tab "Coordinadores" muestren un responsable.
 */
export async function seedInventoryMovementsDemo(): Promise<void> {
  const marker = db.doc("meta/inventoryMovementsDemo");
  if ((await marker.get()).exists) return;

  const hubId = "zona-catia";
  const hubRef = db.doc(`resourceHubs/${hubId}`);
  if (!(await hubRef.get()).exists) return; // depende de seedSupplyDemo

  const nowMs = Date.now();
  const daysAgo = (d: number) => new Date(nowMs - d * 24 * 3600 * 1000).toISOString();
  const today = daysAgo(0);
  const yesterday = daysAgo(1);
  const earlier = daysAgo(4);

  // Coordinadora del centro (además de `createdBy`). Habilita "Administrar" sin ser
  // admin/sudo y da contenido al tab "Coordinadores".
  await hubRef.set(
    { coordinators: [{ email: "maria@demo.com", name: "María González" }], updatedAt: today },
    { merge: true },
  );

  // Stock real. Sin `status` → no entran a la cola de necesidades: es inventario puro.
  const stock: Array<{ id: string; name: string; category: InventoryCategory; quantity: number; unit: string }> = [
    { id: "inv-arroz-catia", name: "Arroz", category: "food", quantity: 45, unit: "kg" },
    { id: "inv-agua-catia", name: "Agua embotellada", category: "water", quantity: 140, unit: "botellas" },
    { id: "inv-enlatados-catia", name: "Enlatados", category: "food", quantity: 85, unit: "latas" },
    { id: "inv-panales-catia", name: "Pañales", category: "hygiene", quantity: 32, unit: "paquetes" },
    { id: "inv-mantas-catia", name: "Mantas", category: "shelter", quantity: 60, unit: "unidades" },
    { id: "inv-botiquin-catia", name: "Kit de primeros auxilios", category: "medical", quantity: 12, unit: "cajas" },
  ];
  for (const s of stock) {
    const urgency = s.quantity === 0 ? "depleted" : s.quantity <= 5 ? "low" : "available";
    await db.doc(`resourceHubs/${hubId}/inventory/${s.id}`).set({
      id: s.id, name: s.name, category: s.category, quantity: s.quantity, unit: s.unit,
      urgency, updatedAt: today,
    });
  }

  // Historial de lotes. `quantity` SIEMPRE positivo; el signo lo da el `type`.
  // `resultingQty` = saldo del ítem tras aplicar esa línea (alimenta el "→ saldo").
  // Los saldos cuadran con el stock final de arriba.
  const movements: InventoryMovement[] = [
    {
      id: "mov-catia-1", type: "entrada", reason: "Donación recibida de la Alcaldía",
      note: "Camión de la Alcaldía de Vargas.", createdAt: earlier,
      actorEmail: "maria@demo.com", actorName: "María González",
      lines: [
        { itemId: "inv-arroz-catia", itemName: "Arroz", unit: "kg", category: "food", quantity: 80, resultingQty: 80 },
        { itemId: "inv-agua-catia", itemName: "Agua embotellada", unit: "botellas", category: "water", quantity: 200, resultingQty: 200 },
      ],
    },
    {
      id: "mov-catia-2", type: "entrada", reason: "Compra", createdAt: yesterday,
      actorEmail: "maria@demo.com", actorName: "María González",
      lines: [
        { itemId: "inv-enlatados-catia", itemName: "Enlatados", unit: "latas", category: "food", quantity: 85, resultingQty: 85 },
        { itemId: "inv-panales-catia", itemName: "Pañales", unit: "paquetes", category: "hygiene", quantity: 40, resultingQty: 40 },
      ],
    },
    {
      id: "mov-catia-3", type: "salida", reason: "Reparto a 40 familias", createdAt: yesterday,
      actorEmail: "maria@demo.com", actorName: "María González",
      lines: [
        { itemId: "inv-arroz-catia", itemName: "Arroz", unit: "kg", category: "food", quantity: 20, resultingQty: 60 },
        { itemId: "inv-agua-catia", itemName: "Agua embotellada", unit: "botellas", category: "water", quantity: 60, resultingQty: 140 },
      ],
    },
    {
      id: "mov-catia-4", type: "entrada", reason: "Donación recibida", createdAt: today,
      actorEmail: "maria@demo.com", actorName: "María González",
      lines: [
        { itemId: "inv-mantas-catia", itemName: "Mantas", unit: "unidades", category: "shelter", quantity: 60, resultingQty: 60 },
        { itemId: "inv-botiquin-catia", itemName: "Kit de primeros auxilios", unit: "cajas", category: "medical", quantity: 12, resultingQty: 12 },
      ],
    },
    {
      id: "mov-catia-5", type: "salida", reason: "Reparto a comedor comunitario", createdAt: today,
      actorEmail: "maria@demo.com", actorName: "María González",
      lines: [
        { itemId: "inv-arroz-catia", itemName: "Arroz", unit: "kg", category: "food", quantity: 15, resultingQty: 45 },
        { itemId: "inv-panales-catia", itemName: "Pañales", unit: "paquetes", category: "hygiene", quantity: 8, resultingQty: 32 },
      ],
    },
  ];
  for (const mv of movements) {
    await db.doc(`resourceHubs/${hubId}/movements/${mv.id}`).set(mv);
  }

  await marker.set({ seededAt: today });
}

/**
 * Demo de NECESIDADES manuales (desacopladas del inventario). Las crea "el
 * coordinador" a mano: título libre, urgencia manual (alta/media/baja) y el
 * lifecycle abierta → tomada → confirmada. Cubre los 3 estados y las 3
 * urgencias en contexto de cocina/acopio. Aditiva e idempotente
 * (marcador propio `meta/needsDemo`). Solo emulador. Depende de seedSupplyDemo.
 */
export async function seedNeedsDemo(): Promise<void> {
  const marker = db.doc("meta/needsDemo");
  if ((await marker.get()).exists) return;

  const catia = db.doc("resourceHubs/zona-catia");
  if (!(await catia.get()).exists) return; // depende de seedSupplyDemo
  const maiqExists = (await db.doc("resourceHubs/zona-maiquetia").get()).exists;

  const nowMs = Date.now();
  const daysAgo = (d: number) => new Date(nowMs - d * 24 * 3600 * 1000).toISOString();

  const needs: HubNeed[] = [
    // Refugio Catia La Mar (coordinadora María González)
    { id: "need-verduras-catia", hubId: "zona-catia", title: "Verduras para la sopa del mediodía", description: "Zanahoria, papa, auyama — para 120 platos.", category: "food", quantity: 15, unit: "kg", urgency: "alta", status: "abierta", reopenedCount: 0, createdBy: "maria@demo.com", createdByName: "María González", createdAt: daysAgo(0), updatedAt: daysAgo(0) },
    { id: "need-envases-catia", hubId: "zona-catia", title: "Envases para llevar comida", description: "Potes con tapa para el reparto.", category: "other", quantity: 200, unit: "unidades", urgency: "media", status: "abierta", reopenedCount: 0, createdBy: "maria@demo.com", createdByName: "María González", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: "need-gas-catia", hubId: "zona-catia", title: "Bombona de gas para cocinar", category: "other", quantity: 2, unit: "bombonas", urgency: "alta", status: "tomada", claimedBy: "carlos@demo.com", claimedByName: "Carlos Pérez", claimedAt: daysAgo(0), eta: "Hoy en la tarde", reopenedCount: 0, createdBy: "maria@demo.com", createdByName: "María González", createdAt: daysAgo(1), updatedAt: daysAgo(0) },
    { id: "need-voluntarios-catia", hubId: "zona-catia", title: "Voluntarios para servir y limpiar", category: "other", quantity: 5, unit: "personas", urgency: "baja", status: "abierta", reopenedCount: 0, createdBy: "maria@demo.com", createdByName: "María González", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    // Brigada Móvil Maiquetía (coordinador Carlos Pérez)
    { id: "need-agua-maiq", hubId: "zona-maiquetia", title: "Agua potable", category: "water", quantity: 100, unit: "botellas", urgency: "alta", status: "confirmada", claimedByName: "Pedro Ramos", confirmedBy: "carlos@demo.com", confirmedByName: "Carlos Pérez", confirmedAt: daysAgo(0), reopenedCount: 0, createdBy: "carlos@demo.com", createdByName: "Carlos Pérez", createdAt: daysAgo(2), updatedAt: daysAgo(0) },
    { id: "need-cloro-maiq", hubId: "zona-maiquetia", title: "Cloro y jabón para limpieza", category: "hygiene", urgency: "media", status: "abierta", reopenedCount: 0, createdBy: "carlos@demo.com", createdByName: "Carlos Pérez", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  ];

  for (const nd of needs) {
    if (nd.hubId === "zona-maiquetia" && !maiqExists) continue;
    await db.doc(`resourceHubs/${nd.hubId}/needs/${nd.id}`).set(nd);
  }

  await marker.set({ seededAt: daysAgo(0) });
}

/** Upsert an admin by email. Defaults to Fundador (rol raíz, solo por seed). */
export async function ensureAdmin(email: string, role: AdminRole = "sudo"): Promise<void> {
  const key = email.toLowerCase();
  await db.doc(`adminUsers/${key}`).set({ email: key, role });
}

export async function main(): Promise<void> {
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  const email = process.argv[2] || process.env.SEED_ADMIN_EMAIL;

  if (isEmulator) {
    await seedDemoData();
    await seedSupplyDemo();
    await seedInventoryMovementsDemo();
    await seedNeedsDemo();
    logger.info("seed: demo data written (emulator)");
    console.log("✓ Demo data seeded (emulator): zonas + inventario + necesidades manuales.");
    console.log("  ↳ Refugio Catia La Mar (zona-catia): inventario + movimientos + necesidades. Coordinadora: María González <maria@demo.com>.");
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
