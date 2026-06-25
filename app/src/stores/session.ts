import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch, setAuthToken } from '../lib/api'

export type Role = 'civilian' | 'responder' | 'authority' | 'command'
const RANK: Record<Role, number> = { civilian: 0, responder: 1, authority: 2, command: 3 }

interface LookupResult { ok: boolean; challengeId?: string; options?: string[]; error?: string; notRegistered?: boolean; hint?: string }
interface ConfirmResult { ok: boolean; role?: Role; name?: string; error?: string; cooldownMs?: number }

// NOTE: identity is a SOFT GATE for accountability, not authentication. Real
// trust comes from the vouch chain enforced server-side. See CLAUDE.md.
export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(null)
  const role = ref<Role | null>(null)
  const name = ref<string | null>(null)

  const isVerified = computed(() => token.value !== null)
  function can(min: Role): boolean {
    return role.value !== null && RANK[role.value] >= RANK[min]
  }

  async function lookup(nac: 'V' | 'E', dni: string): Promise<LookupResult> {
    const res = await apiFetch<{ challengeId: string; options: string[]; hint?: string }>('/verify/lookup', {
      method: 'POST',
      body: JSON.stringify({ nac, dni }),
    })
    if (res.ok) return { ok: true, challengeId: res.data.challengeId, options: res.data.options, hint: res.data.hint }
    return { ok: false, error: res.error, notRegistered: res.status === 404 }
  }

  async function confirm(challengeId: string, selectedName: string, vouchCode?: string): Promise<ConfirmResult> {
    const res = await apiFetch<{ token: string; role: Role; name: string }>('/verify/confirm', {
      method: 'POST',
      body: JSON.stringify({ challengeId, selectedName, vouchCode: vouchCode || undefined }),
    })
    if (res.ok) {
      token.value = res.data.token
      role.value = res.data.role
      name.value = res.data.name
      setAuthToken(res.data.token)
      return { ok: true, role: res.data.role, name: res.data.name }
    }
    return { ok: false, error: res.error }
  }

  function logout() {
    token.value = null
    role.value = null
    name.value = null
    setAuthToken(null)
  }

  return { token, role, name, isVerified, can, lookup, confirm, logout }
})
