<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIncidentsStore } from '../stores/incidents'
import IncidentCard from '../components/IncidentCard.vue'
import BaseButton from '../components/BaseButton.vue'
import IncidentMap from '../components/IncidentMap.vue'
import Loader from '../components/Loader.vue'

const { t } = useI18n()
const store = useIncidentsStore()

onMounted(() => { if (store.incidents.length === 0) store.fetchAll() })
</script>

<template>
  <div class="mx-auto  space-y-5 p-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-slate-900">{{ t('map.title') }}</h1>
      <!-- TransitionGroup FLIP demo (Recipe 4): reorders the grid with a move animation -->
      <BaseButton variant="neutral" @click="store.shuffle()">{{ t('map.shuffle') }}</BaseButton>
    </div>

    <!-- Interactive map (Leaflet + OpenStreetMap). Markers are colored by triage
         status; tap one to open the incident. Offline vector tiles are the next
         step — see crisis spec gaps. -->
    <IncidentMap :incidents="store.active" />

    <p v-if="store.error" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ t('map.loadError') }}</p>
    <Loader v-else-if="store.loading" :label="t('common.loading')" class="py-4" />
    <p v-else-if="store.incidents.length === 0" class="text-sm text-slate-500">{{ t('map.empty') }}</p>

    <section v-if="store.active.length" class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('map.active') }}</h2>
      <TransitionGroup name="list" tag="div" class="grid grid-cols-2 gap-3">
        <IncidentCard v-for="i in store.active" :key="i.id" :incident="i" />
      </TransitionGroup>
    </section>

    <section v-if="store.cleared.length" class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('map.cleared') }}</h2>
      <div class="grid grid-cols-2 gap-3 opacity-70">
        <IncidentCard v-for="i in store.cleared" :key="i.id" :incident="i" />
      </div>
    </section>
  </div>
</template>
