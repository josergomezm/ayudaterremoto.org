<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as L from 'leaflet'
import type { Incident } from '../stores/incidents'
import type { ResourceHub } from '../stores/hubs'

const props = defineProps<{ 
  incidents: Incident[]
  hubs?: ResourceHub[]
}>()
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

  if (props.hubs) {
    for (const h of props.hubs) {
      const marker = L.circleMarker([h.lat, h.lng], {
        radius: 10,
        weight: 3,
        color: '#ffffff',
        fillColor: h.status === 'active' ? '#6366f1' : '#94a3b8',
        fillOpacity: 0.95,
      })
      marker.bindPopup(`
        <div class="p-1 font-sans text-slate-800">
          <h3 class="text-sm font-bold text-slate-900">${h.name}</h3>
          <p class="text-xs text-slate-500 my-1">${h.address}</p>
          <div class="mt-2 text-xs font-semibold text-indigo-600">
            <a href="/hubs/${h.id}" class="hover:underline">Ver detalles del centro</a>
          </div>
        </div>
      `)
      marker.addTo(markers)
      pts.push([h.lat, h.lng])
    }
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
