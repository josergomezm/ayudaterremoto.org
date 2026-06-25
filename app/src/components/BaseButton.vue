<script setup lang="ts">
// One styled button with neutral colors and large tap targets (panic-proof UI).
withDefaults(defineProps<{
  variant?: 'primary' | 'neutral' | 'danger'
  block?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}>(), { variant: 'primary', block: false, disabled: false, type: 'button' })

const classes: Record<string, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-700 active:bg-slate-800',
  neutral: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="[
      'rounded-xl px-5 py-3 text-base font-semibold transition-colors min-h-12',
      'disabled:opacity-50 disabled:pointer-events-none',
      classes[variant],
      block ? 'w-full' : '',
    ]"
  >
    <slot />
  </button>
</template>
