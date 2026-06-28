"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.needConfirmSchema = exports.hubCoordinatorSchema = exports.inventoryAdjustSchema = exports.inventoryUpsertSchema = exports.hubUpdateSchema = exports.hubCreateSchema = exports.hospitalInputSchema = exports.admittedPatientSchema = exports.locationResolveSchema = exports.locationRequestSchema = exports.missingFoundSchema = exports.missingPersonSchema = exports.announcementSchema = exports.resolutionConfirmSchema = exports.statusSchema = exports.reportSchema = exports.accessRequestSchema = exports.adminEmailSchema = exports.adminUserSchema = exports.echoSchema = void 0;
const zod_1 = require("zod");
// One zod schema per endpoint body. Add new endpoints' schemas here, then a
// matching route branch in api.ts (see README "How to add an API endpoint").
exports.echoSchema = zod_1.z.object({
    message: zod_1.z.string().min(1),
    name: zod_1.z.string().optional(),
});
// Vouch codes always grant the Responder role, so generation needs no body.
// Admin-role management (Command only):
exports.adminUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    role: zod_1.z.enum(["organizador", "fundador"]),
});
exports.adminEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
// A signed-in Google user requests access (coordinator or responder).
exports.accessRequestSchema = zod_1.z.object({
    phone: zod_1.z.string().min(5),
    note: zod_1.z.string().max(500).optional(),
});
const categorySchema = zod_1.z.enum(["medical", "structural", "obstruction", "resource"]);
// Submit a report (personal or proxy).
exports.reportSchema = zod_1.z.object({
    type: zod_1.z.enum(["personal", "proxy"]),
    category: categorySchema,
    triageLevel: zod_1.z.number().int().min(1).max(5),
    lat: zod_1.z.number(),
    lng: zod_1.z.number(),
    description: zod_1.z.string().min(1),
    unit: zod_1.z.string().optional(), // floor / apartment — keeps vertical incidents distinct
    locationPrecise: zod_1.z.boolean().optional(), // false when GPS failed and a fallback pin was used
    subjectName: zod_1.z.string().optional(), // proxy: person name
    subjectDetails: zod_1.z.string().optional(), // proxy: age / appearance
    lastSeen: zod_1.z.string().optional(), // proxy: when/where last seen
    contact: zod_1.z.string().optional(), // proxy: reporter relationship / phone
    structuralDamage: zod_1.z.enum(["minor", "moderate", "severe", "collapse"]).optional(),
    resourceType: zod_1.z.enum(["water", "food", "medical", "shelter", "tools", "other"]).optional(),
    medicalCount: zod_1.z.enum(["1", "2-5", "6-10", "10+"]).optional(),
    obstructionType: zod_1.z.enum(["landslide", "debris", "trees", "vehicles", "other"]).optional(),
});
exports.statusSchema = zod_1.z.object({
    status: zod_1.z.enum(["green", "yellow", "red"]),
});
exports.resolutionConfirmSchema = zod_1.z.object({
    confirmed: zod_1.z.boolean(),
});
exports.announcementSchema = zod_1.z.object({
    category: zod_1.z.enum(["urgent", "logistics", "correction"]),
    message: zod_1.z.string().min(1),
});
// Report a missing person (verified users). Reading the list is public.
exports.missingPersonSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    dni: zod_1.z.string().optional(),
    details: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    lastSeen: zod_1.z.string().optional(),
    lat: zod_1.z.number().optional(),
    lng: zod_1.z.number().optional(),
    phone: zod_1.z.string().optional(),
    // contactName is NOT accepted from the client — it's set server-side from the
    // reporter's verified identity.
    contactPhone: zod_1.z.string().optional(),
});
// Marking a person found. The finder's NAME comes from their verified identity;
// we only ask for an optional callback phone + how they know.
exports.missingFoundSchema = zod_1.z.object({
    byPhone: zod_1.z.string().optional(),
    note: zod_1.z.string().optional(),
});
exports.locationRequestSchema = zod_1.z.object({
    buildingName: zod_1.z.string().min(3),
    address: zod_1.z.string().optional(),
    lat: zod_1.z.number().min(-90).max(90).optional(),
    lng: zod_1.z.number().min(-180).max(180).optional(),
    note: zod_1.z.string().optional(),
    contactPhone: zod_1.z.string().optional(),
});
exports.locationResolveSchema = zod_1.z.object({
    condition: zod_1.z.enum(["safe", "damaged", "collapsed", "unknown"]),
    note: zod_1.z.string().min(5),
});
exports.admittedPatientSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    dni: zod_1.z.string().optional(),
    hospitalName: zod_1.z.string().min(2),
    notes: zod_1.z.string().optional(),
});
exports.hospitalInputSchema = zod_1.z.object({
    hospitalName: zod_1.z.string().min(2),
    textInput: zod_1.z.string().optional(),
    imageBase64: zod_1.z.string().optional(),
});
exports.hubCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(3),
    address: zod_1.z.string().min(3),
    lat: zod_1.z.number().min(-90).max(90),
    lng: zod_1.z.number().min(-180).max(180),
    contactPhone: zod_1.z.string().min(5),
    contactName: zod_1.z.string().min(2),
    whatsappGroup: zod_1.z.string().optional(),
});
exports.hubUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).optional(),
    address: zod_1.z.string().min(3).optional(),
    contactPhone: zod_1.z.string().min(5).optional(),
    contactName: zod_1.z.string().min(2).optional(),
    whatsappGroup: zod_1.z.string().optional(),
    status: zod_1.z.enum(["active", "closed"]).optional(),
});
exports.inventoryUpsertSchema = zod_1.z.object({
    category: zod_1.z.enum(["water", "food", "tools", "medical", "shelter", "clothing", "hygiene", "other"]),
    name: zod_1.z.string().min(1),
    quantity: zod_1.z.number().min(0),
    unit: zod_1.z.string().min(1),
    urgency: zod_1.z.enum(["available", "low", "depleted"]).optional(),
});
exports.inventoryAdjustSchema = zod_1.z.object({
    delta: zod_1.z.number(),
    action: zod_1.z.enum(["restock", "distribute", "adjust"]),
    note: zod_1.z.string().optional(),
});
exports.hubCoordinatorSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
// Confirmar una necesidad (Workstream 3) — proofUrl opcional (solo un enlace).
exports.needConfirmSchema = zod_1.z.object({
    proofUrl: zod_1.z.string().url().optional(),
});
