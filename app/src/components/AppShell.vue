<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import AnnouncementBanner from './AnnouncementBanner.vue'
import OfflineBanner from './OfflineBanner.vue'
import MaterialIcon from './MaterialIcon.vue'
import ToastHost from './ToastHost.vue'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import { useIncidentsStore } from '../stores/incidents'
import { isModuleEnabled } from '../config/features'
import logoUrl from '../assets/logo.svg'

const { t } = useI18n()
const route = useRoute()
const session = useSessionStore()
const admin = useAdminStore()
const incidents = useIncidentsStore()

const isDrawerOpen = ref(false)

onMounted(() => incidents.refreshPending())

const roleLabel = computed(() => t('roles.' + (session.role ?? 'unverified')))

// Auto-close drawer on navigation
watch(() => route.path, () => {
  isDrawerOpen.value = false
})

const openDrawer = () => { isDrawerOpen.value = true }
const closeDrawer = () => { isDrawerOpen.value = false }

// Categorized navigation groups.
const navGroups = computed(() => {
  const list = [
    {
      title: 'shell.groups.supplies',
      items: [
        { name: 'needs', to: '/', label: 'shell.nav.needs', icon: 'inventory_2' },
        { name: 'hubs', to: '/hubs', label: 'shell.nav.hubs', icon: 'warehouse' },
        { name: 'brigades', to: '/brigades', label: 'shell.nav.brigades', icon: 'group_work', module: 'brigades' },
      ]
    },
    {
      title: 'shell.groups.emergencies',
      items: [
        { name: 'incidents', to: '/incidents', label: 'shell.nav.map', icon: 'map', module: 'emergencies' },
        { name: 'report', to: '/report', label: 'shell.nav.report', icon: 'add_circle', module: 'emergencies' },
        { name: 'people', to: '/people', label: 'shell.nav.people', icon: 'person_search', module: 'emergencies' },
      ]
    },
    {
      title: 'shell.groups.personal',
      items: [
        { name: 'activity', to: '/me', label: 'shell.nav.activity', icon: 'volunteer_activism' },
      ]
    },
    {
      title: 'shell.groups.info',
      items: [
        { name: 'alerts', to: '/alerts', label: 'shell.nav.alerts', icon: 'campaign' },
        { name: 'guides', to: '/guides', label: 'shell.nav.guides', icon: 'menu_book' },
        { name: 'about', to: '/about', label: 'shell.nav.about', icon: 'info' },
      ]
    }
  ]
  if (admin.isAdmin) {
    list.push({
      title: 'shell.groups.admin',
      items: [
        { name: 'admin', to: '/admin', label: 'shell.nav.organize', icon: 'admin_panel_settings' }
      ]
    })
  }
  // Modo suministros: esconde del nav los ítems de módulos deshabilitados
  // (Emergencias, Brigadas) y descarta los grupos que queden vacíos.
  return list
    .map((g) => ({ ...g, items: g.items.filter((i) => isModuleEnabled((i as { module?: string }).module)) }))
    .filter((g) => g.items.length > 0)
})

// Highlight a tab for its page AND its nested routes (e.g. /guides/:id).
function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

function getRoleLabel(role: string) {
  if (role === 'civilian') return t('verify.roleColaborador')
  if (role === 'rescuer') return t('verify.roleRescatista')
  if (role === 'coordinator') return t('verify.roleCoordinador')
  if (role === 'admin') return t('verify.roleOrganizador')
  if (role === 'sudo') return t('verify.roleFundador')
  return role
}
</script>

