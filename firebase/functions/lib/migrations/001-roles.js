"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../firebase");
const guard_1 = require("../guard");
const ADMIN_MAP = {
    authority: "organizador",
    command: "organizador",
    sudo: "fundador",
};
const USER_MAP = {
    responder: "coordinador",
};
async function migrate() {
    (0, guard_1.assertEmulator)("migrate:roles");
    let adminCount = 0;
    let userCount = 0;
    const admins = await firebase_1.db.collection("adminUsers").get();
    for (const d of admins.docs) {
        const role = d.data().role;
        if (role && ADMIN_MAP[role]) {
            await d.ref.update({ role: ADMIN_MAP[role] });
            adminCount++;
        }
    }
    const users = await firebase_1.db.collection("users").get();
    for (const d of users.docs) {
        const role = d.data().role;
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
