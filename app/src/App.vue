<script setup lang="ts">
import { ref } from 'vue'
import AppShell from './components/AppShell.vue'
import WelcomeModal from './components/WelcomeModal.vue'

const STORAGE_KEY = 'ayudaterremoto.welcomed'

function hasSeenWelcome(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}

const showWelcome = ref(!hasSeenWelcome())

function onWelcomeClose() {
  showWelcome.value = false
}

// Expose globally so AboutPage can re-trigger the modal
function replayWelcome() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  showWelcome.value = true
}

// Make replayWelcome available via a custom event so AboutPage doesn't need a direct ref
window.addEventListener('ayudaterremoto:replay-welcome', replayWelcome)
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
  <WelcomeModal v-if="showWelcome" @close="onWelcomeClose" />
</template>
