<script setup lang="ts">
// Tarjeta de "necesidad" (WS5). Recrea el frame 4 del handoff de Claude Design:
// estados abierta / tomada / confirmada / reabierta, con acciones según el rol.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useHubsStore, type InventoryItem, type ResourceHub } from '../stores/hubs'
import { useSessionStore } from '../stores/session'
import { useToast } from '../lib/toast'
import MaterialIcon from './MaterialIcon.vue'

const props = defineProps<{
  item: InventoryItem
  hub: Pick<ResourceHub, 'id' | 'name' | 'contactPhone' | 'whatsappGroup' | 'hubType'>
  mode: 'civilian' | 'coordinator'
  offline?: boolean
}>()

const { t } = useI18n()
const router = useRouter()
const hubs = useHubsStore()
const session = useSessionStore()
const toast = useToast()

const state = computed<'abierta' | 'reabierta' | 'tomada' | 'confirmada'>(() => {
  const s = props.item.status || 'abierta'
  if (s === 'confirmada') return 'confirmada'
  if (s === 'tomada') return 'tomada'
  if ((props.item.reopenedCount ?? 0) > 0) return 'reabierta'
  return 'abierta'
})

const CATEGORY_ICON: Record<string, string> = {
  water: 'water_drop', food: 'lunch_dining', medical: 'medication',
  tools: 'handyman', shelter: 'cottage', clothing: 'checkroom',
  hygiene: 'wash', other: 'inventory_2',
}
const icon = computed(() => CATEGORY_ICON[props.item.category] || 'inventory_2')
const urgencyClass = computed(() => ({ available: 'green', low: 'amber', depleted: 'red' }[props.item.urgency] || 'green'))
const subtitle = computed(() => `${props.item.quantity} ${props.item.unit} · ${props.hub.name}`)
const claimer = computed(() => props.item.claimedByName || t('home.someone'))

function whatsapp() {
  const phone = (props.hub.contactPhone || '').replace(/\D/g, '')
  if (phone) window.open(`https://wa.me/${phone}`, '_blank')
}
async function claim() {
  if (props.offline) return
  const eta = window.prompt(t('home.promptEta'), '2 horas')
  if (eta === null) return // User cancelled
  const r = await hubs.claimNeed(props.hub.id, props.item.id, session.name ?? undefined, eta || undefined)
  if (r.ok) toast.success(t('home.needClaimed')); else toast.error(r.error || t('common.error'))
}
async function confirm() {
  const r = await hubs.confirmNeed(props.hub.id, props.item.id)
  if (r.ok) toast.success(t('home.needConfirmed')); else toast.error(r.error || t('common.error'))
}
async function reopen() {
  const r = await hubs.reopenNeed(props.hub.id, props.item.id)
  if (r.ok) toast.success(t('home.needReopened')); else toast.error(r.error || t('common.error'))
}
function edit() { router.push(`/hubs/${props.hub.id}/manage`) }
async function close() {
  if (!window.confirm(t('home.closeConfirm'))) return
  const r = await hubs.removeInventory(props.hub.id, props.item.id)
  if (r.ok) toast.success(t('home.needClosed'))
  else toast.error((r as { error?: string }).error || t('common.error'))
}
</script>

