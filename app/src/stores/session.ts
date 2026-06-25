import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '../lib/api'
import { auth, googleProvider } from '../lib/firebase'
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, type User } from 'firebase/auth'

export type Role = 'civilian' | 'responder' | 'authority' | 'command'
const RANK: Record<Role, number> = { civilian: 0, responder: 1, authority: 2, command: 3 }

export const useSessionStore = defineStore('session', () => {
  const user = ref<User | null>(null)
  const role = ref<Role | null>(null)
  const name = ref<string | null>(null)
  const email = ref<string | null>(null)
  const ready = ref(false)

  const isVerified = computed(() => user.value !== null)

  function can(min: Role): boolean {
    return role.value !== null && RANK[role.value] >= RANK[min]
  }

  async function fetchProfile(): Promise<{ role: Role; name: string; email: string } | null> {
    const fbUser = auth.currentUser
    if (!fbUser) return null
    const token = await fbUser.getIdToken()
    const res = await apiFetch<{ role: Role; name: string; email: string }>('/auth/me', {
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
      } else {
        // Fallback profile if server is not responding yet
        role.value = 'civilian'
        name.value = u.displayName || u.email || 'Google User'
        email.value = u.email
      }
    } else {
      role.value = null
      name.value = null
      email.value = null
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
    }
  }

  async function signOut() {
    await fbSignOut(auth)
    role.value = null
    name.value = null
    email.value = null
  }

  async function redeemVouch(code: string): Promise<{ ok: boolean; error?: string }> {
    const fbUser = auth.currentUser
    if (!fbUser) return { ok: false, error: 'Inicie sesión primero' }
    const token = await fbUser.getIdToken()
    const res = await apiFetch<{ role: Role }>('/verify/redeem-vouch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ vouchCode: code }),
    })
    if (res.ok) {
      role.value = res.data.role
      return { ok: true }
    }
    return { ok: false, error: res.error }
  }

  return { user, role, name, email, ready, isVerified, can, signIn, signOut, redeemVouch }
})
