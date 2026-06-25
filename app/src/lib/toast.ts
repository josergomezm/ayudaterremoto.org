import { reactive } from 'vue'

// Tiny app-wide toast system. Push from anywhere with useToast(); rendered once
// by ToastHost.vue (mounted in AppShell).
export type ToastType = 'success' | 'error' | 'info'
export interface Toast { id: number; message: string; type: ToastType }

const state = reactive<{ items: Toast[] }>({ items: [] })
let seq = 0

function push(message: string, type: ToastType) {
  const id = ++seq
  state.items.push({ id, message, type })
  setTimeout(() => dismiss(id), 4000)
}
function dismiss(id: number) {
  const i = state.items.findIndex((t) => t.id === id)
  if (i >= 0) state.items.splice(i, 1)
}

export const toasts = state

export function useToast() {
  return {
    success: (m: string) => push(m, 'success'),
    error: (m: string) => push(m, 'error'),
    info: (m: string) => push(m, 'info'),
    dismiss,
  }
}
