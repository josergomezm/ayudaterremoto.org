import { nextTick } from 'vue'
import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'map', component: () => import('../pages/MapPage.vue') },
    { path: '/incidents/:id', name: 'incident-detail', component: () => import('../pages/IncidentDetailPage.vue') },
    { path: '/report', name: 'report', component: () => import('../pages/ReportPage.vue') },
    { path: '/verify', name: 'verify', component: () => import('../pages/VerifyPage.vue') },
    { path: '/alerts', name: 'alerts', component: () => import('../pages/AnnouncementsPage.vue') },
    { path: '/guides', name: 'guides', component: () => import('../pages/GuidesPage.vue') },
    { path: '/people', name: 'people', component: () => import('../pages/PeoplePage.vue') },
    { path: '/guides/:id', name: 'guide-detail', component: () => import('../pages/GuideDetailPage.vue') },
    { path: '/about', name: 'about', component: () => import('../pages/AboutPage.vue') },
    { path: '/admin', name: 'admin', component: () => import('../pages/AdminPage.vue') },
    // Catch-all 404. Required because Firebase Hosting rewrites every URL to
    // index.html — without this, typos render an empty RouterView.
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFoundPage.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
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
