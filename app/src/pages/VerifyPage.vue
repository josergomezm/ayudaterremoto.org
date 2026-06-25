<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '../stores/session'
import BaseButton from '../components/BaseButton.vue'
import MaterialIcon from '../components/MaterialIcon.vue'

const { t } = useI18n()
const session = useSessionStore()

const vouchCode = ref('')
const message = ref<string | null>(null)
const messageType = ref<'success' | 'error' | null>(null)
const busy = ref(false)

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
  } catch (err) {
    message.value = err instanceof Error ? err.message : String(err)
    messageType.value = 'error'
  } finally {
    busy.value = false
  }
}

async function doRedeem() {
  if (!vouchCode.value) return
  busy.value = true
  message.value = null
  messageType.value = null
  const res = await session.redeemVouch(vouchCode.value)
  busy.value = false
  if (res.ok) {
    message.value = t('verify.success')
    messageType.value = 'success'
    vouchCode.value = ''
  } else {
    message.value = res.error || t('verify.failed')
    messageType.value = 'error'
  }
}

function getRoleLabel(role: string) {
  if (role === 'civilian') return t('verify.roleCivilian')
  if (role === 'responder') return t('verify.roleResponder')
  if (role === 'authority') return t('verify.roleAuthority')
  if (role === 'command') return t('verify.roleCommand')
  return role
}
</script>

<template>
  <div class="mx-auto max-w-md space-y-6 p-4">
    <div class="space-y-2 text-center">
      <h1 class="text-2xl font-bold text-slate-900">{{ t('verify.title') }}</h1>
      <p class="text-sm text-slate-600">{{ t('verify.intro') }}</p>
    </div>

    <!-- Alert / Toast Banner inside the page -->
    <div
      v-if="message"
      class="rounded-xl p-4 text-sm font-medium ring-1"
      :class="messageType === 'success' ? 'bg-emerald-50 text-emerald-950 ring-emerald-100' : 'bg-red-50 text-red-950 ring-red-100'"
    >
      <div class="flex items-center gap-2">
        <MaterialIcon :name="messageType === 'success' ? 'check_circle' : 'error'" :size="18" />
        <span>{{ message }}</span>
      </div>
    </div>

    <!-- Guest state — Sign In with Google -->
    <div v-if="!session.isVerified" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 text-center space-y-4">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <MaterialIcon name="lock" :size="24" />
      </div>
      <p class="text-xs text-slate-400">
        Para garantizar la confiabilidad de los reportes y evitar el spam de incidentes duplicados o falsos.
      </p>
      <BaseButton block :disabled="busy" @click="doSignIn">
        <span class="inline-flex items-center justify-center gap-2 w-full">
          <svg class="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          {{ t('verify.signInButton') }}
        </span>
      </BaseButton>
    </div>

    <!-- Authenticated State -->
    <div v-else class="space-y-6">
      <!-- Profile Summary -->
      <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-lg">
            {{ session.name ? session.name.charAt(0).toUpperCase() : 'G' }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{{ t('verify.signedInAs') }}</p>
            <p class="font-semibold text-slate-800 truncate">{{ session.name }}</p>
            <p class="text-sm text-slate-500 truncate">{{ session.email }}</p>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-4 flex justify-between items-center text-sm">
          <span class="font-medium text-slate-500">{{ t('verify.activeRole') }}</span>
          <span class="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
            {{ getRoleLabel(session.role ?? 'civilian') }}
          </span>
        </div>
      </div>

      <!-- Vouch Code Elevation -->
      <div v-if="session.role === 'civilian'" class="rounded-2xl bg-indigo-50/50 p-6 ring-1 ring-indigo-100 space-y-4">
        <div class="space-y-1">
          <h2 class="font-bold text-indigo-950">{{ t('verify.vouchPrompt') }}</h2>
          <p class="text-xs text-indigo-900/70">{{ t('verify.vouchHint') }}</p>
        </div>
        <div class="flex gap-2">
          <input
            v-model="vouchCode"
            :placeholder="t('verify.vouchPlaceholder')"
            class="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm uppercase ring-offset-indigo-50 focus:border-indigo-500 focus:outline-none"
          />
          <BaseButton :disabled="busy || !vouchCode" @click="doRedeem">{{ t('verify.confirm') }}</BaseButton>
        </div>
      </div>

      <div v-else class="rounded-2xl bg-slate-50 p-6 text-center space-y-2 text-slate-500">
        <MaterialIcon name="verified" :size="28" class="text-indigo-600" />
        <p class="text-xs font-medium">{{ t('verify.alreadyResponder') }}</p>
      </div>

      <!-- Logout Button -->
      <BaseButton block variant="neutral" :disabled="busy" @click="doSignOut">
        <span class="inline-flex items-center gap-1.5"><MaterialIcon name="logout" :size="18" /> {{ t('verify.signOutButton') }}</span>
      </BaseButton>
    </div>
  </div>
</template>
