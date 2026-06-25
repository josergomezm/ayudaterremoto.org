<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import * as L from 'leaflet'

const props = defineProps<{
  lat: number | null
  lng: number | null
}>()

const emit = defineEmits<{
  (e: 'update:location', val: { lat: number; lng: number }): void
}>()

const el = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let marker: L.Marker | null = null

const CARACAS: L.LatLngTuple = [10.5, -66.91]

function initMap() {
  if (!el.value) return
  
  const initialCenter = props.lat !== null && props.lng !== null 
    ? [props.lat, props.lng] as L.LatLngTuple
    : CARACAS
    
  map = L.map(el.value, { zoomControl: true }).setView(initialCenter, 13)
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  // Add click handler to map to place/move marker
  map.on('click', (e: L.LeafletMouseEvent) => {
    setMarker(e.latlng.lat, e.latlng.lng)
    emit('update:location', { lat: e.latlng.lat, lng: e.latlng.lng })
  })

  // If initial props are valid, render the marker
  if (props.lat !== null && props.lng !== null) {
    setMarker(props.lat, props.lng)
  }
}

function setMarker(lat: number, lng: number) {
  if (!map) return
  
  if (marker) {
    marker.setLatLng([lat, lng])
  } else {
    marker = L.marker([lat, lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'custom-pin-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-red-400 opacity-75"></span>
            <span class="relative inline-flex h-4 w-4 rounded-full bg-red-500 border-2 border-white shadow-md"></span>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    })
    
    marker.on('dragend', () => {
      if (marker) {
        const latlng = marker.getLatLng()
        emit('update:location', { lat: latlng.lat, lng: latlng.lng })
      }
    })
    
    marker.addTo(map)
  }
  
  map.panTo([lat, lng])
}

// Watch props to update marker position when location is set externally
watch(() => [props.lat, props.lng], ([newLat, newLng]) => {
  if (newLat !== null && newLng !== null) {
    setMarker(newLat, newLng)
  } else {
    if (marker && map) {
      map.removeLayer(marker)
      marker = null
    }
  }
})

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  marker = null
})
</script>

<template>
  <div ref="el" class="z-0 h-64 w-full overflow-hidden rounded-2xl ring-1 ring-slate-200" />
</template>
