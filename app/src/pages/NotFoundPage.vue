<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'

const { t } = useI18n()
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col items-center gap-4 p-12 text-center">
    <h1 class="text-2xl font-bold text-slate-900">{{ t('notFound.title') }}</h1>
    <RouterLink to="/"><BaseButton>{{ t('notFound.goHome') }}</BaseButton></RouterLink>
  </div>
</template>