<template>
  <!-- Layout: sidebar + content on desktop (md+); stacked header/content on mobile -->
  <div class="flex h-full md:flex-row flex-col select-none">
    
    <!-- ── DESKTOP SIDEBAR (md and up) ──────────────────────────────── -->
    <aside class="pt-safe pl-safe hidden w-60 shrink-0 flex-col bg-slate-900 text-white md:flex">
      <RouterLink to="/" class="flex items-center gap-3 px-5 py-5 leading-tight">
        <img :src="logoUrl" alt="" class="h-9 w-9 shrink-0" />
        <span>
          <span class="block text-lg font-bold">{{ t('shell.appName') }}</span>
          <span class="block text-xs text-white/60">{{ roleLabel }}</span>
        </span>
      </RouterLink>

      <nav class="flex-1 space-y-3.5 px-3 overflow-y-auto">
        <div v-for="group in navGroups" :key="group.title" class="space-y-0.5">
          <div class="px-3 pt-3 pb-1 text-[10px] font-bold text-white/40 uppercase tracking-wider select-none">
            {{ t(group.title) }}
          </div>
          <RouterLink
            v-for="item in group.items"
            :key="item.name"
            :to="item.to"
            class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
            :class="isActive(item.to) ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'"
          >
            <MaterialIcon :name="item.icon" :size="20" />
            {{ t(item.label) }}
          </RouterLink>
        </div>
      </nav>

      <div class="space-y-3 px-5 pb-5 pt-3 border-t border-white/10">
        <RouterLink
          to="/profile"
          class="flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-900"
        >
          <MaterialIcon name="person" :size="18" /> 
          {{ session.isVerified ? t('shell.nav.profile') : t('verify.loginTitle') }}
        </RouterLink>
      </div>
    </aside>

    <!-- Main Container -->
    <div class="flex min-w-0 flex-1 flex-col relative h-full">
      
      <!-- ── MOBILE TOP HEADER (below md) ────────────────────────────── -->
      <header class="pt-safe bg-slate-900 text-white md:hidden shrink-0">
        <div class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-3">
            <button 
              @click="openDrawer" 
              class="p-1 -ml-1 rounded-lg text-white hover:bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
            >
              <MaterialIcon name="menu" :size="24" />
            </button>
            <RouterLink to="/" class="flex items-center gap-2 leading-tight">
              <img :src="logoUrl" alt="" class="h-8 w-8 shrink-0" />
              <span>
                <span class="block text-base font-extrabold tracking-tight">{{ t('shell.appName') }}</span>
                <span class="block text-[10px] text-white/50 font-medium">{{ roleLabel }}</span>
              </span>
            </RouterLink>
          </div>
          <RouterLink
            to="/profile"
            class="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm active:scale-95 transition-transform"
          >
            <MaterialIcon name="person" :size="15" /> 
            {{ session.isVerified ? t('shell.nav.profile') : t('verify.loginTitle') }}
          </RouterLink>
        </div>
      </header>

      <!-- ── MOBILE DRAWER NAVIGATION OVERLAY ────────────────────────── -->
      <Transition name="fade">
        <div 
          v-if="isDrawerOpen" 
          class="fixed inset-0 bg-black/40 z-50 md:hidden" 
          @click="closeDrawer" 
        />
      </Transition>

      <Transition name="slide">
        <div 
          v-if="isDrawerOpen" 
          class="fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-2xl flex flex-col p-5 md:hidden overflow-y-auto"
        >
          <!-- Drawer Header -->
          <div class="flex items-center justify-between pb-4 border-b border-slate-200">
            <div class="flex items-center gap-2.5">
              <img :src="logoUrl" alt="" class="h-8 w-8 shrink-0" />
              <span class="font-extrabold text-slate-900 text-base tracking-tight">{{ t('shell.appName') }}</span>
            </div>
            <button 
              @click="closeDrawer" 
              class="p-1 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
            >
              <MaterialIcon name="close" :size="22" />
            </button>
          </div>

          <!-- Drawer Navigation Links -->
          <nav class="flex-1 mt-4 space-y-4 overflow-y-auto">
            <div v-for="group in navGroups" :key="group.title" class="space-y-0.5">
              <div class="px-3.5 pt-2 pb-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider select-none">
                {{ t(group.title) }}
              </div>
              <RouterLink
                v-for="item in group.items"
                :key="item.name"
                :to="item.to"
                class="flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors"
                :class="isActive(item.to) ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'"
              >
                <MaterialIcon :name="item.icon" :size="20" />
                {{ t(item.label) }}
              </RouterLink>
            </div>
          </nav>

          <!-- Drawer Profile Section at bottom -->
          <div class="pt-4 border-t border-slate-200 space-y-3">
            <RouterLink
              to="/profile"
              class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 font-extrabold text-sm">
                {{ session.name ? session.name.charAt(0).toUpperCase() : 'U' }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {{ session.isVerified ? getRoleLabel(session.role ?? 'civilian') : 'Invitado' }}
                </p>
                <p class="text-xs font-bold text-slate-800 truncate">
                  {{ session.isVerified ? session.name : 'Iniciar Sesión' }}
                </p>
              </div>
            </RouterLink>
          </div>
        </div>
      </Transition>

      <AnnouncementBanner />
      <OfflineBanner />

      <!-- Page view area -->
      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>

      <ToastHost />
    </div>
  </div>
</template>

<style scoped>
/* Fade transition for backdrop overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide transition for mobile drawer menu */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
