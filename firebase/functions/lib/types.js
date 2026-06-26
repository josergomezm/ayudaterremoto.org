"use strict";
// Domain types shared across the API. Data now lives in Firestore (see firebase.ts
// + seed.ts); these describe the document shapes.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_RANK = void 0;
exports.ROLE_RANK = {
    civilian: 0, responder: 1, authority: 2, command: 3, sudo: 4,
};
