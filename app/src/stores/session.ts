import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '../lib/api'
import { auth, googleProvider } from '../lib/firebase'
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, type User } from 'firebase/auth'

export type Role = 'civilian' | 'rescuer' | 'coordinator' | 'admin' | 'sudo'
const RANK: Record<Role, number> = { civilian: 0, rescuer: 1, coordinator: 2, admin: 3, sudo: 4 }

export const useSessionStore = defineStore('session', () => {
  const user = ref<User | null>(null)
  const role = ref<Role | null>(null)
  const name = ref<string | null>(null)
  const email = ref<string | null>(null)
  const brigade = ref<string | null>(null)
  const brigadeRole = ref<string | null>(null)
  const joinedHubId = ref<string | null>(null)
  const joinedHubName = ref<string | null>(null)
  const ready = ref(false)

  const isVerified = computed(() => user.value !== null)

  function can(min: Role): boolean {
    return role.value !== null && RANK[role.value] >= RANK[min]
  }

  async function fetchProfile(): Promise<{ role: Role; name: string; email: string; brigade?: string; brigadeRole?: string; joinedHubId?: string; joinedHubName?: string } | null> {
    const fbUser = auth.currentUser
    if (!fbUser) return null
    const token = await fbUser.getIdToken()
    const res = await apiFetch<{ role: Role; name: string; email: string; brigade?: string; brigadeRole?: string; joinedHubId?: string; joinedHubName?: string }>('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    if (res.ok) return res.data
    return null
  }

  onAuthStateChanged(auth, async (u) => {
    user.value = u
    if (u) {
      const profile = await fetchProfile()
      if (profile) {
        role.value = profile.role
        name.value = profile.name
        email.value = profile.email
        brigade.value = profile.brigade || null
        brigadeRole.value = profile.brigadeRole || null
        joinedHubId.value = profile.joinedHubId || null
        joinedHubName.value = profile.joinedHubName || null
      } else {
        // Fallback profile if server is not responding yet
        role.value = 'civilian'
        name.value = u.displayName || u.email || 'Google User'
        email.value = u.email
        brigade.value = null
        brigadeRole.value = null
        joinedHubId.value = null
        joinedHubName.value = null
      }
    } else {
      role.value = null
      name.value = null
      email.value = null
      brigade.value = null
      brigadeRole.value = null
      joinedHubId.value = null
      joinedHubName.value = null
    }
    ready.value = true
  })

  async function signIn() {
    await signInWithPopup(auth, googleProvider)
    const profile = await fetchProfile()
    if (profile) {
      role.value = profile.role
      name.value = profile.name
      email.value = profile.email
      brigade.value = profile.brigade || null
      brigadeRole.value = profile.brigadeRole || null
      joinedHubId.value = profile.joinedHubId || null
      joinedHubName.value = profile.joinedHubName || null
    }
  }

  async function signOut() {
    await fbSignOut(auth)
    role.value = null
    name.value = null
    email.value = null
    brigade.value = null
    brigadeRole.value = null
  }

  async function requestResponder(phone: string, note: string, requestedRole?: 'rescuer' | 'coordinator', requestedBrigade?: string, requestedBrigadeRole?: string, requestedHubId?: string | null, requestedHubName?: string | null): Promise<{ ok: boolean; error?: string }> {
    const fbUser = auth.currentUser
    if (!fbUser) return { ok: false, error: 'Inicie sesión primero' }
    const token = await fbUser.getIdToken()
    const res = await apiFetch<{ status: string }>('/verify/responder-request', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ phone, note, role: requestedRole, brigade: requestedBrigade, brigadeRole: requestedBrigadeRole, hubId: requestedHubId, hubName: requestedHubName }),
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: res.error }
  }

  async function requestHub(payload: {
    phone: string
    note: string
    hubName: string
    address: string
    lat: number
    lng: number
    contactName: string
    contactPhone: string
    whatsappGroup?: string
    hubType?: 'static' | 'mobile'
    offersShelter?: boolean
    shelterCapacity?: number
  }): Promise<{ ok: boolean; error?: string }> {
    const fbUser = auth.currentUser
    if (!fbUser) return { ok: false, error: 'Inicie sesión primero' }
    const token = await fbUser.getIdToken()
    const res = await apiFetch<{ status: string }>('/verify/hub-request', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload),
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: res.error }
  }

  async function checkHubRequest(): Promise<{ ok: boolean; status: string | null; error?: string }> {
    const fbUser = auth.currentUser
    if (!fbUser) return { ok: false, status: null, error: 'Inicie sesión primero' }
    const token = await fbUser.getIdToken()
    const res = await apiFetch<{ status: string | null }>('/verify/hub-request', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
    if (res.ok) return { ok: true, status: res.data.status }
    return { ok: false, status: null, error: res.error }
  }

  async function checkResponderRequest(): Promise<{ ok: boolean; status: string | null; error?: string }> {
    const fbUser = auth.currentUser
    if (!fbUser) return { ok: false, status: null, error: 'Inicie sesión primero' }
    const token = await fbUser.getIdToken()
    const res = await apiFetch<{ status: string | null }>('/verify/responder-request', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
    if (res.ok) return { ok: true, status: res.data.status }
    return { ok: false, status: null, error: res.error }
  }

  async function updateBrigadeInfo(newBrigade: string, newBrigadeRole: string): Promise<{ ok: boolean; error?: string }> {
    const fbUser = auth.currentUser
    if (!fbUser) return { ok: false, error: 'Inicie sesión primero' }
    const token = await fbUser.getIdToken()
    const res = await apiFetch<{ ok: boolean; brigade: string | null; brigadeRole: string | null }>('/profile/update-brigade', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ brigade: newBrigade, brigadeRole: newBrigadeRole }),
    })
    if (res.ok) {
      brigade.value = res.data.brigade
      brigadeRole.value = res.data.brigadeRole
      return { ok: true }
    }
    return { ok: false, error: res.error }
  }

  return {
    user, role, name, email, brigade, brigadeRole, joinedHubId, joinedHubName, ready, isVerified, can,
    signIn, signOut, requestResponder, checkResponderRequest, requestHub, checkHubRequest, updateBrigadeInfo
  }
})
