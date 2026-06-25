<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { GUIDES } from '../lib/guides'
import MaterialIcon from '../components/MaterialIcon.vue'

const { t } = useI18n()
</script>

<template>
  <div class="mx-auto  space-y-5 p-4">
    <header class="space-y-1">
      <h1 class="text-xl font-bold text-slate-900">{{ t('guides.title') }}</h1>
      <p class="text-sm text-slate-600">{{ t('guides.intro') }}</p>
    </header>

    <div class="grid gap-3 sm:grid-cols-2">
      <RouterLink
        v-for="g in GUIDES"
        :key="g.id"
        :to="`/guides/${g.id}`"
        class="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md"
      >
        <!-- HERO SOURCE: matching name on the detail page morphs this icon tile -->
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"
          :style="{ viewTransitionName: 'guide-' + g.id }"
        >
          <MaterialIcon :name="g.icon" :size="24" />
        </span>
        <span class="min-w-0">
          <span
            class="block font-semibold text-slate-900"
            :style="{ viewTransitionName: 'guide-title-' + g.id }"
          >{{ t('guides.' + g.id + '.title') }}</span>
          <span class="mt-0.5 block text-sm text-slate-600">{{ t('guides.' + g.id + '.summary') }}</span>
        </span>
      </RouterLink>
    </div>

    <p class="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{{ t('guides.disclaimer') }}</p>
  </div>
</template>
