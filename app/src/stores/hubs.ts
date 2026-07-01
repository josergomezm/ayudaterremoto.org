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

  // ── Need lifecycle (WS3): abierta → tomada → confirmada ──────────────────
  function findItem(hubId: string, itemId: string) {
    return hubs.value.find((h) => h.id === hubId)?.inventory.find((i) => i.id === itemId)
  }

  async function claimNeed(hubId: string, itemId: string, claimedByName?: string, eta?: string) {
    const r = await authedFetch<{ status: NeedStatus }>(`/needs/${itemId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ eta }),
    })
    if (r.ok) {
      const it = findItem(hubId, itemId)
      if (it) {
        it.status = 'tomada'
        it.claimedByName = claimedByName ?? null
        it.eta = eta ?? null
        it.staleClaim = false
      }
    }
    return r
  }

  async function confirmNeed(hubId: string, itemId: string, proofUrl?: string) {
    const r = await authedFetch<{ status: NeedStatus }>(`/needs/${itemId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(proofUrl ? { proofUrl } : {}),
    })
    if (r.ok) {
      const it = findItem(hubId, itemId)
      if (it) { it.status = 'confirmada'; it.proofUrl = proofUrl ?? null; it.staleClaim = false }
    }
    return r
  }

  async function reopenNeed(hubId: string, itemId: string) {
    const r = await authedFetch<{ status: NeedStatus }>(`/needs/${itemId}/reopen`, { method: 'POST' })
    if (r.ok) {
      const it = findItem(hubId, itemId)
      if (it) { it.status = 'abierta'; it.claimedByName = null; it.proofUrl = null; it.staleClaim = false }
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
    claimNeed,
    confirmNeed,
    reopenNeed,
    addMovement,
    fetchMovements,
  }
})
