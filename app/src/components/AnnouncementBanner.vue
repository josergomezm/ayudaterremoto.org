<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MaterialIcon from './MaterialIcon.vue'
import { useAnnouncementsStore } from '../stores/announcements'

const { t } = useI18n()
const store = useAnnouncementsStore()

onMounted(() => { if (store.announcements.length === 0) store.fetchAll() })

// Most recent URGENT alert (crisis spec Section 5 — the "Megaphone").
const urgent = computed(() => store.announcements.find((a) => a.category === 'urgent'))

// Dismissal is remembered per-device and per-alert id: dismissing hides THIS
// alert, but a newly broadcast one (different id) shows again.
const DISMISS_KEY = 'ayudaterremoto.dismissedAlert'
const dismissedId = ref<string | null>(localStorage.getItem(DISMISS_KEY))
const visible = computed(() => !!urgent.value && urgent.value.id !== dismissedId.value)

function dismiss() {
  if (!urgent.value) return
  dismissedId.value = urgent.value.id
  try { localStorage.setItem(DISMISS_KEY, urgent.value.id) } catch { /* ignore */ }
}
</script>

<template>
  <div
    v-if="visible && urgent"
    class="flex items-center gap-2 bg-red-700 px-4 py-2 text-sm text-white"
    role="alert"
  >
    <MaterialIcon name="warning" :size="18" class="shrink-0" />
    <span class="flex-1 text-center">
      <strong class="uppercase">{{ t('announcements.' + urgent.category) }}:</strong> {{ urgent.message }}
    </span>
    <button class="shrink-0 opacity-80 hover:opacity-100" :aria-label="t('common.close')" @click="dismiss">
      <MaterialIcon name="close" :size="18" />
    </button>
  </div>
</template>
