import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authedFetch } from '../lib/authedFetch'

export interface LocationRequest {
  id: string
  buildingName: string
  address?: string
  lat?: number
  lng?: number
  note?: string
  status: 'pending' | 'investigating' | 'resolved'
  resolution?: {
    condition: 'safe' | 'damaged' | 'collapsed' | 'unknown'
    note: string
    answeredBy: { name: string; role: string }
    at: string
  }
  contactPhone?: string
  reporterName: string
  createdAt: string
  updatedAt: string
  mine?: boolean
}

export interface LocationRequestPayload {
  buildingName: string
  address?: string
  lat?: number
  lng?: number
  note?: string
  contactPhone?: string
}

export interface LocationResolvePayload {
  condition: 'safe' | 'damaged' | 'collapsed' | 'unknown'
  note: string
}

export const useBuildingsStore = defineStore('buildings', () => {
  const requests = ref<LocationRequest[]>([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    const r = await authedFetch<{ requests: LocationRequest[] }>('/location-requests')
    if (r.ok) requests.value = r.data.requests
    loading.value = false
  }

  async function createRequest(payload: LocationRequestPayload) {
    const r = await authedFetch<{ request: LocationRequest }>('/location-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (r.ok) requests.value = [r.data.request, ...requests.value]
    return r
  }

  async function resolveRequest(id: string, payload: LocationResolvePayload) {
    const r = await authedFetch(`/location-requests/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (r.ok) {
      const req = requests.value.find((x) => x.id === id)
      if (req) {
        req.status = 'resolved'
        // Just fetch all to get the updated resolution object with answeredBy details
        await fetchAll()
      }
    }
    return r
  }

  return { requests, loading, fetchAll, createRequest, resolveRequest }
})
