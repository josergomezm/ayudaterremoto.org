"use strict";
// "The hidden net" (crisis spec §7). Uses the Gemini API to scan a report's
// free-text description and decide whether it understates the emergency
// (panic misclassification). The API key comes from Secret Manager via
// defineSecret in api.ts. This NEVER blocks a report: any failure/timeout
// returns null and the report proceeds with the user's declared triage.
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessReport = assessReport;
exports.severityToLevel = severityToLevel;
exports.distanceMeters = distanceMeters;
exports.analyzeImage = analyzeImage;
exports.geocodeAddress = geocodeAddress;
exports.analyzePatientList = analyzePatientList;
exports.fuzzyNameMatch = fuzzyNameMatch;
const v2_1 = require("firebase-functions/v2");
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT_MS = 5000;
async function assessReport(opts) {
    const { description, category, declaredLevel, apiKey } = opts;
    if (!apiKey || !description)
        return null;
    const prompt = "Eres un clasificador de triaje para una app de respuesta ante terremotos en Venezuela. " +
        "Analiza la descripción de un reporte y decide si la situación es MÁS grave que el nivel declarado por el usuario.\n\n" +
        `Categoría: ${category}\n` +
        `Nivel declarado: ${declaredLevel} (1=crítico … 5=leve)\n` +
        `Descripción: """${description}"""\n\n` +
        'Señales de mayor gravedad: personas atrapadas, alguien que no respira, olor a gas, fuego, colapso estructural, sangrado grave.\n' +
        'Responde SOLO con JSON: {"escalate": boolean, "severity": "critical"|"high"|"moderate"|"low", "reason": "motivo breve en español, máx 120 caracteres"}. ' +
        "escalate=true solo si la descripción sugiere mayor gravedad que el nivel declarado.";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0 },
            }),
            signal: controller.signal,
        });
        if (!res.ok) {
            v2_1.logger.warn("gemini non-200", { status: res.status });
            return null;
        }
        const data = (await res.json());
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            return null;
        const parsed = JSON.parse(text);
        if (typeof parsed.escalate !== "boolean")
            return null;
        const severity = ["critical", "high", "moderate", "low"].includes(parsed.severity)
            ? parsed.severity
            : "moderate";
        return { escalate: parsed.escalate, severity, reason: String(parsed.reason ?? "").slice(0, 200) };
    }
    catch (e) {
        v2_1.logger.warn("gemini assess failed", { error: e instanceof Error ? e.message : String(e) });
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
function severityToLevel(s) {
    switch (s) {
        case "critical": return 1;
        case "high": return 2;
        case "moderate": return 3;
        default: return 4;
    }
}
/** Meters between two lat/lng points (haversine). For proximity clustering. */
function distanceMeters(aLat, aLng, bLat, bLng) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
async function analyzeImage(opts) {
    const { base64Data, mimeType, context, apiKey } = opts;
    if (!apiKey || !base64Data)
        return null;
    const prompt = "You are an AI assistant for a crisis-response platform in Venezuela.\n" +
        "Analyze this image and the provided context text to extract details of the emergency incident.\n\n" +
        `Context text: """${context || "No context text provided"}"""\n\n` +
        "You must return a JSON object with the following fields:\n" +
        "- category: 'medical' | 'structural' | 'obstruction' | 'resource'\n" +
        "- triageLevel: number (1=critical, 2=high, 3=moderate, 4=low, 5=minor)\n" +
        "- description: string (a concise summary of the emergency depicted, in Spanish, max 200 characters)\n" +
        "- locationSearchQuery: string (a query string for searching the location on OpenStreetMap, e.g., 'Altamira, Caracas' or a specific landmark/street mentioned. Keep it focused on Venezuela. Max 100 characters)\n" +
        "- subjectName: string | null (name of any trapped/injured/missing person if mentioned)\n" +
        "- subjectDetails: string | null (any description of the person: age, clothing, etc.)\n" +
        "- lastSeen: string | null (where/when they were last seen)\n" +
        "- contact: string | null (any contact phone or relationship mentioned)\n" +
        "- confidence: number (from 0 to 1, representing your confidence that this image depicts a real incident related to a crisis/earthquake)\n" +
        "- structuralDamage: 'minor' | 'moderate' | 'severe' | 'collapse' | null (only if category is 'structural')\n" +
        "- resourceType: 'water' | 'food' | 'medical' | 'shelter' | 'tools' | 'other' | null (only if category is 'resource')\n" +
        "- medicalCount: '1' | '2-5' | '6-10' | '10+' | null (only if category is 'medical')\n" +
        "- obstructionType: 'landslide' | 'debris' | 'trees' | 'vehicles' | 'other' | null (only if category is 'obstruction')\n\n" +
        "Return ONLY the raw JSON object. Do not include markdown code block formatting or any other text.";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000); // 10s timeout for image analysis
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Data,
                                },
                            },
                        ],
                    },
                ],
                generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
            }),
            signal: controller.signal,
        });
        if (!res.ok) {
            v2_1.logger.warn("gemini image analyze non-200", { status: res.status });
            return null;
        }
        const data = (await res.json());
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            return null;
        let sanitized = text.trim();
        if (sanitized.startsWith("```")) {
            sanitized = sanitized.replace(/^```json\s*/, "").replace(/```$/, "").trim();
        }
        const parsed = JSON.parse(sanitized);
        const category = ["medical", "structural", "obstruction", "resource"].includes(parsed.category)
            ? parsed.category
            : "structural";
        const triageLevel = typeof parsed.triageLevel === "number" && parsed.triageLevel >= 1 && parsed.triageLevel <= 5
            ? parsed.triageLevel
            : 3;
        const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
        const structuralDamage = ["minor", "moderate", "severe", "collapse"].includes(parsed.structuralDamage)
            ? parsed.structuralDamage
            : null;
        const resourceType = ["water", "food", "medical", "shelter", "tools", "other"].includes(parsed.resourceType)
            ? parsed.resourceType
            : null;
        const medicalCount = ["1", "2-5", "6-10", "10+"].includes(parsed.medicalCount)
            ? parsed.medicalCount
            : null;
        const obstructionType = ["landslide", "debris", "trees", "vehicles", "other"].includes(parsed.obstructionType)
            ? parsed.obstructionType
            : null;
        return {
            category,
            triageLevel,
            description: String(parsed.description ?? "").slice(0, 300),
            locationSearchQuery: String(parsed.locationSearchQuery ?? "").slice(0, 150),
            subjectName: parsed.subjectName || null,
            subjectDetails: parsed.subjectDetails || null,
            lastSeen: parsed.lastSeen || null,
            contact: parsed.contact || null,
            confidence,
            structuralDamage,
            resourceType,
            medicalCount,
            obstructionType,
        };
    }
    catch (e) {
        v2_1.logger.warn("gemini image analyze failed", { error: e instanceof Error ? e.message : String(e) });
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
async function geocodeAddress(query) {
    if (!query || query.trim().length === 0)
        return null;
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ", Venezuela")}&format=json&limit=1`;
        const res = await fetch(url, {
            headers: {
                "User-Agent": "AyudaTerremotoVenezuela/1.0 (jocrgomez93@gmail.com)",
            },
        });
        if (!res.ok)
            return null;
        const data = (await res.json());
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
            };
        }
    }
    catch (e) {
        v2_1.logger.warn("Geocoding failed", { query, error: e instanceof Error ? e.message : String(e) });
    }
    return null;
}
async function analyzePatientList(opts) {
    const { textInput, base64Data, mimeType, apiKey, hospitalName } = opts;
    if (!apiKey || (!textInput && !base64Data))
        return null;
    const prompt = "You are an AI assistant for a crisis-response platform in Venezuela.\n" +
        `Your task is to analyze a hospital admitted patient list for the hospital "${hospitalName}".\n` +
        "The list may be provided as text or as an image.\n\n" +
        (textInput ? `Input text:\n"""${textInput}"""\n\n` : "") +
        "Extract a JSON array of patient objects, where each object has these fields exactly:\n" +
        "- name: string (the patient's full name, properly capitalized, e.g., 'Juan Pérez')\n" +
        "- dni: string | null (the patient's Cédula de Identidad number, digits only. Remove any dots, dashes, or letters. E.g. '12345678'. Set to null if not specified or unclear)\n" +
        "- notes: string | null (any additional context if mentioned, like age, injury/condition, or ward. Keep it under 100 characters. Set to null if none)\n\n" +
        "Return ONLY the raw JSON array. Do not include markdown code block formatting (like ```json) or any other text.";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000); // 15s timeout for lists
    try {
        const parts = [{ text: prompt }];
        if (base64Data && mimeType) {
            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                },
            });
        }
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { responseMimeType: "application/json", temperature: 0 },
            }),
            signal: controller.signal,
        });
        if (!res.ok) {
            v2_1.logger.warn("gemini patient list non-200", { status: res.status });
            return null;
        }
        const data = (await res.json());
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            return null;
        let sanitized = text.trim();
        if (sanitized.startsWith("```")) {
            sanitized = sanitized.replace(/^```json\s*/, "").replace(/```$/, "").trim();
        }
        const parsed = JSON.parse(sanitized);
        if (!Array.isArray(parsed))
            return null;
        return parsed.map((item) => ({
            name: String(item.name || "").trim().slice(0, 150),
            dni: item.dni ? String(item.dni).replace(/\D/g, "").slice(0, 15) : null,
            notes: item.notes ? String(item.notes).trim().slice(0, 150) : null,
        }));
    }
    catch (e) {
        v2_1.logger.warn("gemini patient list analysis failed", { error: e instanceof Error ? e.message : String(e) });
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
function fuzzyNameMatch(nameA, nameB) {
    const normalize = (name) => {
        return name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^a-z0-9\s]/g, "") // remove special chars
            .split(/\s+/)
            .filter(w => w.length > 2 && !["del", "las", "los", "con", "y", "de"].includes(w));
    };
    const wordsA = normalize(nameA);
    const wordsB = normalize(nameB);
    if (wordsA.length === 0 || wordsB.length === 0)
        return false;
    let matches = 0;
    for (const wA of wordsA) {
        if (wordsB.includes(wA)) {
            matches++;
        }
    }
    const requiredMatches = Math.min(2, wordsA.length, wordsB.length);
    return matches >= requiredMatches;
}
