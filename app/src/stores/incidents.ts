import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '../lib/api'
import { authedFetch } from '../lib/authedFetch'
import { enqueueReport, syncReports, queuedCount } from '../lib/offline'

export type Category = 'medical' | 'structural' | 'obstruction' | 'resource'
export type TriageStatus = 'green' | 'yellow' | 'red'

export interface Incident {
  id: string
  category: Category
  triageLevel: number
  status: TriageStatus
  lat: number
  lng: number
  description: string
  unit?: string
  isProxy: boolean
  subjectName?: string
  subjectDetails?: string
  lastSeen?: string
  contact?: string
  evacuated: boolean
  resolved: boolean
  resolutionConfirmed: boolean | null
  createdAt: string
  clusterId?: string
  aiFlagged?: boolean
  aiSeverity?: string
  aiReason?: string
  // Master Incident: how many reports are grouped here + each report's content.
  count?: number
  reports?: ReportSummary[]
  structuralDamage?: 'minor' | 'moderate' | 'severe' | 'collapse'
  resourceType?: 'water' | 'food' | 'medical' | 'shelter' | 'tools' | 'other'
  medicalCount?: '1' | '2-5' | '6-10' | '10+'
  obstructionType?: 'landslide' | 'debris' | 'trees' | 'vehicles' | 'other'
  // Incident Assignment & Status Flow
  assignedTo?: string | null
  assignedName?: string | null
  assignedBrigade?: string | null
  assignmentStatus?: 'unassigned' | 'assigned' | 'en_route' | 'on_site' | 'handling' | 'resolved' | 'evacuated'
  assignmentEta?: string | null
  assignmentNotes?: string | null
  // 72-Hour Control & Re-verification
  lastReverifiedAt?: string | null
  reverifiedBy?: string | null
  reverificationNotes?: string | null
  // Outcome / Closure Report
  outcomeSurvivors?: number
  outcomeDeceased?: number
  outcomeInjured?: number
  outcomeStructuralDamage?: 'none' | 'minor' | 'moderate' | 'severe' | 'collapse'
  outcomeDetails?: string
  outcomeSubmittedAt?: string
  outcomeSubmittedBy?: string
}

export interface ReportSummary {
  id: string
  category: Category
  description: string
  unit?: string | null
  createdAt: string
  isProxy: boolean
  aiFlagged: boolean
  aiReason: string | null
  reporter?: string | null // present only for responders+
}

export interface ReportPayload {
  type: 'personal' | 'proxy'
  category: Category
  triageLevel: number
  lat: number
  lng: number
  description: string
  unit?: string
  locationPrecise?: boolean
  subjectName?: string
  subjectDetails?: string
  lastSeen?: string
  contact?: string
  structuralDamage?: 'minor' | 'moderate' | 'severe' | 'collapse'
  resourceType?: 'water' | 'food' | 'medical' | 'shelter' | 'tools' | 'other'
  medicalCount?: '1' | '2-5' | '6-10' | '10+'
  obstructionType?: 'landslide' | 'debris' | 'trees' | 'vehicles' | 'other'
}

export const useIncidentsStore = defineStore('incidents', () => {
  const incidents = ref<Incident[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pending = ref(0)

  const active = computed(() => incidents.value.filter((i) => !i.evacuated))
  const cleared = computed(() => incidents.value.filter((i) => i.evacuated))

  async function fetchAll() {
    loading.value = true
    error.value = null
    const res = await apiFetch<{ incidents: Incident[] }>('/incidents')
    if (res.ok) incidents.value = res.data.incidents
    else error.value = res.error
    loading.value = false
  }

  async function refreshPending() {
    pending.value = await queuedCount().catch(() => 0)
  }

  /**
   * Submit a report. Offline-first: if there's no connectivity (or the request
   * fails), the report is queued in IndexedDB and synced later. Never throws,
   * never blocks on the network.
   */
  async function submitReport(payload: ReportPayload): Promise<{ queued: boolean }> {
    // Always TRY to send (navigator.onLine is unreliable). Queue only if the
    // request actually fails — that's the real signal we're offline.
    const res = await authedFetch<{ incident: Incident }>('/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      incidents.value = [res.data.incident, ...incidents.value]
      return { queued: false }
    }
    await enqueueReport(payload)
    await refreshPending()
    return { queued: true }
  }

  /** Flush the offline queue in order. Call on reconnect. */
  async function syncNow(): Promise<number> {
    const synced = await syncReports(async (payload) => {
      const res = await authedFetch<{ incident: Incident }>('/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      return res.ok
    })
    await refreshPending()
    if (synced > 0) await fetchAll()
    return synced
  }

  async function setStatus(id: string, status: TriageStatus) {
    const res = await authedFetch<{ incident: Incident }>(`/incidents/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    })
    if (res.ok) replace(res.data.incident)
    return res
  }

  async function evacuate(id: string) {
    const res = await authedFetch<{ incident: Incident }>(`/incidents/${id}/evacuate`, { method: 'POST' })
    if (res.ok) replace(res.data.incident)
    return res
  }

  async function resolve(id: string) {
    const res = await authedFetch<{ incident: Incident }>(`/incidents/${id}/resolve`, { method: 'POST' })
    if (res.ok) replace(res.data.incident)
    return res
  }

  async function confirmResolution(id: string, confirmed: boolean) {
    const res = await authedFetch<{ incident: Incident }>(`/incidents/${id}/resolution`, {
      method: 'POST',
      body: JSON.stringify({ confirmed }),
    })
    if (res.ok) replace(res.data.incident)
    return res
  }

  async function assignIncident(id: string) {
    const res = await authedFetch<{ incident: Incident }>(`/incidents/${id}/assign`, {
      method: 'POST',
    })
    if (res.ok) replace(res.data.incident)
    return res
  }

  async function updateAssignment(id: string, payload: { status: string; eta?: string; notes?: string }) {
    const res = await authedFetch<{ incident: Incident }>(`/incidents/${id}/update-assignment`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (res.ok) replace(res.data.incident)
    return res
  }

  async function resolveIncidentWithOutcome(id: string, outcomePayload: any) {
    const res = await authedFetch<{ incident: Incident }>(`/incidents/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(outcomePayload),
    })
    if (res.ok) replace(res.data.incident)
    return res
  }

  async function reverifyIncident(id: string, payload: { notes: string }) {
    const res = await authedFetch<{ incident: Incident }>(`/incidents/${id}/reverify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (res.ok) replace(res.data.incident)
    return res
  }

  function byId(id: string): Incident | undefined {
    return incidents.value.find((i) => i.id === id)
  }

  function replace(updated: Incident) {
    const idx = incidents.value.findIndex((i) => i.id === updated.id)
    // Merge so cluster fields (count, reports) survive a single-incident update.
    if (idx >= 0) incidents.value[idx] = { ...incidents.value[idx], ...updated }
  }

  function shuffle() {
    incidents.value = [...incidents.value].sort(() => Math.random() - 0.5)
  }

  return {
    incidents, loading, error, pending, active, cleared,
    fetchAll, refreshPending, submitReport, syncNow,
    setStatus, evacuate, resolve, confirmResolution,
    assignIncident, updateAssignment, resolveIncidentWithOutcome, reverifyIncident,
    byId, shuffle,
  }
})
