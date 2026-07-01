/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  // Modo de misión: "false" restaura la app completa (emergencias + brigadas).
  // Sin definir o cualquier otro valor => supplyOnly (solo suministros).
  readonly VITE_SUPPLY_ONLY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
