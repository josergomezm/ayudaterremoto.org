<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, RouterLink } from 'vue-router'
import { useHubsStore } from '../stores/hubs'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import { useToast } from '../lib/toast'
import Loader from '../components/Loader.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import LocationPickerMap from '../components/LocationPickerMap.vue'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const hubsStore = useHubsStore()
const session = useSessionStore()
const admin = useAdminStore()

const name = ref('')
const address = ref('')
const contactName = ref('')
const contactPhone = ref('')
const whatsappGroup = ref('')
const lat = ref<number | null>(null)
const lng = ref<number | null>(null)
const hubType = ref<'static' | 'mobile'>('static')
const offersShelter = ref(false)
const shelterCapacity = ref<number | null>(null)
const submitting = ref(false)

const isAuthorized = computed(() => {
  if (!session.ready) return true // Keep true while checking to prevent layout flash
  return session.can('admin') || admin.isAdmin
})

function onLocationUpdated(loc: { lat: number; lng: number }) {
  lat.value = loc.lat
  lng.value = loc.lng
}

async function onSubmit() {
  if (!name.value.trim() || !address.value.trim() || !contactName.value.trim() || !contactPhone.value.trim()) {
    toast.error(t('common.error') || 'Por favor rellene todos los campos.')
    return
  }
  if (lat.value === null || lng.value === null) {
    toast.error(t('hubs.pickLocation'))
    return
  }

  submitting.value = true
  const res = await hubsStore.createHub({
    name: name.value.trim(),
    address: address.value.trim(),
    contactName: contactName.value.trim(),
    contactPhone: contactPhone.value.trim(),
    whatsappGroup: whatsappGroup.value.trim() || undefined,
    lat: lat.value,
    lng: lng.value,
    hubType: hubType.value,
    offersShelter: hubType.value === 'static' ? offersShelter.value : false,
    shelterCapacity: (hubType.value === 'static' && offersShelter.value) ? (Number(shelterCapacity.value) || 0) : 0
  })
  submitting.value = false

  if (res.ok) {
    toast.success(t('hubs.created'))
    router.push('/hubs')
  } else {
    toast.error(res.error || t('common.error'))
  }
}
</script>

