import { z } from "zod";

// One zod schema per endpoint body. Add new endpoints' schemas here, then a
// matching route branch in api.ts (see README "How to add an API endpoint").

export const echoSchema = z.object({
  message: z.string().min(1),
  name: z.string().optional(),
});

const nacSchema = z.enum(["V", "E"]);
const dniSchema = z.string().regex(/^\d{6,9}$/, "Cédula must be 6–9 digits");

// Verification — step 1: look up a Cédula and get the name-match grid.
export const verifyLookupSchema = z.object({
  nac: nacSchema,
  dni: dniSchema,
});

// Verification — step 2: pick the right name, optionally redeem a vouch code.
export const verifyConfirmSchema = z.object({
  challengeId: z.string().min(1),
  selectedName: z.string().min(1),
  vouchCode: z.string().optional(),
});

// Vouch codes always grant the Responder role, so generation needs no body.
// Admin-role management (Command only):
export const adminUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["authority", "command"]),
});

export const adminEmailSchema = z.object({
  email: z.string().email(),
});

// A signed-in Google user requests vouching access.
export const accessRequestSchema = z.object({
  note: z.string().max(500).optional(),
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
