// Migración idempotente de roles (Workstream 1). SOLO EMULADOR.
//
//   npm run migrate:roles        (ver functions/package.json)
//
//   adminUsers:  authority | command  -> organizador
//   adminUsers:  sudo                 -> fundador
//   users:       responder            -> coordinador
//
// Es idempotente: los documentos ya migrados (con rol nuevo) se saltan, así que
// correrla dos veces no rompe nada. Nunca se ejecuta en automático en un deploy.

import { db } from "../firebase";
import { assertEmulator } from "../guard";

const ADMIN_MAP: Record<string, string> = {
  authority: "organizador",
  command: "organizador",
  sudo: "fundador",
};
const USER_MAP: Record<string, string> = {
  responder: "coordinador",
};

async function migrate(): Promise<void> {
  assertEmulator("migrate:roles");

  let adminCount = 0;
  let userCount = 0;

  const admins = await db.collection("adminUsers").get();
  for (const d of admins.docs) {
    const role = (d.data() as { role?: string }).role;
    if (role && ADMIN_MAP[role]) {
      await d.ref.update({ role: ADMIN_MAP[role] });
      adminCount++;
    }
  }

  const users = await db.collection("users").get();
  for (const d of users.docs) {
    const role = (d.data() as { role?: string }).role;
    if (role && USER_MAP[role]) {
      await d.ref.update({ role: USER_MAP[role] });
      userCount++;
    }
  }

  console.log(`✓ Migración de roles completa. adminUsers migrados: ${adminCount}, users migrados: ${userCount}.`);
  process.exit(0);
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
