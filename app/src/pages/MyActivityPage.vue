<script setup lang="ts">
// "Mi actividad" (WS5 · Fase A = versión base; se amplía en la Fase C).
// Lista las necesidades de las que te encargaste (mineClaim) o que confirmaste.
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHubsStore, type InventoryItem, type ResourceHub } from '../stores/hubs'
import { useSessionStore } from '../stores/session'
import NeedCard from '../components/NeedCard.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import Loader from '../components/Loader.vue'

const { t } = useI18n()
const hubs = useHubsStore()
const session = useSessionStore()

onMounted(() => {
  hubs.fetchAll()
})

watch(() => session.email, (newEmail) => {
  if (newEmail) {
    hubs.fetchAll()
  }
})

interface Need { item: InventoryItem; hub: ResourceHub }
const mine = computed<Need[]>(() =>
  hubs.activeHubs.flatMap((hub) => hub.inventory.map((item) => ({ item, hub })))
    .filter(({ item }) => item.mineClaim || item.mineConfirm),
)
</script>

<template>
  <div class="supply-theme act">
    <div class="wrap">
      <h1 class="title">{{ t('home.activityTitle') }}</h1>
      <p class="intro">{{ t('home.activityIntro') }}</p>

      <Loader v-if="hubs.loading && hubs.hubs.length === 0" :label="t('common.loading')" />

      <div v-else-if="mine.length" class="list">
        <NeedCard
          v-for="n in mine"
          :key="n.item.id"
          :item="n.item"
          :hub="n.hub"
          :mode="session.email === n.hub.createdBy ? 'coordinator' : 'civilian'"
        />
      </div>

      <div v-else class="empty">
        <div class="empty-ic"><MaterialIcon name="volunteer_activism" :size="40" /></div>
        <p>{{ t('home.activityEmpty') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.act { background: var(--screen); min-height: 100%; }
.wrap { margin: 0 auto; padding: 18px 16px 24px; }
.title { font-size: 22px; font-weight: 800; color: var(--ink); letter-spacing: -.01em; margin: 0; }
.intro { font-size: 13.5px; font-weight: 500; color: var(--ink2); margin: 4px 0 0; }
.list { display: flex; flex-direction: column; gap: 13px; margin-top: 16px; }
.empty { padding: 56px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; color: var(--ink2); }
.empty-ic { width: 84px; height: 84px; border-radius: 50%; background: #EFEBE3; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #A79F90; }
.empty p { font-size: 14px; font-weight: 500; max-width: 300px; line-height: 1.5; }
</style>
