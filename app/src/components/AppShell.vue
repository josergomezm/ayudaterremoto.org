<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import AnnouncementBanner from './AnnouncementBanner.vue'
import OfflineBanner from './OfflineBanner.vue'
import MaterialIcon from './MaterialIcon.vue'
import ToastHost from './ToastHost.vue'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import { useIncidentsStore } from '../stores/incidents'
import logoUrl from '../assets/logo.svg'

const { t } = useI18n()
const route = useRoute()
const session = useSessionStore()
const admin = useAdminStore()
const incidents = useIncidentsStore()

onMounted(() => incidents.refreshPending())

const roleLabel = computed(() => t('roles.' + (session.role ?? 'unverified')))

// Material Symbols icon names (https://fonts.google.com/icons).
// WS5: bottom-tab del rediseño — Necesidades / Zonas / Mi actividad / Organizar.
// "Organizar" (→ /admin) solo para Organizador+.
const tabs = computed(() => {
  const list = [
    { name: 'needs', to: '/', label: 'shell.nav.needs', icon: 'inventory_2' },
    { name: 'hubs', to: '/hubs', label: 'shell.nav.hubs', icon: 'location_on' },
    { name: 'activity', to: '/me', label: 'shell.nav.activity', icon: 'person' },
  ]
  if (admin.isAdmin) list.push({ name: 'organize', to: '/admin', label: 'shell.nav.organize', icon: 'admin_panel_settings' })
  return list
})
// Sidebar de escritorio: set completo (Alertas/Guías/Acerca siguen accesibles aquí).
const sideNav = [
  { name: 'needs', to: '/', label: 'shell.nav.needs', icon: 'inventory_2' },
  { name: 'hubs', to: '/hubs', label: 'shell.nav.hubs', icon: 'warehouse' },
  { name: 'activity', to: '/me', label: 'shell.nav.activity', icon: 'person' },
  { name: 'alerts', to: '/alerts', label: 'shell.nav.alerts', icon: 'campaign' },
  { name: 'guides', to: '/guides', label: 'shell.nav.guides', icon: 'menu_book' },
  { name: 'about', to: '/about', label: 'shell.nav.about', icon: 'info' },
]

// Highlight a tab for its page AND its nested routes (e.g. /guides/:id).
function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <!-- Layout: sidebar + content on desktop (md+); stacked header/content/bottom-nav on mobile -->
  <div class="flex h-full md:flex-row flex-col">
    <!-- ── DESKTOP SIDEBAR (md and up) ──────────────────────────────── -->
    <aside class="pt-safe pl-safe hidden w-60 shrink-0 flex-col bg-slate-900 text-white md:flex">
      <RouterLink to="/" class="flex items-center gap-3 px-5 py-5 leading-tight">
        <img :src="logoUrl" alt="" class="h-9 w-9 shrink-0" />
        <span>
          <span class="block text-lg font-bold">{{ t('shell.appName') }}</span>
          <span class="block text-xs text-white/60">{{ roleLabel }}</span>
        </span>
      </RouterLink>

      <nav class="flex-1 space-y-1 px-3">
        <RouterLink
          v-for="item in sideNav"
          :key="item.name"
          :to="item.to"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          :class="isActive(item.to) ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'"
        >
          <MaterialIcon :name="item.icon" :size="22" />
          {{ t(item.label) }}
        </RouterLink>
      </nav>

      <div class="space-y-3 px-5 pb-5">
        <RouterLink
          v-if="!session.isVerified"
          to="/verify"
          class="flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900"
        >
          <MaterialIcon name="badge" :size="18" /> {{ t('verify.title') }}
        </RouterLink>
        <RouterLink
          to="/admin"
          class="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white"
        >
          <MaterialIcon name="admin_panel_settings" :size="18" /> {{ t('shell.admin') }}
        </RouterLink>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- ── MOBILE TOP HEADER (below md) ────────────────────────────── -->
      <header class="pt-safe bg-slate-900 text-white md:hidden">
        <div class="flex items-center justify-between px-4 py-3">
          <RouterLink to="/" class="flex items-center gap-2 leading-tight">
            <img :src="logoUrl" alt="" class="h-8 w-8 shrink-0" />
            <span>
              <span class="block text-base font-bold">{{ t('shell.appName') }}</span>
              <span class="block text-[11px] text-white/60">{{ roleLabel }}</span>
            </span>
          </RouterLink>
          <RouterLink
            v-if="!session.isVerified"
            to="/verify"
            class="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
          >
            <MaterialIcon name="badge" :size="16" /> {{ t('verify.title') }}
          </RouterLink>
        </div>
      </header>

      <AnnouncementBanner />
      <OfflineBanner />

      <main class="flex-1 overflow-y-auto pb-20 md:pb-0">
        <slot />
      </main>

      <ToastHost />

      <!-- ── MOBILE BOTTOM NAV (below md) · rediseño WS5 ─────────────── -->
      <nav
        class="fixed bottom-0 left-0 right-0 z-50 pb-safe md:hidden"
        style="background:#fff;border-top:1px solid #E7E2D9;font-family:'Plus Jakarta Sans',system-ui,sans-serif;"
      >
        <div class="flex justify-around" style="padding:10px 8px 12px;">
          <RouterLink
            v-for="item in tabs"
            :key="item.name"
            :to="item.to"
            class="flex flex-col items-center gap-0.5 no-underline"
          >
            <MaterialIcon :name="item.icon" :size="25" :fill="isActive(item.to)" :style="{ color: isActive(item.to) ? '#2350C9' : '#6F685C' }" />
            <span :style="{ fontSize: '10.5px', fontWeight: isActive(item.to) ? 800 : 700, color: isActive(item.to) ? '#2350C9' : '#6F685C' }">{{ t(item.label) }}</span>
          </RouterLink>
        </div>
      </nav>
    </div>
  </div>
</template>
