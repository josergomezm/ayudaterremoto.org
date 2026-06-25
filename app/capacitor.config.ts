import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'org.ayudaterremoto.app',   // reverse-DNS bundle id (REPLACE_ME if forking)
  appName: 'Ayuda Terremoto',
  webDir: 'dist',
  // Uncomment during development to live-reload inside the native shell:
  // server: { url: 'http://192.168.1.XX:5173', cleartext: true },
}

export default config
