<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as L from 'leaflet'
import type { Incident } from '../stores/incidents'

const props = defineProps<{ incidents: Incident[] }>()
const router = useRouter()

const el = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let markers: L.LayerGroup | null = null

const COLORS: Record<string, string> = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444' }
const CARACAS: L.LatLngTuple = [10.5, -66.91]

// We use circleMarkers (not the default pin) to avoid bundler issues with
// Leaflet's marker icon images, and to color markers by triage status.
function render() {
  if (!map || !markers) return
  markers.clearLayers()
  const pts: L.LatLngTuple[] = []
  for (const i of props.incidents) {
    const fill = i.evacuated ? '#64748b' : (COLORS[i.status] ?? '#64748b')
    const marker = L.circleMarker([i.lat, i.lng], {
      radius: 9, weight: 2, color: '#ffffff', fillColor: fill, fillOpacity: 0.95,
    })
    marker.on('click', () => router.push(`/incidents/${i.id}`))
    marker.addTo(markers)
    pts.push([i.lat, i.lng])
  }
  if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 })
}

onMounted(() => {
  if (!el.value) return
  map = L.map(el.value, { zoomControl: true }).setView(CARACAS, 13)
  // OpenStreetMap raster tiles (online). For true offline-first, swap this for
  // pre-cached tiles (e.g. MapLibre + a self-hosted vector style). See spec gaps.
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)
  markers = L.layerGroup().addTo(map)
  render()
})

watch(() => props.incidents, render, { deep: true })

onBeforeUnmount(() => { map?.remove(); map = null; markers = null })
</script>

<template>
  <div ref="el" class="z-0 h-72 w-full overflow-hidden rounded-2xl ring-1 ring-slate-200" />
</template>
