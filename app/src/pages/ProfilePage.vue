<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '../stores/session'
import { useHubsStore } from '../stores/hubs'
import BaseButton from '../components/BaseButton.vue'
import MaterialIcon from '../components/MaterialIcon.vue'

const { t, tm, rt } = useI18n()
const session = useSessionStore()

const message = ref<string | null>(null)
const messageType = ref<'success' | 'error' | null>(null)
const busy = ref(false)

const requestNote = ref('')
const requestPhone = ref('')
const requestRole = ref<'rescuer' | 'coordinator'>('rescuer')
const requestStatus = ref<string | null>(null)
const hubsStore = useHubsStore()
const selectedHubId = ref('')

// Hub selection is required for field roles (rescuer/coordinator), not for admin+
const hubRequired = computed(() => requestRole.value === 'rescuer' || requestRole.value === 'coordinator')
const canSubmitRequest = computed(() =>
  requestPhone.value.trim().length >= 5 &&
  (!hubRequired.value || selectedHubId.value !== '')
)

async function loadRequestStatus() {
  if (session.role === 'civilian') {
    busy.value = true
    try {
      const res = await session.checkResponderRequest()
      if (res.ok) {
        requestStatus.value = res.status
      }
    } catch (err) {
      console.error(err)
    } finally {
      busy.value = false
    }
  }
}

watch(() => [session.role, session.isVerified], () => {
  if (session.isVerified) {
    loadRequestStatus()
  } else {
    requestStatus.value = null
  }
}, { immediate: true })

onMounted(async () => {
  if (session.isVerified) {
    loadRequestStatus()
  }
  await hubsStore.fetchAll()
})

async function doSignIn() {
  busy.value = true
  message.value = null
  messageType.value = null
  try {
    await session.signIn()
  } catch (err) {
    message.value = err instanceof Error ? err.message : String(err)
    messageType.value = 'error'
  } finally {
    busy.value = false
  }
}

async function doSignOut() {
  busy.value = true
  message.value = null
  messageType.value = null
  try {
    await session.signOut()
    requestStatus.value = null
  } catch (err) {
    message.value = err instanceof Error ? err.message : String(err)
    messageType.value = 'error'
  } finally {
    busy.value = false
  }
}

async function doSubmitRequest() {
  if (!canSubmitRequest.value) return
  busy.value = true
  message.value = null
  messageType.value = null
  const targetHub = hubsStore.hubs.find(h => h.id === selectedHubId.value)
  const targetHubName = targetHub ? targetHub.name : null
  const res = await session.requestResponder(requestPhone.value, requestNote.value, requestRole.value, '', '', selectedHubId.value || null, targetHubName)
  busy.value = false
  if (res.ok) {
    message.value = t('verify.requestSuccess')
    messageType.value = 'success'
    requestStatus.value = 'pending'
    requestNote.value = ''
    requestPhone.value = ''
    selectedHubId.value = ''
  } else {
    message.value = res.error || t('verify.failed')
    messageType.value = 'error'
  }
}

function getRoleLabel(role: string) {
  if (role === 'civilian') return t('verify.roleColaborador')
  if (role === 'rescuer') return t('verify.roleRescatista')
  if (role === 'coordinator') return t('verify.roleCoordinador')
  if (role === 'admin') return t('verify.roleOrganizador')
  if (role === 'sudo') return t('verify.roleFundador')
  return role
}
</script>

