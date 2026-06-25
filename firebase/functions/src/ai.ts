// "The hidden net" (crisis spec §7). Uses the Gemini API to scan a report's
// free-text description and decide whether it understates the emergency
// (panic misclassification). The API key comes from Secret Manager via
// defineSecret in api.ts. This NEVER blocks a report: any failure/timeout
// returns null and the report proceeds with the user's declared triage.

import { logger } from "firebase-functions/v2";

export type AiSeverity = "critical" | "high" | "moderate" | "low";
export interface AiAssessment {
  escalate: boolean;
  severity: AiSeverity;
  reason: string;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const TIMEOUT_MS = 5000;

export async function assessReport(opts: {
  description: string;
  category: string;
  declaredLevel: number;
  apiKey: string;
}): Promise<AiAssessment | null> {
  const { description, category, declaredLevel, apiKey } = opts;
  if (!apiKey || !description) return null;

  const prompt =
    "Eres un clasificador de triaje para una app de respuesta ante terremotos en Venezuela. " +
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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) { logger.warn("gemini non-200", { status: res.status }); return null; }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as Partial<AiAssessment>;
    if (typeof parsed.escalate !== "boolean") return null;
    const severity: AiSeverity = ["critical", "high", "moderate", "low"].includes(parsed.severity as string)
      ? (parsed.severity as AiSeverity)
      : "moderate";
    return { escalate: parsed.escalate, severity, reason: String(parsed.reason ?? "").slice(0, 200) };
  } catch (e) {
    logger.warn("gemini assess failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function severityToLevel(s: AiSeverity): number {
  switch (s) {
    case "critical": return 1;
    case "high": return 2;
    case "moderate": return 3;
    default: return 4;
  }
}

/** Meters between two lat/lng points (haversine). For proximity clustering. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
