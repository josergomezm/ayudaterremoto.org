import { createI18n } from 'vue-i18n'

// Per-feature locale modules. Each exports { es, en } with `en: typeof es`, so
// key parity between locales is enforced at COMPILE time (a missing/extra key is
// a tsc error, not just a runtime warning). See docs/i18n.md.
import common from './locales/configs/common'
import roles from './locales/configs/roles'
import triage from './locales/configs/triage'
import category from './locales/configs/category'
import shell from './locales/components/shell'
import offline from './locales/components/offline'
import welcome from './locales/components/welcome'
import onboarding from './locales/components/onboarding'
import movements from './locales/components/movements'
import map from './locales/pages/map'
import detail from './locales/pages/detail'
import report from './locales/pages/report'
import verify from './locales/pages/verify'
import announcements from './locales/pages/announcements'
import about from './locales/pages/about'
import guides from './locales/pages/guides'
import missing from './locales/pages/missing'
import admin from './locales/pages/admin'
import hubs from './locales/pages/hubs'
import home from './locales/pages/home'
import notFound from './locales/pages/notFound'

// Spanish (primary, Venezuela) first; English is the fallback.
export const SUPPORTED_LOCALES = ['es', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

// Each module registers under its namespace key. Add a new namespace by adding
// one line to BOTH the `es` and `en` blocks below.
const messages = {
  es: {
    common: common.es,
    roles: roles.es,
    triage: triage.es,
    category: category.es,
    shell: shell.es,
    offline: offline.es,
    welcome: welcome.es,
    onboarding: onboarding.es,
    movements: movements.es,
    map: map.es,
    detail: detail.es,
    report: report.es,
    verify: verify.es,
    announcements: announcements.es,
    about: about.es,
    guides: guides.es,
    missing: missing.es,
    admin: admin.es,
    hubs: hubs.es,
    home: home.es,
    notFound: notFound.es,
  },
  en: {
    common: common.en,
    roles: roles.en,
    triage: triage.en,
    category: category.en,
    shell: shell.en,
    offline: offline.en,
    welcome: welcome.en,
    onboarding: onboarding.en,
    movements: movements.en,
    map: map.en,
    detail: detail.en,
    report: report.en,
    verify: verify.en,
    announcements: announcements.en,
    about: about.en,
    guides: guides.en,
    missing: missing.en,
    admin: admin.en,
    hubs: hubs.en,
    home: home.en,
    notFound: notFound.en,
  },
}

// Dates/numbers: render with d()/n() from useI18n() — never hand-format.
const datetimeFormats = {
  es: {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
  },
  en: {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
  },
} as const

const STORAGE_KEY = 'ayudaterremoto.locale'

function isSupported(x: string | null | undefined): x is Locale {
  return !!x && (SUPPORTED_LOCALES as readonly string[]).includes(x)
}

/** Best-effort device/browser language → a supported locale (es fallback). */
export function detectLocale(): Locale {
  const candidates = [navigator.language, ...(navigator.languages ?? [])]
  for (const c of candidates) {
    const base = c?.split('-')[0]
    if (isSupported(base)) return base
  }
  return 'es'
}

/** True if the user has explicitly chosen a locale (so we don't auto-override). */
export function hasStoredLocale(): boolean {
  try { return isSupported(localStorage.getItem(STORAGE_KEY)) } catch { return false }
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isSupported(saved)) return saved // honor an explicit choice over device language
  } catch { /* storage unavailable — fall through to detection */ }
  return detectLocale()
}

export const i18n = createI18n({
  legacy: false, // Composition API mode — useI18n(), not options $t
  locale: initialLocale(),
  fallbackLocale: 'es',
  messages,
  datetimeFormats,
})

/** Switch locale and remember the choice. Used by LocaleSwitcher. */
export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  try { localStorage.setItem(STORAGE_KEY, locale) } catch { /* ignore */ }
}

// Type augmentation: powers key autocompletion for t(). (Note: vue-i18n keeps a
// permissive t(key: string) overload, so a typo in a t() call is still only
// caught by the runtime missing-key warning, not by tsc.)
type MessageSchema = (typeof messages)['es']
declare module 'vue-i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
}
