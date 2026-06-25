import { auth } from './firebase'
import { request, getAuthToken, type ApiResult } from './api'

// Cross-tier authenticated call. An admin (coordinator/command, signed in with
// Google) acts with their Firebase ID token; a field user (responder/civilian)
// acts with their device-session token. The backend's getActor() accepts either.
// Use this for actions a higher role may also perform (e.g. changing incident
// status, which both responders and coordinators can do).
export async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    return request<T>(path, init, token)
  }
  return request<T>(path, init, getAuthToken())
}
