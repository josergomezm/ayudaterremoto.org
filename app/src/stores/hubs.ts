import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authedFetch } from '../lib/authedFetch'

export type NeedStatus = 'abierta' | 'tomada' | 'confirmada'

export interface InventoryItem {
  id: string
  name: string
  category: 'water' | 'food' | 'tools' | 'medical' | 'shelter' | 'clothing' | 'hygiene' | 'other'
  quantity: number
  unit: string
  urgency: 'available' | 'low' | 'depleted'
  updatedAt: string
  // Need lifecycle (WS3)
  status?: NeedStatus
  claimedBy?: string | null
  claimedByName?: string | null
  claimedAt?: string | null
  confirmedBy?: string | null
  confirmedByName?: string | null
  confirmedAt?: string | null
  proofUrl?: string | null
  reopenedCount?: number
  reopenedByName?: string | null
  staleClaim?: boolean
  mineClaim?: boolean
  mineConfirm?: boolean
  eta?: string | null
}

export interface HubLog {
  id: string
  action: 'restock' | 'distribute' | 'adjust'
  itemName: string
  quantityDelta: number
  note?: string
  actorEmail: string
  timestamp: string
}

export interface HubCoordinator {
  email: string
  addedAt: string
  name?: string
  addedBy?: string
}

export interface ResourceHub {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  contactPhone: string
  contactName: string
  whatsappGroup?: string
  status: 'active' | 'closed'
  createdBy: string
  createdAt: string
  updatedAt: string
  inventory: InventoryItem[]
  needs?: HubNeed[]
  recentLogs: HubLog[]
  movements?: InventoryMovement[]
  coordinators?: HubCoordinator[]
  hubType?: 'static' | 'mobile'
  offersShelter?: boolean
  shelterCapacity?: number
}

export interface HubCreatePayload {
  name: string
  address: string
  lat: number
  lng: number
  contactPhone: string
  contactName: string
  whatsappGroup?: string
  hubType?: 'static' | 'mobile'
  offersShelter?: boolean
  shelterCapacity?: number
}

export interface HubUpdatePayload {
  name?: string
  address?: string
  contactPhone?: string
  contactName?: string
  whatsappGroup?: string
  status?: 'active' | 'closed'
  hubType?: 'static' | 'mobile'
  offersShelter?: boolean
  shelterCapacity?: number
}

export interface InventoryUpsertPayload {
  name: string
  category: InventoryItem['category']
  quantity: number
  unit: string
  urgency: InventoryItem['urgency']
}

export interface InventoryAdjustPayload {
  delta: number
  action: 'restock' | 'distribute' | 'adjust'
  note?: string
}

// Movimientos de inventario ("lotes"): entrada/salida con razón, multi-ítem.
export type MovementType = 'entrada' | 'salida'
export interface MovementLine {
  itemId: string
  itemName: string
  unit: string
  category: InventoryItem['category']
  quantity: number
  resultingQty?: number
}
export interface InventoryMovement {
  id: string
  type: MovementType
  reason: string
  note?: string
  lines: MovementLine[]
  actorEmail: string
  actorName: string
  createdAt: string
}
export interface MovementLinePayload {
  itemId?: string
  name?: string
  category?: InventoryItem['category']
  unit?: string
  quantity: number
}
export interface MovementPayload {
  type: MovementType
  reason: string
  note?: string
  lines: MovementLinePayload[]
}

// Necesidad manual (creada por el coordinador, desacoplada del inventario).
export type NeedUrgency = 'alta' | 'media' | 'baja'
export interface HubNeed {
  id: string
  hubId: string
  title: string
  description?: string
  category: InventoryItem['category']
  quantity?: number | null
  unit?: string | null
  urgency: NeedUrgency
  status?: NeedStatus
  claimedByName?: string | null
  claimedAt?: string | null
  confirmedByName?: string | null
  confirmedAt?: string | null
  proofUrl?: string | null
  reopenedCount?: number
  reopenedByName?: string | null
  eta?: string | null
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
  // Flags de vista que pone el backend en GET /hubs (nunca expone emails).
  staleClaim?: boolean
  mineClaim?: boolean
  mineConfirm?: boolean
}
export interface NeedCreatePayload {
  title: string
  description?: string
  category: InventoryItem['category']
  quantity?: number
  unit?: string
  urgency: NeedUrgency
}
export type NeedUpdatePayload = Partial<NeedCreatePayload>

