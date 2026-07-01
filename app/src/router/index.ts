import { nextTick } from 'vue'
import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import { isModuleEnabled } from '../config/features'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // WS5: el Home es la lista de necesidades (NeedsHomePage).
    { path: '/', name: 'home', component: () => import('../pages/NeedsHomePage.vue') },
    { path: '/me', name: 'my-activity', component: () => import('../pages/MyActivityPage.vue') },
    { path: '/profile', name: 'profile', component: () => import('../pages/ProfilePage.vue') },
    { path: '/verify', redirect: '/profile' },
    { path: '/incidents', name: 'incidents', component: () => import('../pages/MapPage.vue'), meta: { module: 'emergencies' } },
    { path: '/incidents/:id', name: 'incident-detail', component: () => import('../pages/IncidentDetailPage.vue'), meta: { module: 'emergencies' } },
    { path: '/report', name: 'report', component: () => import('../pages/ReportPage.vue'), meta: { module: 'emergencies' } },
    { path: '/people', name: 'people', component: () => import('../pages/PeoplePage.vue'), meta: { module: 'emergencies' } },
    { path: '/alerts', name: 'alerts', component: () => import('../pages/AnnouncementsPage.vue') },
    { path: '/guides', name: 'guides', component: () => import('../pages/GuidesPage.vue') },
    { path: '/guides/:id', name: 'guide-detail', component: () => import('../pages/GuideDetailPage.vue') },
    { path: '/about', name: 'about', component: () => import('../pages/AboutPage.vue') },
    // Admin-only routes
    { path: '/admin', name: 'admin', component: () => import('../pages/AdminPage.vue'), meta: { requiresAdmin: true } },
    { path: '/hubs', name: 'hubs', component: () => import('../pages/HubsPage.vue') },
    { path: '/hubs/create', name: 'hub-create', component: () => import('../pages/HubCreatePage.vue'), meta: { requiresAdmin: true } },
    { path: '/hubs/:id', name: 'hub-detail', component: () => import('../pages/HubDetailPage.vue') },
    { path: '/hubs/:id/manage', name: 'hub-manage', component: () => import('../pages/HubManagePage.vue'), meta: { requiresCoordinator: true } },
    { path: '/brigades', name: 'brigades', component: () => import('../pages/BrigadesPage.vue'), meta: { module: 'brigades' } },
    { path: '/brigades/:id', name: 'brigade-detail', component: () => import('../pages/BrigadeDetailPage.vue'), meta: { module: 'brigades' } },
    // Catch-all 404. Required because Firebase Hosting rewrites every URL to
    // index.html — without this, typos render an empty RouterView.
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFoundPage.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// ── ROUTE AUTH GUARDS ────────────────────────────────────────────────────────
// Protects sensitive routes at the router level (belt-and-suspenders alongside
// in-template v-if checks). Waits for the session to be ready before deciding.
router.beforeEach(async (to) => {
  // Modo suministros: las rutas de módulos escondidos (Emergencias/Brigadas)
  // siguen registradas por si se reactiva el flag, pero se redirigen al Home.
  const mod = to.meta.module as string | undefined
  if (mod && !isModuleEnabled(mod)) return { name: 'home' }

  if (!to.meta.requiresAdmin && !to.meta.requiresCoordinator) return true

  const session = useSessionStore()
  const admin = useAdminStore()

  // Wait for session to hydrate (firebase auth + /auth/me)
  if (!session.ready) {
    await new Promise<void>((resolve) => {
      const stop = session.$subscribe(() => { if (session.ready) { stop(); resolve() } })
    })
  }

  if (to.meta.requiresAdmin && !admin.isAdmin) {
    return { name: 'profile' }
  }
  if (to.meta.requiresCoordinator && !session.can('coordinator') && !admin.isAdmin) {
    return { name: 'profile' }
  }
  return true
})

// ── VIEW TRANSITION WRAPPER ─────────────────────────────────────────────────
// Every navigation becomes a view transition when the browser supports it.
// Pages opt into specific effects purely via CSS in assets/css/transitions.css —
// this file never changes per-page. NEVER call startViewTransition elsewhere.
router.beforeResolve(async (_to, from) => {
  if (from === START_LOCATION) return                              // initial load: no transition
  if (!document.startViewTransition) return                        // unsupported: navigate plainly
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // Snapshot the old page, let Vue swap the route INSIDE the transition
  // callback, then the browser cross-fades / morphs matching
  // view-transition-names. Resolving the guard lets vue-router proceed with the
  // component swap; nextTick() waits for Vue to flush the new DOM before the
  // browser captures the "new" snapshot.
  await new Promise<void>((resolve) => {
    document.startViewTransition(() => {
      resolve()
      return nextTick()
    })
  })
})

export default router

