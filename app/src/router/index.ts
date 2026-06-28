import { nextTick } from 'vue'
import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // WS4: el motor SAR (incidentes / reportes / desaparecidos) queda desconectado
    // del cliente. El backend se conserva intacto y el código vive en la rama
    // parked/sar-engine. Home interino → Zonas (el WS5 rediseña el Home).
    { path: '/', redirect: '/hubs' },
    { path: '/verify', name: 'verify', component: () => import('../pages/VerifyPage.vue') },
    { path: '/alerts', name: 'alerts', component: () => import('../pages/AnnouncementsPage.vue') },
    { path: '/guides', name: 'guides', component: () => import('../pages/GuidesPage.vue') },
    { path: '/guides/:id', name: 'guide-detail', component: () => import('../pages/GuideDetailPage.vue') },
    { path: '/about', name: 'about', component: () => import('../pages/AboutPage.vue') },
    { path: '/admin', name: 'admin', component: () => import('../pages/AdminPage.vue') },
    { path: '/hubs', name: 'hubs', component: () => import('../pages/HubsPage.vue') },
    { path: '/hubs/create', name: 'hub-create', component: () => import('../pages/HubCreatePage.vue') },
    { path: '/hubs/:id', name: 'hub-detail', component: () => import('../pages/HubDetailPage.vue') },
    { path: '/hubs/:id/manage', name: 'hub-manage', component: () => import('../pages/HubManagePage.vue') },
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
