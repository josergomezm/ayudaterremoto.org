import { ref, onMounted, onUnmounted } from 'vue'
import { API_BASE_URL } from '../lib/api'

// Connectivity = can we actually reach the API. navigator.onLine is unreliable
// (it can report false while you're online), so we confirm with a real /health
// ping instead of trusting it. Re-checks on the browser online/offline events
// and on an interval.
export function useOnline() {
  const online = ref(true)
  let timer: ReturnType<typeof setInterval> | undefined

  async function check() {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal, cache: 'no-store' })
      clearTimeout(t)
      online.value = res.ok
    } catch {
      online.value = false
    }
  }

  const recheck = () => { void check() }

  onMounted(() => {
    void check()
    window.addEventListener('online', recheck)
    window.addEventListener('offline', recheck)
    timer = setInterval(check, 20000)
  })
  onUnmounted(() => {
    window.removeEventListener('online', recheck)
    window.removeEventListener('offline', recheck)
    if (timer) clearInterval(timer)
  })

  return { online }
}
