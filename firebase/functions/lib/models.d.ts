import { z } from "zod";
export declare const echoSchema: z.ZodObject<{
    message: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    name?: string | undefined;
}, {
    message: string;
    name?: string | undefined;
}>;
export declare const adminUserSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodEnum<["organizador", "fundador"]>;
}, "strip", z.ZodTypeAny, {
    role: "organizador" | "fundador";
    email: string;
}, {
    role: "organizador" | "fundador";
    email: string;
}>;
export declare const adminEmailSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const accessRequestSchema: z.ZodObject<{
    phone: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["rescatista", "coordinador"]>>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    note?: string | undefined;
    role?: "rescatista" | "coordinador" | undefined;
}, {
    phone: string;
    note?: string | undefined;
    role?: "rescatista" | "coordinador" | undefined;
}>;
export declare const reportSchema: z.ZodObject<{
    type: z.ZodEnum<["personal", "proxy"]>;
    category: z.ZodEnum<["medical", "structural", "obstruction", "resource"]>;
    triageLevel: z.ZodNumber;
    lat: z.ZodNumber;
    lng: z.ZodNumber;
    description: z.ZodString;
    unit: z.ZodOptional<z.ZodString>;
    locationPrecise: z.ZodOptional<z.ZodBoolean>;
    subjectName: z.ZodOptional<z.ZodString>;
    subjectDetails: z.ZodOptional<z.ZodString>;
    lastSeen: z.ZodOptional<z.ZodString>;
    contact: z.ZodOptional<z.ZodString>;
    structuralDamage: z.ZodOptional<z.ZodEnum<["minor", "moderate", "severe", "collapse"]>>;
    resourceType: z.ZodOptional<z.ZodEnum<["water", "food", "medical", "shelter", "tools", "other"]>>;
    medicalCount: z.ZodOptional<z.ZodEnum<["1", "2-5", "6-10", "10+"]>>;
    obstructionType: z.ZodOptional<z.ZodEnum<["landslide", "debris", "trees", "vehicles", "other"]>>;
}, "strip", z.ZodTypeAny, {
    description: string;
    category: "medical" | "structural" | "obstruction" | "resource";
    triageLevel: number;
    lat: number;
    lng: number;
    type: "personal" | "proxy";
    subjectName?: string | undefined;
    subjectDetails?: string | undefined;
    lastSeen?: string | undefined;
    contact?: string | undefined;
    structuralDamage?: "moderate" | "minor" | "severe" | "collapse" | undefined;
    resourceType?: "medical" | "water" | "food" | "shelter" | "tools" | "other" | undefined;
    medicalCount?: "1" | "2-5" | "6-10" | "10+" | undefined;
    obstructionType?: "other" | "landslide" | "debris" | "trees" | "vehicles" | undefined;
    unit?: string | undefined;
    locationPrecise?: boolean | undefined;
}, {
    description: string;
    category: "medical" | "structural" | "obstruction" | "resource";
    triageLevel: number;
    lat: number;
    lng: number;
    type: "personal" | "proxy";
    subjectName?: string | undefined;
    subjectDetails?: string | undefined;
    lastSeen?: string | undefined;
    contact?: string | undefined;
    structuralDamage?: "moderate" | "minor" | "severe" | "collapse" | undefined;
    resourceType?: "medical" | "water" | "food" | "shelter" | "tools" | "other" | undefined;
    medicalCount?: "1" | "2-5" | "6-10" | "10+" | undefined;
    obstructionType?: "other" | "landslide" | "debris" | "trees" | "vehicles" | undefined;
    unit?: string | undefined;
    locationPrecise?: boolean | undefined;
}>;
export declare const statusSchema: z.ZodObject<{
    status: z.ZodEnum<["green", "yellow", "red"]>;
}, "strip", z.ZodTypeAny, {
    status: "green" | "yellow" | "red";
}, {
    status: "green" | "yellow" | "red";
}>;
export declare const resolutionConfirmSchema: z.ZodObject<{
    confirmed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    confirmed: boolean;
}, {
    confirmed: boolean;
}>;
export declare const announcementSchema: z.ZodObject<{
    category: z.ZodEnum<["urgent", "logistics", "correction"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    category: "urgent" | "logistics" | "correction";
    message: string;
}, {
    category: "urgent" | "logistics" | "correction";
    message: string;
}>;
export declare const missingPersonSchema: z.ZodObject<{
    name: z.ZodString;
    dni: z.ZodOptional<z.ZodString>;
    details: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    lastSeen: z.ZodOptional<z.ZodString>;
    lat: z.ZodOptional<z.ZodNumber>;
    lng: z.ZodOptional<z.ZodNumber>;
    phone: z.ZodOptional<z.ZodString>;
    contactPhone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    lastSeen?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    phone?: string | undefined;
    dni?: string | undefined;
    details?: string | undefined;
    address?: string | undefined;
    contactPhone?: string | undefined;
}, {
    name: string;
    lastSeen?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    phone?: string | undefined;
    dni?: string | undefined;
    details?: string | undefined;
    address?: string | undefined;
    contactPhone?: string | undefined;
}>;
export declare const missingFoundSchema: z.ZodObject<{
    byPhone: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    note?: string | undefined;
    byPhone?: string | undefined;
}, {
    note?: string | undefined;
    byPhone?: string | undefined;
}>;
export declare const locationRequestSchema: z.ZodObject<{
    buildingName: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
    lat: z.ZodOptional<z.ZodNumber>;
    lng: z.ZodOptional<z.ZodNumber>;
    note: z.ZodOptional<z.ZodString>;
    contactPhone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    buildingName: string;
    lat?: number | undefined;
    lng?: number | undefined;
    note?: string | undefined;
    address?: string | undefined;
    contactPhone?: string | undefined;
}, {
    buildingName: string;
    lat?: number | undefined;
    lng?: number | undefined;
    note?: string | undefined;
    address?: string | undefined;
    contactPhone?: string | undefined;
}>;
export declare const locationResolveSchema: z.ZodObject<{
    condition: z.ZodEnum<["safe", "damaged", "collapsed", "unknown"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
    condition: "safe" | "damaged" | "collapsed" | "unknown";
}, {
    note: string;
    condition: "safe" | "damaged" | "collapsed" | "unknown";
}>;
export declare const admittedPatientSchema: z.ZodObject<{
    name: z.ZodString;
    dni: z.ZodOptional<z.ZodString>;
    hospitalName: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    hospitalName: string;
    name: string;
    dni?: string | undefined;
    notes?: string | undefined;
}, {
    hospitalName: string;
    name: string;
    dni?: string | undefined;
    notes?: string | undefined;
}>;
export declare const hospitalInputSchema: z.ZodObject<{
    hospitalName: z.ZodString;
    textInput: z.ZodOptional<z.ZodString>;
    imageBase64: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    hospitalName: string;
    textInput?: string | undefined;
    imageBase64?: string | undefined;
}, {
    hospitalName: string;
    textInput?: string | undefined;
    imageBase64?: string | undefined;
}>;
export declare const hubCreateSchema: z.ZodObject<{
    name: z.ZodString;
    address: z.ZodString;
    lat: z.ZodNumber;
    lng: z.ZodNumber;
    contactPhone: z.ZodString;
    contactName: z.ZodString;
    whatsappGroup: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    lat: number;
    lng: number;
    name: string;
    address: string;
    contactPhone: string;
    contactName: string;
    whatsappGroup?: string | undefined;
}, {
    lat: number;
    lng: number;
    name: string;
    address: string;
    contactPhone: string;
    contactName: string;
    whatsappGroup?: string | undefined;
}>;
export declare const hubUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    contactPhone: z.ZodOptional<z.ZodString>;
    contactName: z.ZodOptional<z.ZodString>;
    whatsappGroup: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "closed"]>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    status?: "active" | "closed" | undefined;
    address?: string | undefined;
    contactPhone?: string | undefined;
    contactName?: string | undefined;
    whatsappGroup?: string | undefined;
}, {
    name?: string | undefined;
    status?: "active" | "closed" | undefined;
    address?: string | undefined;
    contactPhone?: string | undefined;
    contactName?: string | undefined;
    whatsappGroup?: string | undefined;
}>;
export declare const inventoryUpsertSchema: z.ZodObject<{
    category: z.ZodEnum<["water", "food", "tools", "medical", "shelter", "clothing", "hygiene", "other"]>;
    name: z.ZodString;
    quantity: z.ZodNumber;
    unit: z.ZodString;
    urgency: z.ZodOptional<z.ZodEnum<["available", "low", "depleted"]>>;
}, "strip", z.ZodTypeAny, {
    category: "medical" | "water" | "food" | "shelter" | "tools" | "other" | "clothing" | "hygiene";
    name: string;
    unit: string;
    quantity: number;
    urgency?: "low" | "available" | "depleted" | undefined;
}, {
    category: "medical" | "water" | "food" | "shelter" | "tools" | "other" | "clothing" | "hygiene";
    name: string;
    unit: string;
    quantity: number;
    urgency?: "low" | "available" | "depleted" | undefined;
}>;
export declare const inventoryAdjustSchema: z.ZodObject<{
    delta: z.ZodNumber;
    action: z.ZodEnum<["restock", "distribute", "adjust"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    delta: number;
    action: "restock" | "distribute" | "adjust";
    note?: string | undefined;
}, {
    delta: number;
    action: "restock" | "distribute" | "adjust";
    note?: string | undefined;
}>;
export declare const hubCoordinatorSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const needConfirmSchema: z.ZodObject<{
    proofUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    proofUrl?: string | undefined;
}, {
    proofUrl?: string | undefined;
}>;
