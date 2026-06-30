import { z } from "zod";

// One zod schema per endpoint body. Add new endpoints' schemas here, then a
// matching route branch in api.ts (see README "How to add an API endpoint").

export const echoSchema = z.object({
  message: z.string().min(1),
  name: z.string().optional(),
});



// Vouch codes always grant the Responder role, so generation needs no body.
// Admin-role management (Command only):
export const adminUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "sudo"]),
});

export const adminEmailSchema = z.object({
  email: z.string().email(),
});

// A signed-in Google user requests access (coordinator or responder).
export const accessRequestSchema = z.object({
  phone: z.string().min(5),
  note: z.string().max(500).optional(),
  role: z.enum(["rescuer", "coordinator"]).optional(),
  brigade: z.string().optional(),
  brigadeRole: z.string().optional(),
  hubId: z.string().optional().nullable(),
  hubName: z.string().optional().nullable(),
});

const categorySchema = z.enum(["medical", "structural", "obstruction", "resource"]);

// Submit a report (personal or proxy).
export const reportSchema = z.object({
  type: z.enum(["personal", "proxy"]),
  category: categorySchema,
  triageLevel: z.number().int().min(1).max(5),
  lat: z.number(),
  lng: z.number(),
  description: z.string().min(1),
  unit: z.string().optional(),              // floor / apartment — keeps vertical incidents distinct
  locationPrecise: z.boolean().optional(),  // false when GPS failed and a fallback pin was used
  subjectName: z.string().optional(),       // proxy: person name
  subjectDetails: z.string().optional(),    // proxy: age / appearance
  lastSeen: z.string().optional(),          // proxy: when/where last seen
  contact: z.string().optional(),           // proxy: reporter relationship / phone
  structuralDamage: z.enum(["minor", "moderate", "severe", "collapse"]).optional(),
  resourceType: z.enum(["water", "food", "medical", "shelter", "tools", "other"]).optional(),
  medicalCount: z.enum(["1", "2-5", "6-10", "10+"]).optional(),
  obstructionType: z.enum(["landslide", "debris", "trees", "vehicles", "other"]).optional(),
});

export const statusSchema = z.object({
  status: z.enum(["green", "yellow", "red"]),
});

export const resolutionConfirmSchema = z.object({
  confirmed: z.boolean(),
});

export const announcementSchema = z.object({
  category: z.enum(["urgent", "logistics", "correction"]),
  message: z.string().min(1),
});

// Report a missing person (verified users). Reading the list is public.
export const missingPersonSchema = z.object({
  name: z.string().min(1),
  dni: z.string().optional(),
  details: z.string().optional(),
  address: z.string().optional(),
  lastSeen: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  phone: z.string().optional(),
  // contactName is NOT accepted from the client — it's set server-side from the
  // reporter's verified identity.
  contactPhone: z.string().optional(),
});

// Marking a person found. The finder's NAME comes from their verified identity;
// we only ask for an optional callback phone + how they know.
export const missingFoundSchema = z.object({
  byPhone: z.string().optional(),
  note: z.string().optional(),
});

export const locationRequestSchema = z.object({
  buildingName: z.string().min(3),
  address: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  note: z.string().optional(),
  contactPhone: z.string().optional(),
});

export const locationResolveSchema = z.object({
  condition: z.enum(["safe", "damaged", "collapsed", "unknown"]),
  note: z.string().min(5),
});

export const admittedPatientSchema = z.object({
  name: z.string().min(2),
  dni: z.string().optional(),
  hospitalName: z.string().min(2),
  notes: z.string().optional(),
});

export const hospitalInputSchema = z.object({
  hospitalName: z.string().min(2),
  textInput: z.string().optional(),
  imageBase64: z.string().optional(),
});

export const hubCreateSchema = z.object({
  name: z.string().min(3),
  address: z.string().min(3),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  contactPhone: z.string().min(5),
  contactName: z.string().min(2),
  whatsappGroup: z.string().optional(),
  hubType: z.enum(["static", "mobile"]).optional(),
  offersShelter: z.boolean().optional(),
  shelterCapacity: z.number().int().nonnegative().optional(),
});

export const hubUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  address: z.string().min(3).optional(),
  contactPhone: z.string().min(5).optional(),
  contactName: z.string().min(2).optional(),
  whatsappGroup: z.string().optional(),
  status: z.enum(["active", "closed"]).optional(),
  hubType: z.enum(["static", "mobile"]).optional(),
  offersShelter: z.boolean().optional(),
  shelterCapacity: z.number().int().nonnegative().optional(),
});

export const inventoryUpsertSchema = z.object({
  category: z.enum(["water", "food", "tools", "medical", "shelter", "clothing", "hygiene", "other"]),
  name: z.string().min(1),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  urgency: z.enum(["available", "low", "depleted"]).optional(),
});

export const inventoryAdjustSchema = z.object({
  delta: z.number(),
  action: z.enum(["restock", "distribute", "adjust"]),
  note: z.string().optional(),
});

export const hubCoordinatorSchema = z.object({
  email: z.string().email(),
});

// Confirmar una necesidad (Workstream 3) — proofUrl opcional (solo un enlace).
export const needConfirmSchema = z.object({
  proofUrl: z.string().url().optional(),
});

// Movimiento de inventario ("lote"): entrada o salida, multi-ítem, con razón.
// Cada línea referencia un ítem existente (itemId) o define uno nuevo (name/category/unit).
const movementLineSchema = z
  .object({
    itemId: z.string().optional(),
    name: z.string().optional(),
    category: z.enum(["water", "food", "tools", "medical", "shelter", "clothing", "hygiene", "other"]).optional(),
    unit: z.string().optional(),
    quantity: z.number().positive(),
  })
  .refine((l) => !!l.itemId || (!!l.name && !!l.unit && !!l.category), {
    message: "Cada línea debe elegir un ítem existente o definir uno nuevo (nombre, categoría, unidad).",
  });

export const movementSchema = z.object({
  type: z.enum(["entrada", "salida"]),
  reason: z.string().min(1),
  note: z.string().optional(),
  lines: z.array(movementLineSchema).min(1),
});

// Rescuer & Brigade Flow Additions
export const updateBrigadeSchema = z.object({
  brigade: z.string().optional(),
  brigadeRole: z.string().optional(),
});

export const assignmentUpdateSchema = z.object({
  status: z.enum(["unassigned", "assigned", "en_route", "on_site", "handling", "resolved", "evacuated"]),
  eta: z.string().optional(),
  notes: z.string().optional(),
});

export const reverifySchema = z.object({
  notes: z.string().min(1),
});

export const resolveOutcomeSchema = z.object({
  outcomeSurvivors: z.number().int().min(0).optional(),
  outcomeDeceased: z.number().int().min(0).optional(),
  outcomeInjured: z.number().int().min(0).optional(),
  outcomeStructuralDamage: z.enum(["none", "minor", "moderate", "severe", "collapse"]).optional(),
  outcomeDetails: z.string().optional(),
});
