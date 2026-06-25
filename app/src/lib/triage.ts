import type { Category } from '../stores/incidents'

// Category-specific triage. Each question's `dangerAnswer` (the answer that
// signals danger) maps to a severity `level` (1 = critical … 5 = minor). The
// final level is the worst (lowest) triggered. Labels resolve via i18n keys.
export interface TriageQuestion {
  id: string
  labelKey: string
  dangerAnswer: boolean
  level: number
}

export const TRIAGE_QUESTIONS: Record<Category, TriageQuestion[]> = {
  medical: [
    { id: 'conscious', labelKey: 'report.q.medical.conscious', dangerAnswer: false, level: 1 },
    { id: 'breathing', labelKey: 'report.q.medical.breathing', dangerAnswer: false, level: 1 },
    { id: 'bleeding', labelKey: 'report.q.medical.bleeding', dangerAnswer: true, level: 2 },
    { id: 'mobile', labelKey: 'report.q.medical.mobile', dangerAnswer: false, level: 3 },
  ],
  structural: [
    { id: 'trapped', labelKey: 'report.q.structural.trapped', dangerAnswer: true, level: 1 },
    { id: 'gasfire', labelKey: 'report.q.structural.gasfire', dangerAnswer: true, level: 1 },
    { id: 'collapse', labelKey: 'report.q.structural.collapse', dangerAnswer: true, level: 2 },
    { id: 'access', labelKey: 'report.q.structural.access', dangerAnswer: false, level: 3 },
  ],
  obstruction: [
    { id: 'trapping', labelKey: 'report.q.obstruction.trapping', dangerAnswer: true, level: 2 },
    { id: 'injuries', labelKey: 'report.q.obstruction.injuries', dangerAnswer: true, level: 2 },
    { id: 'blocking', labelKey: 'report.q.obstruction.blocking', dangerAnswer: true, level: 3 },
  ],
  resource: [
    { id: 'lifeThreatening', labelKey: 'report.q.resource.lifeThreatening', dangerAnswer: true, level: 2 },
    { id: 'vulnerable', labelKey: 'report.q.resource.vulnerable', dangerAnswer: true, level: 3 },
    { id: 'many', labelKey: 'report.q.resource.many', dangerAnswer: true, level: 3 },
  ],
}

export function computeLevel(category: Category, answers: Record<string, boolean>): number {
  let level = 4
  for (const q of TRIAGE_QUESTIONS[category]) {
    if (answers[q.id] === q.dangerAnswer) level = Math.min(level, q.level)
  }
  return level
}
