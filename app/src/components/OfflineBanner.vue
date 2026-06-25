<script setup lang="ts">
import { watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '../composables/useOnline'
import { useIncidentsStore } from '../stores/incidents'

const { t } = useI18n()
const { online } = useOnline()
const incidents = useIncidentsStore()

// Flush any queued reports on load too — not only on an offline→online
// transition (otherwise reports queued earlier never sync if we boot online).
onMounted(async () => {
  await incidents.refreshPending()
  if (incidents.pending > 0) await incidents.syncNow()
})

// And whenever connectivity returns, flush in order.
watch(online, async (isOnline) => {
  if (isOnline) await incidents.syncNow()
})
</script>

<template>
  <div
    v-if="!online"
    class="bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950"
    role="status"
  >
    {{ t('offline.banner') }}
  </div>
  <div
    v-else-if="incidents.pending > 0"
    class="bg-sky-100 px-4 py-2 text-center text-sm font-medium text-sky-900"
    role="status"
  >
    {{ t('offline.pending', { count: incidents.pending }) }}
  </div>
</template>