<template>
  <div class="nc" :class="{ 'nc--reopen': state === 'reabierta', 'nc--done': state === 'confirmada' }">
    <!-- Cabecera: icono · título/subtítulo · badge de urgencia -->
    <div class="nc-head">
      <div class="nc-id">
        <div class="nc-ic" :class="{ 'nc-ic--done': state === 'confirmada' }">
          <MaterialIcon :name="state === 'confirmada' ? 'check_circle' : icon" :size="24" fill />
        </div>
        <div class="nc-text">
          <div class="nc-name" :class="{ 'nc-name--done': state === 'confirmada' }">{{ item.name }}</div>
          <div class="nc-sub flex items-center gap-1.5 flex-wrap mt-0.5">
            <span>{{ subtitle }}</span>
            <span v-if="hub.hubType === 'mobile'" class="inline-flex items-center gap-0.5 text-[9px] text-red-700 font-extrabold uppercase bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">
              🚨 {{ t('hubs.filterHubTypeMobile') }}
            </span>
            <span v-else class="inline-flex items-center gap-0.5 text-[9px] text-indigo-700 font-extrabold uppercase bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-100">
              📦 {{ t('hubs.filterHubTypeStatic') }}
            </span>
          </div>
        </div>
      </div>
      <div v-if="state === 'confirmada'" class="nc-badge nc-badge--green">
        <MaterialIcon name="check" :size="14" fill /><span>{{ t('home.delivered') }}</span>
      </div>
      <div v-else class="nc-badge" :class="`nc-badge--${urgencyClass}`">
        <span class="nc-dot" :class="`nc-dot--${urgencyClass}`"></span>
        <span>{{ t('hubs.urgency.' + item.urgency) }}</span>
      </div>
    </div>

    <!-- Nota de estado -->
    <div v-if="state === 'tomada'" class="nc-note flex-col items-start gap-1.5">
      <div class="flex items-center gap-2">
        <MaterialIcon :name="mode === 'coordinator' ? 'local_shipping' : 'person'" :size="18" />
        <span>{{ mode === 'coordinator' ? t('home.inTransit') : t('home.someoneHandling') }} · <b>{{ claimer }}</b></span>
      </div>
      <div v-if="item.eta" class="text-xs text-[var(--amber-c)] bg-[var(--amber-bg)] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 mt-0.5">
        <MaterialIcon name="schedule" :size="14" />
        <span>ETA: {{ item.eta }}</span>
      </div>
    </div>
    <div v-else-if="state === 'confirmada'" class="nc-note nc-note--green">
      <MaterialIcon name="verified" :size="18" />
      <span>{{ t('home.confirmedBy', { name: item.confirmedByName || '—' }) }}</span>
    </div>
    <div v-else-if="state === 'reabierta'" class="nc-note nc-note--amber">
      <MaterialIcon name="refresh" :size="18" />
      <span>{{ t('home.reopenedBy', { name: item.reopenedByName || '—' }) }}</span>
    </div>
    <div v-else-if="item.staleClaim" class="nc-note nc-note--amber">
      <MaterialIcon name="schedule" :size="18" /><span>{{ t('hubs.needStale') }}</span>
    </div>

    <!-- Acciones -->
    <!-- Colaborador, abierta/reabierta -->
    <template v-if="mode === 'civilian'">
      <template v-if="state === 'abierta' || state === 'reabierta'">
        <div v-if="offline" class="nc-pending">
          <MaterialIcon name="schedule" :size="20" /> {{ t('home.offlinePending') }}
        </div>
        <button v-else class="nc-btn nc-btn--primary" @click="claim">
          <MaterialIcon name="front_hand" :size="21" /> {{ t('home.iHandleIt') }}
        </button>
      </template>
      <button v-else-if="state === 'tomada'" class="nc-btn nc-btn--wa" @click="whatsapp">
        <MaterialIcon name="chat" :size="20" /> {{ t('home.whatsappCoordinator') }}
      </button>
    </template>

    <!-- Coordinador dueño de la zona -->
    <template v-else>
      <div v-if="state === 'tomada'" class="nc-actions">
        <button class="nc-btn nc-btn--green" @click="confirm">
          <MaterialIcon name="check" :size="20" /> {{ t('hubs.needConfirm') }}
        </button>
        <button class="nc-icon-btn" :title="t('hubs.needReopen')" @click="reopen">
          <MaterialIcon name="refresh" :size="21" />
        </button>
      </div>
      <div v-else-if="state === 'confirmada'" class="nc-actions">
        <button class="nc-btn nc-btn--ghost" @click="reopen">
          <MaterialIcon name="refresh" :size="19" /> {{ t('hubs.needReopen') }}
        </button>
      </div>
      <div v-else class="nc-actions">
        <button class="nc-btn nc-btn--ghost" @click="edit">
          <MaterialIcon name="edit" :size="19" /> {{ t('home.edit') }}
        </button>
        <button class="nc-btn nc-btn--ghost" @click="close">
          <MaterialIcon name="check_circle" :size="19" /> {{ t('home.close') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nc {
  --primary: #2350C9; --primary-d: #1B3FA3; --line: #E7E2D9; --ink: #211F1B; --ink2: #6F685C;
  --red-c:#B42318;--red-bg:#FCEDEA;--red-dot:#E03A2B;--amber-c:#B54708;--amber-bg:#FCF1E1;--amber-dot:#F18C12;--green-c:#15794B;--green-bg:#E9F6EE;--green-dot:#16A866;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 15px;
}
.nc--reopen { border: 1.5px solid #EBD9B6; }
.nc--done { background: #FCFBF9; opacity: .92; }
.nc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.nc-id { display: flex; align-items: center; gap: 11px; min-width: 0; }
.nc-ic { width: 46px; height: 46px; border-radius: 13px; background: #F2EEE7; color: #544E44; display: flex; align-items: center; justify-content: center; flex: none; }
.nc-ic--done { background: var(--green-bg); color: var(--green-c); }
.nc-text { min-width: 0; }
.nc-name { font-size: 19px; font-weight: 800; color: var(--ink); letter-spacing: -.01em; }
.nc-name--done { text-decoration: line-through; text-decoration-color: #C9C2B5; }
.nc-sub { font-size: 13px; font-weight: 600; color: var(--ink2); margin-top: 1px; }
.nc-badge { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; flex: none; font-size: 12.5px; font-weight: 800; }
.nc-badge--red { background: var(--red-bg); color: var(--red-c); }
.nc-badge--amber { background: var(--amber-bg); color: var(--amber-c); }
.nc-badge--green { background: var(--green-bg); color: var(--green-c); }
.nc-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.nc-dot--red { background: var(--red-dot); } .nc-dot--amber { background: var(--amber-dot); } .nc-dot--green { background: var(--green-dot); }
.nc-note { display: flex; align-items: center; gap: 7px; margin-top: 12px; padding: 10px 12px; background: #F6F4EF; border-radius: 12px; font-size: 13px; font-weight: 700; color: var(--ink2); }
.nc-note b { color: var(--ink); font-weight: 800; }
.nc-note--green { background: #F4F8F5; color: var(--ink2); }
.nc-note--green :deep(.material-symbols-outlined) { color: var(--green-c); }
.nc-note--amber { background: var(--amber-bg); color: var(--amber-c); font-weight: 800; }
.nc-btn { margin-top: 13px; width: 100%; height: 52px; border: none; border-radius: 14px; font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
.nc-btn--primary { background: var(--primary); color: #fff; }
.nc-btn--primary:hover { background: var(--primary-d); }
.nc-btn--green { background: var(--green-c); color: #fff; flex: 1; }
.nc-btn--wa { background: #fff; border: 1.5px solid #CFE6D6; color: #157347; }
.nc-btn--wa:hover { background: #F2FBF5; }
.nc-btn--ghost { background: #fff; border: 1.5px solid var(--line); color: var(--ink); flex: 1; height: 50px; font-size: 15px; }
.nc-btn--ghost:hover { background: #F6F4EF; }
.nc-actions { display: flex; gap: 9px; margin-top: 13px; }
.nc-icon-btn { width: 52px; height: 52px; margin-top: 13px; border: 1.5px solid var(--line); border-radius: 14px; background: #fff; color: var(--ink2); display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
.nc-icon-btn:hover { background: #F6F4EF; }
.nc-pending { margin-top: 14px; width: 100%; height: 54px; border-radius: 14px; background: #FBF3E2; border: 1.5px dashed #E7C892; color: var(--amber-c); font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; }
</style>
