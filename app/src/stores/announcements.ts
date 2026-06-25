import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../lib/api'

export type AnnouncementCategory = 'urgent' | 'logistics' | 'correction'

export interface Announcement {
  id: string
  category: AnnouncementCategory
  message: string
  createdAt: string
}

export const useAnnouncementsStore = defineStore('announcements', () => {
  const announcements = ref<Announcement[]>([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    const res = await apiFetch<{ announcements: Announcement[] }>('/announcements')
    if (res.ok) announcements.value = res.data.announcements
    loading.value = false
  }

  async function broadcast(category: AnnouncementCategory, message: string) {
    const res = await apiFetch<{ announcement: Announcement }>('/announcements', {
      method: 'POST',
      body: JSON.stringify({ category, message }),
    })
    if (res.ok) announcements.value = [res.data.announcement, ...announcements.value]
    return res
  }

  return { announcements, loading, fetchAll, broadcast }
})
