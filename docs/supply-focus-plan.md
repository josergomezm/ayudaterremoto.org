# Plan: enfoque en suministros (flag + necesidades manuales)

Estado: en progreso · Fecha: 2026-06-30

## Contexto

El primer usuario real lleva un **centro de acopio / cocina**: entran y salen
insumos, ingredientes y comidas hechas. Para ese usuario los módulos de
emergencia (mapa/reportar/personas) y brigadas sobran, y el modelo actual de
"necesidad = ítem de inventario agotado" **no aplica**: que el stock llegue a 0
no significa "lo necesito" (a veces se gastó a propósito), y hay necesidades que
no son inventario ("faltan envases", "voluntarios el sábado").

La app sigue siendo **multi-centro** y los **usuarios comunes deben poder ver y
ayudar** con las necesidades. Este primer usuario es solo el primero.

## Modelo objetivo

Dos audiencias sobre la misma data multi-centro:

| | Coordinador (lleva un centro) | Usuario común (ayuda) |
|---|---|---|
| Home | "Mi zona" (su centro: inventario + movimientos + sus necesidades) | Feed de necesidades de todos los centros |
| Acción | Crea/cierra necesidades, gestiona stock | Ve, "yo me encargo" (tomar), cumple |

Dos ejes **ortogonales**:
1. **Modo de misión** (`supplyOnly`): esconde Emergencias/Brigadas para todos.
2. **Rol**: coordinador vs común (ya existe vía roles + `requiresCoordinator`).

## Fase 1 — feature-flag `supplyOnly` (reversible, sin tocar datos)

- **`app/src/config/features.ts`** (nuevo): flag `supplyOnly` (default `true`),
  derivado de `import.meta.env.VITE_SUPPLY_ONLY` (`=false` restaura la app
  completa). Expone `features.emergencies` y `features.brigades`.
- **`app/src/components/AppShell.vue`**: filtra `navGroups` según `features`
  (oculta el grupo Emergencias y el ítem Brigadas).
- **`app/src/router/index.ts`**: `meta: { module: 'emergencies' | 'brigades' }`
  en esas rutas + guard en `beforeEach` que redirige a `/` si el módulo está
  oculto (las rutas siguen existiendo, fuera del nav).
- **`app/src/vite-env.d.ts`**: tipar `VITE_SUPPLY_ONLY`.

Rollback: `VITE_SUPPLY_ONLY=false` (o borrar el flag). Nada de datos cambia.

## Fase 2 — Necesidad manual, desacoplada del inventario

### Datos
Nueva subcolección `resourceHubs/{hubId}/needs/{needId}` (entidad propia):

```
HubNeed {
  id, hubId,
  title, description?,
  category (reusa InventoryCategory para icono/filtro),
  quantity?, unit?,          // opcional: "200 envases"
  urgency: 'alta'|'media'|'baja',   // MANUAL (no derivada del stock)
  status: 'abierta'|'tomada'|'confirmada',   // reusa el lifecycle actual
  claimedBy?/claimedByName?/claimedAt?/eta?,
  confirmedBy?/confirmedByName?/confirmedAt?/proofUrl?,
  reopenedCount?/reopenedByName?,
  createdBy, createdByName, createdAt, updatedAt
}
```

El **inventario** deja de ser necesidad: sus campos `status/claimedBy/…` quedan
inertes; `urgency` (available/low/depleted) sigue solo como indicador de stock,
no como "necesidad pública". Sin migración pesada (data de arranque): los ítems
con `status` del seed simplemente dejan de aparecer en el feed (pasan a stock).

### Backend (`firebase/functions/src/`)
- **types.ts**: `HubNeed`, `NeedUrgency = 'alta'|'media'|'baja'`.
- **models.ts**: `needCreateSchema`, `needUpdateSchema`.
- **api.ts**:
  - `POST /hubs/:id/needs` (coordinador crea)
  - `PATCH /hubs/:id/needs/:needId` (editar/cerrar) · `DELETE …` (borrar)
  - **repuntar** `POST /needs/:id/claim|confirm|reopen` de
    `collectionGroup("inventory")` → `collectionGroup("needs")` (mismo lifecycle)
  - `GET /hubs` incluye `needs: HubNeed[]` por centro (público: sin emails, con
    `mineClaim`/`mineConfirm`/`staleClaim`), igual que hoy con inventory.
- **seed.ts**: `seedNeedsDemo()` con necesidades standalone (abierta/tomada/
  confirmada × urgencias alta/media/baja).

### Frontend (`app/src/`)
- **stores/hubs.ts**: tipo `HubNeed`, `needs` en `ResourceHub`, métodos
  `createNeed/updateNeed/deleteNeed`; repuntar `claimNeed/confirmNeed/reopenNeed`
  para mutar `hub.needs` (no inventory).
- **pages/NeedsHomePage.vue**: el feed aplana `hub.needs` (no `hub.inventory`);
  filtro por urgencia manual.
- **components/NeedCard.vue**: renderiza `HubNeed` (title/desc/qty/urgencia/estado).
- **pages/HubManagePage.vue**: nueva pestaña "Necesidades" (crear/editar/cerrar).
- **pages/HubDetailPage.vue**: público → necesidades (tomables) + inventario
  (stock, solo lectura).
- **pages/MyActivityPage.vue**: aplana `hub.needs` por `mineClaim/mineConfirm`.
- **i18n**: módulo `needs` (form + card + urgencias) con paridad es/en.

## Orden de trabajo
1. Plan (este doc) ✅
2. Fase 1 (flag) — chico y seguro.
3. Fase 2 backend (types → models → api → seed).
4. Fase 2 frontend (store → pages/components → i18n).
