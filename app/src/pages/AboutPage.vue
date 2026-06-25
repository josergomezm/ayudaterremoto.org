<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useApi } from '../composables/useApi'
import BaseButton from '../components/BaseButton.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'
import Loader from '../components/Loader.vue'

const { t, tm, rt } = useI18n()

const GITHUB_URL = 'https://github.com/josergomezm/ayudaterremoto.org'
const howSteps = tm('about.how') as unknown[]

// Calls GET /health to prove the full app → Cloud Function path end to end.
const { data, error, loading, execute } = useApi<{ ok: boolean; ts: string }>('/health')
onMounted(() => execute())
</script>

<template>
  <!-- view-transition-name enables the per-page slide-in (transitions.css recipe 2) -->
  <section class="mx-auto  space-y-4 p-4" style="view-transition-name: about-page">
    <h1 class="text-xl font-bold text-slate-900">{{ t('about.title') }}</h1>
    <p class="text-slate-600">{{ t('about.body') }}</p>

    <!-- How it works -->
    <div class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 class="font-semibold text-slate-900">{{ t('about.howTitle') }}</h2>
      <ol class="space-y-2">
        <li v-for="(step, i) in howSteps" :key="i" class="flex gap-2 text-sm text-slate-700">
          <span class="font-bold text-slate-400">{{ i + 1 }}.</span>
          <span>{{ rt(step as string) }}</span>
        </li>
      </ol>
    </div>

    <!-- Disclaimer -->
    <div class="space-y-2 rounded-2xl bg-amber-50/50 p-4 shadow-sm ring-1 ring-amber-200">
      <h2 class="flex items-center gap-1.5 font-semibold text-amber-900">
        <MaterialIcon name="warning" :size="20" class="text-amber-700" />
        {{ t('about.disclaimerTitle') }}
      </h2>
      <p class="text-xs text-amber-900/80 leading-relaxed">
        {{ t('about.disclaimerBody') }}
      </p>
    </div>

    <!-- Language selector lives here (moved off the global nav) -->
    <div class="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <span class="flex items-center gap-2 font-medium text-slate-700">
        <MaterialIcon name="language" :size="20" /> {{ t('about.language') }}
      </span>
      <LocaleSwitcher />
    </div>

    <!-- Admin portal entry (gated by role on the page itself) -->
    <RouterLink
      to="/admin"
      class="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <span class="flex items-center gap-2 font-medium text-slate-700">
        <MaterialIcon name="admin_panel_settings" :size="20" /> {{ t('shell.admin') }}
      </span>
      <MaterialIcon name="chevron_right" :size="20" />
    </RouterLink>

    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <Loader v-if="loading" :label="t('about.checking')" />
      <p v-else-if="data?.ok" class="flex items-center gap-2 font-semibold text-emerald-700">
        <MaterialIcon name="check_circle" :size="20" /> {{ t('about.healthOk') }}
      </p>
      <div v-else class="space-y-3">
        <p class="flex items-center gap-2 font-semibold text-red-700">
          <MaterialIcon name="error" :size="20" /> {{ t('about.healthFail') }}
        </p>
        <p v-if="error" class="text-xs text-slate-500">{{ error }}</p>
        <BaseButton variant="neutral" @click="execute()">{{ t('common.retry') }}</BaseButton>
      </div>
    </div>

    <!-- Open source -->
    <div class="space-y-2 rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-200">
      <p class="text-sm text-slate-600">{{ t('about.openSource') }}</p>
      <a
        :href="GITHUB_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-2 font-semibold text-slate-900 hover:underline"
      >
        <MaterialIcon name="code" :size="20" /> {{ t('about.viewOnGithub') }}
      </a>
    </div>
  </section>
</template>
