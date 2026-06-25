import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { registerNative, applyDeviceLocale } from './lib/native'
import 'material-symbols/outlined.css' // self-hosted icon font (works offline)
import 'leaflet/dist/leaflet.css'
import './assets/css/main.css'
import './assets/css/transitions.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)

registerNative(router) // Android back button (no-op in the browser)
void applyDeviceLocale() // follow the device system language on native (non-blocking)

app.mount('#app')
