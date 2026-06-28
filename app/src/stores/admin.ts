import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, type User } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import { adminFetch } from '../lib/adminApi'
import type { Role } from './session'

export interface AuditEntry { voucher: string; voucheeDni: string; timestamp: string }
export interface AdminUser { email: string; role: 'organizador' | 'fundador' }
export interface AccessRequest { email: string; name: string; phone: string; note?: string; requestedAt: string }
export interface ResponderRequest { email: string; name: string; phone: string; note?: string; requestedAt: string; requestedRole?: 'rescatista' | 'coordinador' }
export interface Responder { email: string; name?: string; role: string; updatedAt?: string }
export interface AuditLogEntry {
  action: string
  actorId: string
  actorRole: string
  actorKind: string
  targetType: string | null
  targetId: string | null
  details: Record<string, unknown> | null
  timestamp: string
}
export type AnnouncementCategory = 'urgent' | 'logistics' | 'correction'
export interface Announcement { id: string; category: AnnouncementCategory; message: string; createdAt: string }

// Admin tier (Authority/Command) — Google Sign-In via Firebase Auth. The role is
// resolved server-side from the adminUsers collection (GET /admin/me).
export const useAdminStore = defineStore('admin', () => {
  const user = ref<User | null>(null)
  const role = ref<Role | null>(null)
  const ready = ref(false)

  const isAdmin = computed(() => role.value === 'organizador' || role.value === 'fundador')
  // Tras la fusión Authority+Command → Organizador, "command" equivale a Organizador+.
  const isCommand = computed(() => role.value === 'organizador' || role.value === 'fundador')
  const isSudo = computed(() => role.value === 'fundador')

  onAuthStateChanged(auth, async (u) => {
    user.value = u
    role.value = u ? await fetchRole() : null
    ready.value = true
  })

  async function fetchRole(): Promise<Role | null> {
    const r = await adminFetch<{ role: Role }>('/auth/me')
    return r.ok ? r.data.role : null
  }

  async function signIn() {
    await signInWithPopup(auth, googleProvider)
    role.value = await fetchRole()
  }
  async function signOut() {
    await fbSignOut(auth)
    role.value = null
  }

  const generateCode = () => adminFetch<{ code: string }>('/vouch/generate', { method: 'POST' })
  const fetchAudit = () => adminFetch<{ entries: AuditEntry[] }>('/vouch/audit')
  const fetchActivity = () => adminFetch<{ entries: AuditLogEntry[] }>('/admin/audit')
  const listAdmins = () => adminFetch<{ users: AdminUser[] }>('/admin/users')
  const setAdmin = (email: string, r: AdminUser['role']) =>
    adminFetch('/admin/users', { method: 'POST', body: JSON.stringify({ email, role: r }) })
  const removeAdmin = (email: string) =>
    adminFetch('/admin/users/remove', { method: 'POST', body: JSON.stringify({ email }) })
  const broadcast = (category: AnnouncementCategory, message: string) =>
    adminFetch('/announcements', { method: 'POST', body: JSON.stringify({ category, message }) })
  const listAnnouncements = () => adminFetch<{ announcements: Announcement[] }>('/announcements')
  const deleteAnnouncement = (id: string) => adminFetch(`/announcements/${id}`, { method: 'DELETE' })

  // Self-service access request (signed-in non-admins)
  const requestAccess = (phone: string, note: string) =>
    adminFetch('/access-request', { method: 'POST', body: JSON.stringify({ phone, note }) })
  const myRequest = () => adminFetch<{ status: string | null }>('/access-request')
  // Command: review requests
  const listRequests = () => adminFetch<{ requests: AccessRequest[] }>('/admin/requests')
  const approveRequest = (email: string, r: AdminUser['role']) =>
    adminFetch('/admin/requests/approve', { method: 'POST', body: JSON.stringify({ email, role: r }) })
  const denyRequest = (email: string) =>
    adminFetch('/admin/requests/deny', { method: 'POST', body: JSON.stringify({ email }) })

  // Responder/Brigadist Requests (Authority+)
  const listResponderRequests = () => adminFetch<{ requests: ResponderRequest[] }>('/admin/responder-requests')
  const approveResponderRequest = (email: string) =>
    adminFetch('/admin/responder-requests/approve', { method: 'POST', body: JSON.stringify({ email }) })
  const denyResponderRequest = (email: string) =>
    adminFetch('/admin/responder-requests/deny', { method: 'POST', body: JSON.stringify({ email }) })
  
  // Responders Roster (Authority+)
  const listResponders = () => adminFetch<{ responders: Responder[] }>('/admin/responders')
  const removeResponder = (email: string) =>
    adminFetch('/admin/responders/remove', { method: 'POST', body: JSON.stringify({ email }) })

  return {
    user, role, ready, isAdmin, isCommand, isSudo,
    signIn, signOut, generateCode, fetchAudit, fetchActivity, listAdmins, setAdmin, removeAdmin, broadcast,
    listAnnouncements, deleteAnnouncement,
    requestAccess, myRequest, listRequests, approveRequest, denyRequest,
    listResponderRequests, approveResponderRequest, denyResponderRequest, listResponders, removeResponder,
  }
})
