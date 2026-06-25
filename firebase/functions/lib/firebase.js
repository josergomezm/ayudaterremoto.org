"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuth = exports.db = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
// One admin app per instance. In the Emulator Suite the admin SDK auto-connects
// to the Firestore and Auth emulators via the FIRESTORE_EMULATOR_HOST and
// FIREBASE_AUTH_EMULATOR_HOST env vars the emulator sets — no credentials needed.
if ((0, app_1.getApps)().length === 0)
    (0, app_1.initializeApp)();
exports.db = (0, firestore_1.getFirestore)();
// Optional fields are often undefined (e.g. a personal report has no subjectName);
// without this, Firestore throws "Cannot use undefined as a Firestore value".
exports.db.settings({ ignoreUndefinedProperties: true });
exports.adminAuth = (0, auth_1.getAuth)();