export const useHubsStore = defineStore('hubs', () => {
  const hubs = ref<ResourceHub[]>([])
  const loading = ref(false)

  const activeHubs = computed(() => hubs.value.filter((h) => h.status === 'active'))

  function myHubs(email: string) {
    return hubs.value.filter((h) => h.createdBy === email)
  }

  async function fetchAll() {
    loading.value = true
    const r = await authedFetch<{ hubs: ResourceHub[] }>('/hubs')
    if (r.ok) hubs.value = r.data.hubs
    loading.value = false
  }

  async function createHub(payload: HubCreatePayload) {
    const r = await authedFetch<{ hub: ResourceHub }>('/hubs', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (r.ok) {
      const newHub: ResourceHub = {
        ...r.data.hub,
        inventory: [],
        recentLogs: [],
      }
      hubs.value = [newHub, ...hubs.value]
    }
    return r
  }

  async function updateHub(id: string, payload: HubUpdatePayload) {
    const r = await authedFetch<{ hub: ResourceHub }>(`/hubs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (r.ok) {
      const idx = hubs.value.findIndex((h) => h.id === id)
      if (idx !== -1) hubs.value[idx] = r.data.hub
    }
    return r
  }

  async function addInventory(hubId: string, payload: InventoryUpsertPayload) {
    const r = await authedFetch<{ item: InventoryItem }>(`/hubs/${hubId}/inventory`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (r.ok) {
      const hub = hubs.value.find((h) => h.id === hubId)
      if (hub) hub.inventory = [...hub.inventory, r.data.item]
    }
    return r
  }

  async function removeInventory(hubId: string, itemId: string) {
    const r = await authedFetch(`/hubs/${hubId}/inventory/${itemId}`, {
      method: 'DELETE',
    })
    if (r.ok) {
      const hub = hubs.value.find((h) => h.id === hubId)
      if (hub) hub.inventory = hub.inventory.filter((i) => i.id !== itemId)
    }
    return r
  }

  async function adjustInventory(hubId: string, itemId: string, payload: InventoryAdjustPayload) {
    const r = await authedFetch<{ item: InventoryItem; log: HubLog }>(
      `/hubs/${hubId}/inventory/${itemId}/adjust`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
    if (r.ok) {
      const hub = hubs.value.find((h) => h.id === hubId)
      if (hub) {
        const idx = hub.inventory.findIndex((i) => i.id === itemId)
        if (idx !== -1) hub.inventory[idx] = r.data.item
        hub.recentLogs = [r.data.log, ...hub.recentLogs]
      }
    }
    return r
  }

  async function fetchLogs(hubId: string) {
    const r = await authedFetch<{ logs: HubLog[] }>(`/hubs/${hubId}/logs`)
    if (r.ok) {
      const hub = hubs.value.find((h) => h.id === hubId)
      if (hub) hub.recentLogs = r.data.logs
    }
    return r
  }

  async function addCoordinator(hubId: string, email: string) {
    const r = await authedFetch<{ coordinator: HubCoordinator }>(
      `/hubs/${hubId}/coordinators`,
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    )
    return r
  }

  async function removeCoordinator(hubId: string, email: string) {
    const r = await authedFetch(
      `/hubs/${hubId}/coordinators/${encodeURIComponent(email)}`,
      {
        method: 'DELETE',
      },
    )
    return r
  }

  // ── Necesidades manuales: CRUD (coordinador) + lifecycle abierta→tomada→confirmada ──
  function findNeed(hubId: string, needId: string) {
    return hubs.value.find((h) => h.id === hubId)?.needs?.find((n) => n.id === needId)
  }

  async function createNeed(hubId: string, payload: NeedCreatePayload) {
    const r = await authedFetch<{ need: HubNeed }>(`/hubs/${hubId}/needs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (r.ok) {
      const hub = hubs.value.find((h) => h.id === hubId)
      if (hub) hub.needs = [...(hub.needs ?? []), r.data.need]
    }
    return r
  }

  async function updateNeed(hubId: string, needId: string, payload: NeedUpdatePayload) {
    const r = await authedFetch<{ need: HubNeed }>(`/hubs/${hubId}/needs/${needId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (r.ok) {
      const hub = hubs.value.find((h) => h.id === hubId)
      if (hub?.needs) {
        const i = hub.needs.findIndex((n) => n.id === needId)
        if (i !== -1) hub.needs[i] = r.data.need
      }
    }
    return r
  }

  async function deleteNeed(hubId: string, needId: string) {
    const r = await authedFetch(`/hubs/${hubId}/needs/${needId}`, { method: 'DELETE' })
    if (r.ok) {
      const hub = hubs.value.find((h) => h.id === hubId)
      if (hub?.needs) hub.needs = hub.needs.filter((n) => n.id !== needId)
    }
    return r
  }

  async function claimNeed(hubId: string, needId: string, claimedByName?: string, eta?: string) {
    const r = await authedFetch<{ status: NeedStatus }>(`/needs/${needId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ eta }),
    })
    if (r.ok) {
      const nd = findNeed(hubId, needId)
      if (nd) {
        nd.status = 'tomada'
        nd.claimedByName = claimedByName ?? null
        nd.eta = eta ?? null
        nd.staleClaim = false
      }
    }
    return r
  }

  async function confirmNeed(hubId: string, needId: string, proofUrl?: string) {
    const r = await authedFetch<{ status: NeedStatus }>(`/needs/${needId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(proofUrl ? { proofUrl } : {}),
    })
    if (r.ok) {
      const nd = findNeed(hubId, needId)
      if (nd) { nd.status = 'confirmada'; nd.proofUrl = proofUrl ?? null; nd.staleClaim = false }
    }
    return r
  }

  async function reopenNeed(hubId: string, needId: string) {
    const r = await authedFetch<{ status: NeedStatus }>(`/needs/${needId}/reopen`, { method: 'POST' })
    if (r.ok) {
      const nd = findNeed(hubId, needId)
      if (nd) { nd.status = 'abierta'; nd.claimedByName = null; nd.proofUrl = null; nd.staleClaim = false }
    }
    return r
  }

  // ── Movimientos de inventario (lotes) ────────────────────────────────────
  async function addMovement(hubId: string, payload: MovementPayload) {
    const r = await authedFetch<{ movement: InventoryMovement }>(`/hubs/${hubId}/movements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    // Un movimiento puede tocar varios ítems (y crear nuevos) → recargamos para
    // que el inventario refleje todo.
    if (r.ok) {
      await fetchAll()
      await fetchMovements(hubId)
    }
    return r
  }

  async function fetchMovements(hubId: string) {
    const r = await authedFetch<{ movements: InventoryMovement[] }>(`/hubs/${hubId}/movements`)
    if (r.ok) {
      const hub = hubs.value.find((h) => h.id === hubId)
      if (hub) hub.movements = r.data.movements
    }
    return r
  }

  return {
    hubs,
    loading,
    activeHubs,
    myHubs,
    fetchAll,
    createHub,
    updateHub,
    addInventory,
    removeInventory,
    adjustInventory,
    fetchLogs,
    addCoordinator,
    removeCoordinator,
    createNeed,
    updateNeed,
    deleteNeed,
    claimNeed,
    confirmNeed,
    reopenNeed,
    addMovement,
    fetchMovements,
  }
})
