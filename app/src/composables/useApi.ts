import { ref, shallowRef } from 'vue'
import { apiFetch, type ApiResult } from '../lib/api'

/** Loading/error/data wrapper around apiFetch for one-shot calls. */
export function useApi<T>(path: string, init?: RequestInit) {
  const data = shallowRef<T | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  async function execute(overrideInit?: RequestInit): Promise<ApiResult<T>> {
    loading.value = true
    error.value = null
    const res = await apiFetch<T>(path, overrideInit ?? init)
    if (res.ok) data.value = res.data
    else error.value = res.error
    loading.value = false
    return res
  }

  return { data, error, loading, execute }
}
