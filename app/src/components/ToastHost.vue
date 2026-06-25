<script setup lang="ts">
import { toasts, useToast, type ToastType } from '../lib/toast'
import MaterialIcon from './MaterialIcon.vue'

const { dismiss } = useToast()
const icon: Record<ToastType, string> = { success: 'check_circle', error: 'error', info: 'info' }
const cls: Record<ToastType, string> = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-slate-800' }
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 pb-safe">
    <TransitionGroup name="toast">
      <button
        v-for="t in toasts.items"
        :key="t.id"
        type="button"
        class="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg"
        :class="cls[t.type]"
        role="status"
        @click="dismiss(t.id)"
      >
        <MaterialIcon :name="icon[t.type]" :size="18" />
        <span class="text-left">{{ t.message }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>
