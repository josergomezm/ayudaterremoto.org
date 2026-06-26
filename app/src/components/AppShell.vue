<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import AnnouncementBanner from './AnnouncementBanner.vue'
import OfflineBanner from './OfflineBanner.vue'
import MaterialIcon from './MaterialIcon.vue'
import ToastHost from './ToastHost.vue'
import { useSessionStore } from '../stores/session'
import { useIncidentsStore } from '../stores/incidents'
import logoUrl from '../assets/logo.svg'

const { t } = useI18n()
const route = useRoute()
const session = useSessionStore()
const incidents = useIncidentsStore()

onMounted(() => incidents.refreshPending())

const roleLabel = computed(() => t('roles.' + (session.role ?? 'unverified')))

// Material Symbols icon names (https://fonts.google.com/icons).
const nav = [
  { name: 'map', to: '/', label: 'shell.nav.map', icon: 'map' },
  { name: 'report', to: '/report', label: 'shell.nav.report', icon: 'add_circle' },
  { name: 'alerts', to: '/alerts', label: 'shell.nav.alerts', icon: 'campaign' },
  { name: 'guides', to: '/guides', label: 'shell.nav.guides', icon: 'menu_book' },
  { name: 'people', to: '/people', label: 'shell.nav.people', icon: 'person_search' },
  { name: 'hubs', to: '/hubs', label: 'shell.nav.hubs', icon: 'warehouse' },
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
          v-for="item in nav"
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

      <!-- ── MOBILE BOTTOM NAV (below md) ───────────────────────────── -->
      <nav class="fixed bottom-0 left-0 right-0 z-50 pb-safe border-t border-slate-200 bg-white md:hidden">
        <div class="grid grid-cols-7">
          <RouterLink
            v-for="item in nav"
            :key="item.name"
            :to="item.to"
            class="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium"
            :class="isActive(item.to) ? 'text-slate-900' : 'text-slate-400'"
          >
            <MaterialIcon :name="item.icon" :size="24" />
            {{ t(item.label) }}
          </RouterLink>
        </div>
      </nav>
    </div>
  </div>
</template>