<template>
  <div class="mx-auto space-y-5 p-4 max-w-4xl">
    <!-- Unloading state -->
    <div v-if="!session.ready" class="py-10">
      <Loader :label="t('common.loading')" />
    </div>

    <!-- Unauthorized Guard -->
    <div v-else-if="!isAuthorized" class="mx-auto max-w-md p-6 text-center space-y-4 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 mt-10">
      <div class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <MaterialIcon name="gpp_maybe" :size="28" />
      </div>
      <h2 class="text-lg font-bold text-slate-900">{{ t('admin.noAccess') || 'Acceso Denegado' }}</h2>
      <p class="text-sm text-slate-500">{{ t('admin.noAccessBody') || 'No tiene permisos para crear zonas.' }}</p>
      <RouterLink to="/hubs" class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 shadow-sm cursor-pointer">
        {{ t('hubs.backToHubs') }}
      </RouterLink>
    </div>

    <!-- Hub Creation Form -->
    <div v-else class="space-y-6">
      <header class="space-y-2">
        <RouterLink 
          to="/hubs" 
          class="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 transition"
        >
          <MaterialIcon name="arrow_back" :size="16" />
          <span>{{ t('hubs.backToHubs') }}</span>
        </RouterLink>
        <h1 class="text-xl font-bold text-slate-900">{{ t('hubs.createHub') }}</h1>
      </header>

      <form @submit.prevent="onSubmit" class="space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <!-- Hub Type Selector -->
        <div class="space-y-2">
          <label class="text-sm font-bold text-slate-700 block">{{ t('hubs.hubTypeLabel') }}</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <label 
              class="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition"
              :class="hubType === 'static' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'"
            >
              <input type="radio" v-model="hubType" value="static" class="mt-1 cursor-pointer" />
              <div>
                <span class="block text-sm font-bold text-slate-900">{{ t('hubs.hubTypeStatic') }}</span>
                <span class="block text-xs text-slate-500 mt-0.5">{{ t('hubs.hubTypeStaticDesc') }}</span>
              </div>
            </label>
            <label 
              class="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition"
              :class="hubType === 'mobile' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'"
            >
              <input type="radio" v-model="hubType" value="mobile" class="mt-1 cursor-pointer" />
              <div>
                <span class="block text-sm font-bold text-slate-900">{{ t('hubs.hubTypeMobile') }}</span>
                <span class="block text-xs text-slate-500 mt-0.5">{{ t('hubs.hubTypeMobileDesc') }}</span>
              </div>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Hub Name -->
          <div class="space-y-1.5">
            <label class="text-sm font-semibold text-slate-700">{{ t('hubs.hubName') }}</label>
            <input 
              v-model="name"
              type="text" 
              required
              :placeholder="t('hubs.hubNamePlaceholder')"
              class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>

          <!-- Contact Name -->
          <div class="space-y-1.5">
            <label class="text-sm font-semibold text-slate-700">{{ t('hubs.contactName') }}</label>
            <input 
              v-model="contactName"
              type="text" 
              required
              :placeholder="t('hubs.contactNamePlaceholder')"
              class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>

          <!-- Contact Phone -->
          <div class="space-y-1.5">
            <label class="text-sm font-semibold text-slate-700">{{ t('hubs.contactPhone') }}</label>
            <input 
              v-model="contactPhone"
              type="text" 
              required
              :placeholder="t('hubs.contactPhonePlaceholder')"
              class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>

          <!-- Address Text -->
          <div class="space-y-1.5">
            <label class="text-sm font-semibold text-slate-700">{{ t('hubs.address') }}</label>
            <input 
              v-model="address"
              type="text" 
              required
              :placeholder="t('hubs.addressPlaceholder')"
              class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>

          <!-- WhatsApp Group Link -->
          <div class="space-y-1.5">
            <label class="text-sm font-semibold text-slate-700">{{ t('hubs.whatsappGroup') }}</label>
            <input 
              v-model="whatsappGroup"
              type="url" 
              :placeholder="t('hubs.whatsappGroupPlaceholder')"
              class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
        </div>

        <!-- Shelter section (only for static hubs) -->
        <div v-if="hubType === 'static'" class="space-y-4 pt-3 border-t border-slate-100">
          <div class="flex items-center gap-2">
            <input 
              v-model="offersShelter"
              type="checkbox" 
              id="offers-shelter" 
              class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
            />
            <label for="offers-shelter" class="text-sm font-semibold text-slate-700 cursor-pointer">
              Ofrece refugio / lugar para dormir
            </label>
          </div>

          <div v-if="offersShelter" class="space-y-1.5 pl-6 max-w-xs animate-fade-in">
            <label class="text-sm font-semibold text-slate-700">Plazas / Camas disponibles</label>
            <input 
              v-model.number="shelterCapacity"
              type="number" 
              min="0"
              required
              placeholder="ej. 15"
              class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
        </div>

        <!-- Location Picker -->
        <div class="space-y-2">
          <label class="text-sm font-semibold text-slate-700 block">{{ t('hubs.pickLocation') }}</label>
          <LocationPickerMap 
            :lat="lat" 
            :lng="lng" 
            @update:location="onLocationUpdated" 
          />
          <p v-if="lat && lng" class="text-xs text-slate-500">
            Coordinates: {{ lat.toFixed(5) }}, {{ lng.toFixed(5) }}
          </p>
        </div>

        <!-- Submit Button -->
        <div class="flex justify-end pt-4 border-t border-slate-100">
          <button 
            type="submit" 
            :disabled="submitting"
            class="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <Loader v-if="submitting" :size="16" class="mr-1" />
            <MaterialIcon v-else name="save" :size="18" />
            {{ submitting ? t('hubs.creating') : t('hubs.create') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
