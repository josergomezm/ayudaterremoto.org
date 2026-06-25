import { auth } from './firebase'
import { request, type ApiResult } from './api'

/** Admin-tier call: attaches the current Firebase user's ID token. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const user = auth.currentUser
  const token = user ? await user.getIdToken() : null
  return request<T>(path, init, token)
}
