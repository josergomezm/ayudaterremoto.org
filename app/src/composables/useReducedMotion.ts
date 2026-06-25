import { ref, onMounted, onUnmounted } from 'vue'

/** Reactive `prefers-reduced-motion: reduce` media query. */
export function useReducedMotion() {
  const reduced = ref(false)
  let mq: MediaQueryList | null = null
  const update = () => { reduced.value = mq?.matches ?? false }

  onMounted(() => {
    mq = matchMedia('(prefers-reduced-motion: reduce)')
    update()
    mq.addEventListener('change', update)
  })
  onUnmounted(() => mq?.removeEventListener('change', update))

  return { reduced }
}