<template>
  <div class="supply-theme profile-page">
    <div class="wrap">
      <!-- Header -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-extrabold text-[var(--ink)] tracking-tight">
          {{ session.isVerified ? t('verify.title') : t('verify.loginTitle') }}
        </h1>
        <p class="text-sm text-[var(--ink2)] mt-1.5 leading-relaxed">
          {{ session.isVerified ? t('verify.intro') : t('verify.loginIntro') }}
        </p>
      </div>

      <!-- Feedback Messages -->
      <div
        v-if="message"
        class="rounded-xl p-4 text-sm font-semibold border mb-5 animate-fadeIn"
        :class="messageType === 'success' ? 'bg-[var(--green-bg)] text-[var(--green-c)] border-[var(--green-bg)]' : 'bg-[var(--red-bg)] text-[var(--red-c)] border-[var(--red-bg)]'"
      >
        <div class="flex items-center gap-2">
          <MaterialIcon :name="messageType === 'success' ? 'check_circle' : 'error'" :size="18" />
          <span>{{ message }}</span>
        </div>
      </div>

      <!-- GUEST / LOGGED OUT VIEW -->
      <div v-if="!session.isVerified" class="card text-center space-y-5">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--amber-bg)] text-[var(--amber-c)]">
          <MaterialIcon name="lock" :size="28" />
        </div>
        <p class="text-xs text-[var(--ink2)] leading-relaxed">
          Para garantizar la confiabilidad de los reportes y evitar el spam de incidentes duplicados o falsos.
        </p>
        <BaseButton block :disabled="busy" @click="doSignIn" class="google-btn">
          <span class="inline-flex items-center justify-center gap-2 w-full font-bold">
            <svg class="h-4.5 w-4.5 shrink-0 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            {{ t('verify.signInButton') }}
          </span>
        </BaseButton>
      </div>

      <!-- LOGGED IN VIEW -->
      <div v-else class="space-y-6">
        <!-- User Profile Card -->
        <div class="card space-y-4">
          <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--amber-bg)] text-[var(--amber-c)] font-extrabold text-xl">
              {{ session.name ? session.name.charAt(0).toUpperCase() : 'U' }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('verify.signedInAs') }}</p>
              <p class="font-bold text-[var(--ink)] truncate">{{ session.name }}</p>
              <p class="text-xs text-[var(--ink2)] truncate">{{ session.email }}</p>
            </div>
          </div>

          <div class="border-t border-[var(--line)] pt-3 flex justify-between items-center text-sm">
            <span class="font-bold text-[var(--ink2)]">{{ t('verify.activeRole') }}</span>
            <span class="rounded-full bg-[var(--primary)] text-white px-3.5 py-1 text-xs font-extrabold tracking-wide uppercase">
              {{ getRoleLabel(session.role ?? 'civilian') }}
            </span>
          </div>
        </div>

        <!-- Current Role Capabilities -->
        <div class="card bg-white border border-[var(--line)] space-y-3">
          <div class="flex items-center gap-2">
            <MaterialIcon name="verified_user" :size="20" class="text-[var(--primary)]" />
            <h2 class="text-sm font-extrabold text-[var(--ink)]">{{ t('verify.capabilitiesTitle') }}</h2>
          </div>
          <p class="text-xs text-[var(--ink2)] leading-relaxed mb-1">
            {{ t('verify.capabilitiesIntro') }}
          </p>
          <ul class="space-y-2">
            <!-- Colaborador list -->
            <template v-if="session.role === 'civilian'">
              <li v-for="(b, i) in (tm('verify.civilianBenefits') as string[])" :key="i" class="flex items-start gap-2 text-xs text-[var(--ink2)] leading-relaxed">
                <MaterialIcon name="check" :size="16" class="text-[var(--green-dot)] shrink-0 mt-0.5" />
                <span>{{ rt(b) }}</span>
              </li>
            </template>
            <!-- Rescatista list -->
            <template v-else-if="session.role === 'rescuer'">
              <li class="flex items-start gap-2 text-xs text-[var(--ink)] font-semibold leading-relaxed">
                <MaterialIcon name="check_circle" :size="16" class="text-[var(--primary)] shrink-0 mt-0.5" />
                <span>Actualizar estados y nivel de triaje de reportes de emergencias</span>
              </li>
              <li class="flex items-start gap-2 text-xs text-[var(--ink)] font-semibold leading-relaxed">
                <MaterialIcon name="check_circle" :size="16" class="text-[var(--primary)] shrink-0 mt-0.5" />
                <span>Evaluar daños en edificaciones y registrar personas encontradas</span>
              </li>
              <li class="flex items-start gap-2 text-xs text-[var(--ink2)] leading-relaxed">
                <MaterialIcon name="check" :size="16" class="text-[var(--green-dot)] shrink-0 mt-0.5" />
                <span>Reportar emergencias e incidentes, y buscar en registros</span>
              </li>
            </template>
            <!-- Coordinador list -->
            <template v-else-if="session.role === 'coordinator'">
              <li class="flex items-start gap-2 text-xs text-[var(--ink)] font-semibold leading-relaxed">
                <MaterialIcon name="check_circle" :size="16" class="text-[var(--primary)] shrink-0 mt-0.5" />
                <span>Gestión de zona: crear necesidades y confirmar suministros</span>
              </li>
              <li class="flex items-start gap-2 text-xs text-[var(--ink)] font-semibold leading-relaxed">
                <MaterialIcon name="check_circle" :size="16" class="text-[var(--primary)] shrink-0 mt-0.5" />
                <span>Resolver consultas de personas desaparecidas o edificaciones</span>
              </li>
              <li class="flex items-start gap-2 text-xs text-[var(--ink2)] leading-relaxed">
                <MaterialIcon name="check" :size="16" class="text-[var(--green-dot)] shrink-0 mt-0.5" />
                <span>Reportar emergencias y buscar personas</span>
              </li>
            </template>
            <!-- Organizador list -->
            <template v-else-if="session.role === 'admin'">
              <li class="flex items-start gap-2 text-xs text-[var(--ink)] font-semibold leading-relaxed">
                <MaterialIcon name="check_circle" :size="16" class="text-[var(--primary)] shrink-0 mt-0.5" />
                <span>Crear y administrar puntos de suministros (hubs)</span>
              </li>
              <li class="flex items-start gap-2 text-xs text-[var(--ink)] font-semibold leading-relaxed">
                <MaterialIcon name="check_circle" :size="16" class="text-[var(--primary)] shrink-0 mt-0.5" />
                <span>Aprobar/denegar accesos y coordinar el personal</span>
              </li>
              <li class="flex items-start gap-2 text-xs text-[var(--ink2)] leading-relaxed">
                <MaterialIcon name="check" :size="16" class="text-[var(--green-dot)] shrink-0 mt-0.5" />
                <span>Gestión total de inventario y resolución de reportes</span>
              </li>
            </template>
            <!-- Fundador list -->
            <template v-else-if="session.role === 'sudo'">
              <li class="flex items-start gap-2 text-xs text-[var(--ink)] font-semibold leading-relaxed">
                <MaterialIcon name="security" :size="16" class="text-[var(--red-dot)] shrink-0 mt-0.5" />
                <span>Acceso completo de administrador global</span>
              </li>
              <li class="flex items-start gap-2 text-xs text-[var(--ink)] font-semibold leading-relaxed">
                <MaterialIcon name="security" :size="16" class="text-[var(--red-dot)] shrink-0 mt-0.5" />
                <span>Auditoría de vouching y control de organizadores</span>
              </li>
            </template>
          </ul>
        </div>

        <!-- Assigned Hub / Brigade (read-only for active rescuers/coordinators) -->
        <div v-if="session.can('rescuer') && session.joinedHubName" class="card bg-[#F4F2EE] border border-[var(--line)] space-y-2">
          <div class="flex items-center gap-2">
            <MaterialIcon name="emergency" :size="18" class="text-[var(--primary)]" />
            <h2 class="font-extrabold text-[var(--ink)] text-sm">Unidad Asignada</h2>
          </div>
          <p class="text-xs text-[var(--ink2)] leading-relaxed">
            Tu afiliación es gestionada por los coordinadores. Contacta a un administrador si necesitas cambiar de unidad.
          </p>
          <div class="flex items-center gap-3 bg-white border border-[var(--line)] rounded-xl px-4 py-3">
            <MaterialIcon name="home_health" :size="20" class="text-[var(--primary)] shrink-0" />
            <span class="font-bold text-[var(--ink)] text-sm">{{ session.joinedHubName }}</span>
          </div>
        </div>

        <!-- Volunteer/Coordinator Request Flow -->
        <div v-if="session.role === 'civilian'" class="space-y-4">
          <!-- Pending State -->
          <div v-if="requestStatus === 'pending'" class="card bg-[var(--amber-bg)] border border-[var(--line)] space-y-2 text-[var(--amber-c)]">
            <div class="flex items-center gap-2 font-bold">
              <MaterialIcon name="pending" class="text-[var(--amber-dot)] animate-pulse" :size="20" />
              <span class="text-sm">{{ t('verify.requestTitle') }}</span>
            </div>
            <p class="text-xs leading-relaxed font-semibold">{{ t('verify.requestPending') }}</p>
          </div>

          <!-- Request Form -->
          <div v-else class="card bg-[#F4F2EE] border border-[var(--line)] space-y-4">
            <div class="space-y-1">
              <h2 class="font-extrabold text-[var(--ink)] text-sm">{{ t('verify.requestTitle') }}</h2>
              <p class="text-xs text-[var(--ink2)] leading-relaxed">{{ t('verify.requestDesc') }}</p>
            </div>
            <div class="space-y-3">
              <div class="space-y-1.5">
                <label class="block text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('verify.phoneLabel') }} *</label>
                <input
                  v-model="requestPhone"
                  type="tel"
                  :placeholder="t('verify.phonePlaceholder')"
                  class="input-field"
                />
              </div>
              <div class="space-y-1.5">
                <label class="block text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('verify.requestRoleLabel') }} *</label>
                <select v-model="requestRole" class="input-field">
                  <option value="rescuer">{{ t('verify.roleRescatista') }}</option>
                  <option value="coordinator">{{ t('verify.roleCoordinador') }}</option>
                </select>
              </div>
              <!-- Hub/Brigade selection: required for rescuer & coordinator -->
              <div class="space-y-1.5">
                <label class="block text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">
                  {{ t('verify.requestHubLabel') }}
                  <span v-if="hubRequired" class="text-[var(--red-dot)] ml-0.5">*</span>
                </label>
                <select v-model="selectedHubId" class="input-field" :class="hubRequired && !selectedHubId ? 'border-[var(--amber-dot)]' : ''">
                  <option value="">{{ t('verify.requestHubPlaceholder') }}</option>
                  <option v-for="h in hubsStore.hubs" :key="h.id" :value="h.id">
                    {{ h.name }} ({{ h.hubType === 'mobile' ? 'Brigada Móvil' : 'Estático' }})
                  </option>
                </select>
                <p v-if="hubRequired && !selectedHubId" class="text-[11px] text-[var(--amber-c)] font-semibold flex items-center gap-1">
                  <MaterialIcon name="info" :size="13" /> Debes pertenecer a una unidad o brigada registrada.
                </p>
              </div>
              <div class="space-y-1.5">
                <label class="block text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('verify.requestNotePlaceholder') }}</label>
                <textarea
                  v-model="requestNote"
                  :placeholder="t('verify.requestNotePlaceholder')"
                  rows="3"
                  class="input-field"
                />
              </div>
              <BaseButton block :disabled="busy || !canSubmitRequest" @click="doSubmitRequest">
                {{ t('verify.requestButton') }}
              </BaseButton>
            </div>
          </div>
        </div>

        <div v-else class="card bg-[var(--green-bg)] border border-[var(--line)] text-center py-5 space-y-1">
          <MaterialIcon name="verified" :size="28" class="text-[var(--green-dot)] mx-auto" />
          <p class="text-xs font-bold text-[var(--green-c)]">{{ t('verify.alreadyResponder') }}</p>
        </div>

        <!-- Role Dictionary Card (Educational) -->
        <div class="card bg-white border border-[var(--line)] space-y-3">
          <h3 class="text-xs font-extrabold text-[var(--ink)] uppercase tracking-wider">{{ t('verify.rolesExplanationTitle') }}</h3>
          <div class="space-y-3 divide-y divide-[var(--line)]">
            <div class="pt-2 first:pt-0">
              <span class="text-xs font-bold text-[var(--ink)]">{{ t('verify.roleColaborador') }}</span>
              <p class="text-[11px] text-[var(--ink2)] mt-0.5 leading-relaxed">{{ t('verify.colaboradorDesc') }}</p>
            </div>
            <div class="pt-2">
              <span class="text-xs font-bold text-[var(--ink)]">{{ t('verify.roleRescatista') }}</span>
              <p class="text-[11px] text-[var(--ink2)] mt-0.5 leading-relaxed">{{ t('verify.rescatistaDesc') }}</p>
            </div>
            <div class="pt-2">
              <span class="text-xs font-bold text-[var(--ink)]">{{ t('verify.roleCoordinador') }}</span>
              <p class="text-[11px] text-[var(--ink2)] mt-0.5 leading-relaxed">{{ t('verify.coordinadorDesc') }}</p>
            </div>
            <div class="pt-2">
              <span class="text-xs font-bold text-[var(--ink)]">{{ t('verify.roleOrganizador') }}</span>
              <p class="text-[11px] text-[var(--ink2)] mt-0.5 leading-relaxed">{{ t('verify.organizadorDesc') }}</p>
            </div>
            <div class="pt-2">
              <span class="text-xs font-bold text-[var(--ink)]">{{ t('verify.roleFundador') }}</span>
              <p class="text-[11px] text-[var(--ink2)] mt-0.5 leading-relaxed">{{ t('verify.fundadorDesc') }}</p>
            </div>
          </div>
        </div>

        <!-- Logout Button -->
        <BaseButton block variant="neutral" :disabled="busy" @click="doSignOut">
          <span class="inline-flex items-center gap-1.5 justify-center w-full font-bold">
            <MaterialIcon name="logout" :size="18" />
            {{ t('verify.signOutButton') }}
          </span>
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  background: var(--screen);
  min-height: 100%;
  padding-bottom: 30px;
}
.wrap {
  margin: 0 auto;
  padding: 16px 16px 24px;
}
.card {
  background: var(--card);
  border: 1.5px solid var(--line);
  border-radius: 20px;
  padding: 20px;
}
.input-field {
  width: 100%;
  border: 1.5px solid var(--line);
  background: #fff;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 14px;
  font-family: inherit;
  color: var(--ink);
  outline: none;
}
.input-field:focus {
  border-color: var(--primary);
}
.google-btn {
  background: #fff;
  color: var(--ink);
  border: 1.5px solid var(--line);
}
.google-btn:hover {
  background: #F6F4EF;
}
</style>
