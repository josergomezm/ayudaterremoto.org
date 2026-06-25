// Safety manuals registry. Content lives in i18n (guides.<id>.*) so it's
// Spanish-first and fully offline (bundled with the app). Each guide resolves:
//   guides.<id>.title    (string)
//   guides.<id>.summary  (string)
//   guides.<id>.steps    (string[])  ← read with tm() in the page
//
// To add a guide: add an entry here + the keys to BOTH locale files.

export interface Guide {
  id: string
  icon: string // Material Symbols name
  // 'steps'      → ordered list at guides.<id>.steps
  // 'assessment' → color-coded decision aid (avoid / caution / ok), used for the
  //                building-damage self-check. See guides.<id>.{avoid,caution,ok}.
  format: 'steps' | 'assessment'
}

export const GUIDES: Guide[] = [
  { id: 'earthquake', icon: 'crisis_alert', format: 'steps' },
  { id: 'aftershock', icon: 'replay', format: 'steps' },
  { id: 'structural', icon: 'domain_disabled', format: 'assessment' },
  { id: 'gas', icon: 'local_fire_department', format: 'steps' },
  { id: 'firstaid', icon: 'medical_services', format: 'steps' },
]

export function findGuide(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id)
}
