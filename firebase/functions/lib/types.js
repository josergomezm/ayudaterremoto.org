"use strict";
// Domain types shared across the API. Data now lives in Firestore (see firebase.ts
// + seed.ts); these describe the document shapes.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_RANK = void 0;
exports.ROLE_RANK = {
    colaborador: 0, coordinador: 1, organizador: 2, fundador: 3,
};
