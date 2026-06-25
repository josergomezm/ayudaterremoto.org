"use strict";
// ── IdentityProvider seam ───────────────────────────────────────────────────
//
// There is NO official CNE API. Every option scrapes the CNE's public web form,
// which is frequently down. Production should layer sources behind this single
// interface so the rest of the app never knows which one answered:
//
//   self-hosted scrape  →  community API (CedulaVE)  →  cache  →  degraded mode
//
// The MVP ships a deterministic STUB so the verification flow runs fully offline.
// Swap `stubProvider` for a real implementation that returns the same shape.
//
// Reminder: the Cédula check is a SOFT GATE for dedup + accountability, not auth.
// Real trust comes from the vouch chain (see store.ts / api.ts).
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeProvider = exports.pnpProvider = exports.stubProvider = void 0;
exports.buildNameOptions = buildNameOptions;
// A handful of explicit demo records.
const SEED = {
    "V-12345678": { nac: "V", dni: "12345678", fullname: "Jose Perez Gomez", state: "Distrito Capital", municipality: "Libertador" },
    "V-87654321": { nac: "V", dni: "87654321", fullname: "Maria Gonzalez Diaz", state: "Miranda", municipality: "Chacao" },
    "V-11223344": { nac: "V", dni: "11223344", fullname: "Carlos Rodriguez Mora", state: "Vargas", municipality: "Vargas" },
};
// First/last name pools used to (a) synthesize a plausible name for any numeric
// Cédula in the demo, and (b) build decoy options for the name-match challenge.
const FIRST = ["Jose", "Maria", "Carlos", "Ana", "Luis", "Carmen", "Pedro", "Rosa", "Miguel", "Elena", "Jesus", "Gabriela", "Rafael", "Sofia", "Andres", "Valentina"];
const LAST = ["Perez", "Gonzalez", "Rodriguez", "Martinez", "Garcia", "Diaz", "Hernandez", "Lopez", "Sanchez", "Ramirez", "Torres", "Flores", "Rivas", "Mora", "Blanco", "Silva"];
function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function synthName(key) {
    const h = hash(key);
    // Unsigned shifts (>>>) — a signed >> can go negative and index out of range.
    const f = FIRST[h % FIRST.length];
    const l1 = LAST[(h >>> 4) % LAST.length];
    const l2 = LAST[(h >>> 8) % LAST.length];
    return `${f} ${l1} ${l2}`;
}
exports.stubProvider = {
    async lookup(nac, dni) {
        if (!/^\d{6,9}$/.test(dni))
            return null; // CNE 302/303: non-numeric / invalid
        const seeded = SEED[`${nac}-${dni}`];
        if (seeded)
            return seeded;
        // Demo convenience: any well-formed Cédula resolves to a synthesized record.
        return { nac, dni, fullname: synthName(`${nac}-${dni}`), state: "—", municipality: "—" };
    },
};
/**
 * Build the name-match challenge grid: the real name plus plausible decoys,
 * deterministically shuffled from `seed` so the same challenge is reproducible.
 * The CALLER must remember which option is correct (never sent to the client).
 */
function buildNameOptions(realName, seed, count = 20) {
    const options = new Set([realName]);
    let i = 0;
    while (options.size < count) {
        const h = hash(`${seed}:${i++}`);
        options.add(`${FIRST[h % FIRST.length]} ${LAST[(h >>> 4) % LAST.length]} ${LAST[(h >>> 8) % LAST.length]}`);
    }
    // Deterministic shuffle.
    const arr = [...options];
    for (let j = arr.length - 1; j > 0; j--) {
        const k = hash(`${seed}:swap:${j}`) % (j + 1);
        [arr[j], arr[k]] = [arr[k], arr[j]];
    }
    return arr;
}
function titleCase(str) {
    if (!str)
        return "";
    return str.toLowerCase().split(" ").map((word) => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(" ");
}
exports.pnpProvider = {
    async lookup(nac, dni) {
        if (!/^\d{6,9}$/.test(dni))
            return null;
        try {
            // 1. Fetch home page to get session cookie and solve simple math captcha
            const initRes = await fetch("https://www.sistemaspnp.com/cedula/", {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
                signal: AbortSignal.timeout(6000),
            });
            if (!initRes.ok)
                return null;
            const initHtml = await initRes.text();
            const cookieHeader = initRes.headers.get("set-cookie");
            // Parse CAPTCHA question: e.g. ¿Cuánto es X + Y?
            const captchaMatch = /CAPTCHA:\s*¿Cuánto es\s*(\d+)\s*\+\s*(\d+)\?/i.exec(initHtml);
            let answer = "8";
            if (captchaMatch) {
                answer = (parseInt(captchaMatch[1]) + parseInt(captchaMatch[2])).toString();
            }
            const headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            };
            if (cookieHeader) {
                headers["Cookie"] = cookieHeader.split(";")[0];
            }
            // 2. Submit query to result page
            const postRes = await fetch("https://www.sistemaspnp.com/cedula/resultado.php", {
                method: "POST",
                headers: headers,
                body: new URLSearchParams({
                    cedula: dni,
                    captcha: answer,
                    jeje: "",
                }),
                signal: AbortSignal.timeout(6000),
            });
            if (!postRes.ok)
                return null;
            const html = await postRes.text();
            if (html.includes("RECORD_NOT_FOUND") || html.includes("Error en la consulta")) {
                return null;
            }
            const nombresMatch = /<strong>Nombres:<\/strong>\s*([^<]+)/i.exec(html);
            const primerApellidoMatch = /<strong>Primer Apellido:<\/strong>\s*([^<]+)/i.exec(html);
            const segundoApellidoMatch = /<strong>Segundo Apellido:<\/strong>\s*([^<]+)/i.exec(html);
            const estadoMatch = /<strong>Estado:<\/strong>\s*([^<]+)/i.exec(html);
            const municipioMatch = /<strong>Municipio:<\/strong>\s*([^<]+)/i.exec(html);
            if (!nombresMatch || !primerApellidoMatch)
                return null;
            const names = [
                nombresMatch[1].trim(),
                primerApellidoMatch[1].trim(),
                segundoApellidoMatch ? segundoApellidoMatch[1].trim() : "",
            ].filter(Boolean).join(" ");
            const fullname = titleCase(names);
            const state = titleCase(estadoMatch ? estadoMatch[1].trim() : "—");
            const municipality = titleCase(municipioMatch ? municipioMatch[1].trim() : "—");
            return { nac, dni, fullname, state, municipality };
        }
        catch {
            return null;
        }
    },
};
exports.activeProvider = {
    async lookup(nac, dni) {
        const realRecord = await exports.pnpProvider.lookup(nac, dni);
        if (realRecord)
            return realRecord;
        // Fall back to stub/seeded data if the scraper fails or record is not found
        return exports.stubProvider.lookup(nac, dni);
    },
};
