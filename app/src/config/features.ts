// Modo de misión de la app. `supplyOnly` deja solo la coordinación de
// suministros (centros, inventario, necesidades) y esconde los módulos de
// emergencia (mapa / reportar / personas) y brigadas. Es un flag de PRODUCTO,
// no un secreto: se controla por build con VITE_SUPPLY_ONLY.
//
//   (sin definir)            -> supplyOnly = true   (default del pivote actual)
//   VITE_SUPPLY_ONLY=false    -> app completa (restaura emergencias + brigadas)
//
// Rollback total del enfoque: VITE_SUPPLY_ONLY=false. No cambia ningún dato.

const raw = import.meta.env.VITE_SUPPLY_ONLY
export const supplyOnly = raw === undefined ? true : raw !== 'false'

export const features = {
  supplyOnly,
  // Módulos que el modo suministros esconde. Un solo eje: si supplyOnly, off.
  emergencies: !supplyOnly, // mapa / reportar / personas / incidentes
  brigades: !supplyOnly,
}

/** ¿Está habilitado el módulo (por su tag `module`)? `undefined` = siempre on. */
export function isModuleEnabled(module?: string): boolean {
  if (module === 'emergencies') return features.emergencies
  if (module === 'brigades') return features.brigades
  return true
}
