<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnnouncementsStore, type AnnouncementCategory } from '../stores/announcements'
import { formatRelativeTime } from '../lib/date'

const { t, locale } = useI18n()
const store = useAnnouncementsStore()

onMounted(() => store.fetchAll())

const catStyle: Record<AnnouncementCategory, string> = {
  urgent: 'bg-red-100 text-red-800',
  logistics: 'bg-sky-100 text-sky-800',
  correction: 'bg-slate-100 text-slate-700',
}
// Broadcasting moved to the admin portal (Command only) — this is the public feed.
</script>

<template>
  <div class="mx-auto  space-y-5 p-4">
    <h1 class="text-xl font-bold text-slate-900">{{ t('announcements.title') }}</h1>

    <p v-if="store.announcements.length === 0" class="text-sm text-slate-500">{{ t('announcements.empty') }}</p>
    <ul v-else class="space-y-2">
      <li v-for="a in store.announcements" :key="a.id" class="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div class="flex items-center justify-between gap-2">
          <span class="inline-block rounded-full px-2 py-0.5 text-xs font-bold" :class="catStyle[a.category]">
            {{ t('announcements.' + a.category) }}
          </span>
          <span class="text-[11px] text-slate-400 font-medium shrink-0">
            {{ formatRelativeTime(a.createdAt, locale) }}
          </span>
        </div>
        <p class="mt-1.5 text-slate-800">{{ a.message }}</p>
      </li>
    </ul>
  </div>
</template>
