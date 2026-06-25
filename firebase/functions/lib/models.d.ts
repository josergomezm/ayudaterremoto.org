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
export declare const verifyLookupSchema: z.ZodObject<{
    nac: z.ZodEnum<["V", "E"]>;
    dni: z.ZodString;
}, "strip", z.ZodTypeAny, {
    nac: "V" | "E";
    dni: string;
}, {
    nac: "V" | "E";
    dni: string;
}>;
export declare const verifyConfirmSchema: z.ZodObject<{
    challengeId: z.ZodString;
    selectedName: z.ZodString;
    vouchCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    challengeId: string;
    selectedName: string;
    vouchCode?: string | undefined;
}, {
    challengeId: string;
    selectedName: string;
    vouchCode?: string | undefined;
}>;
export declare const adminUserSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodEnum<["authority", "command"]>;
}, "strip", z.ZodTypeAny, {
    role: "authority" | "command";
    email: string;
}, {
    role: "authority" | "command";
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
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    note?: string | undefined;
}, {
    note?: string | undefined;
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
}, "strip", z.ZodTypeAny, {
    description: string;
    category: "medical" | "structural" | "obstruction" | "resource";
    type: "personal" | "proxy";
    triageLevel: number;
    lat: number;
    lng: number;
    unit?: string | undefined;
    locationPrecise?: boolean | undefined;
    subjectName?: string | undefined;
    subjectDetails?: string | undefined;
    lastSeen?: string | undefined;
    contact?: string | undefined;
}, {
    description: string;
    category: "medical" | "structural" | "obstruction" | "resource";
    type: "personal" | "proxy";
    triageLevel: number;
    lat: number;
    lng: number;
    unit?: string | undefined;
    locationPrecise?: boolean | undefined;
    subjectName?: string | undefined;
    subjectDetails?: string | undefined;
    lastSeen?: string | undefined;
    contact?: string | undefined;
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
    details: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    lastSeen: z.ZodOptional<z.ZodString>;
    lat: z.ZodOptional<z.ZodNumber>;
    lng: z.ZodOptional<z.ZodNumber>;
    phone: z.ZodOptional<z.ZodString>;
    contactPhone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    lat?: number | undefined;
    lng?: number | undefined;
    lastSeen?: string | undefined;
    details?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    contactPhone?: string | undefined;
}, {
    name: string;
    lat?: number | undefined;
    lng?: number | undefined;
    lastSeen?: string | undefined;
    details?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
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
