import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authedFetch } from '../lib/authedFetch'

export interface FoundBy { name?: string; phone?: string; note?: string; role: string; at: string }
export interface MissingPerson {
  id: string
  name: string
  dni?: string
  details?: string
  address?: string
  lastSeen?: string
  lat?: number
  lng?: number
  phone?: string
  contactName?: string
  contactPhone?: string
  status: 'missing' | 'found'
  foundBy?: FoundBy
  createdAt: string
  mine?: boolean // true if the current viewer is the reporter (set server-side)
}
export interface MissingPayload {
  name: string
  dni?: string
  details?: string
  address?: string
  lastSeen?: string
  lat?: number
  lng?: number
  phone?: string
  contactPhone?: string
  // contactName ("reported by") is set server-side from the verified identity.
}
export interface FoundPayload { byPhone?: string; note?: string }

export const useMissingStore = defineStore('missing', () => {
  const people = ref<MissingPerson[]>([])
  const loading = ref(false)

  // Public read, but send credentials if present so the backend can flag the
  // viewer's own reports (`mine`) — used to show the "mark found" control.
  async function fetchAll() {
    loading.value = true
    const r = await authedFetch<{ people: MissingPerson[] }>('/missing')
    if (r.ok) people.value = r.data.people
    loading.value = false
  }

  // Verified users (or admins) only — authedFetch attaches the right token.
  async function report(payload: MissingPayload) {
    const r = await authedFetch<{ person: MissingPerson }>('/missing', { method: 'POST', body: JSON.stringify(payload) })
    if (r.ok) people.value = [r.data.person, ...people.value]
    return r
  }

  async function markFound(id: string, finder: FoundPayload = {}) {
    const r = await authedFetch(`/missing/${id}/found`, { method: 'POST', body: JSON.stringify(finder) })
    if (r.ok) { const m = people.value.find((x) => x.id === id); if (m) m.status = 'found' }
    return r
  }

  return { people, loading, fetchAll, report, markFound }
})
