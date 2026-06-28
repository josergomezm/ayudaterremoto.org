# Refocus implementation brief — Ayuda Terremoto v1

Estás trabajando sobre el codebase existente (Vue 3 + Vite + Pinia + vue-router +
Leaflet + vue-i18n, shell Capacitor, backend Firebase: una sola Cloud Function
`api` + Firestore vía Admin SDK, auth Google). NO reescribas la app. Reutiliza
componentes, stores y endpoints existentes.

**Objetivo:** repivotar de "plataforma de respuesta a crisis" (todo para todos) a
**capa de coordinación de suministros + rendición de cuentas**. La app mueve
**información y constancia, nunca dinero**. El loop central es:
`Necesidad → alguien se encarga → llega → el coordinador confirma`.

---

## Reglas de ejecución (no negociables)

1. **Plan primero.** Antes de escribir código, entrégame: archivos nuevos,
   archivos modificados, código a "desconectar", endpoints nuevos/cambiados,
   migraciones de datos y claves i18n nuevas. **Espera mi OK.**
2. **No borrar, parquear.** Crea la rama `parked/sar-engine` con el estado actual
   de `main` antes de remover nada. En `main` se desconecta del cliente, no se
   destruye lógica de backend sin confirmármelo.
3. **Stack fijo.** Vue 3 + Pinia + vue-router (conservar las View Transitions) +
   Leaflet + vue-i18n. No introduzcas React, Next ni un Tailwind nuevo.
4. **Server sigue siendo la fuente de verdad** para roles (`auth.ts`). El cliente
   solo oculta controles.
5. **Offline-first intacto** (`lib/offline.ts`, cola IndexedDB). Todo texto por
   i18n; no hardcodees español en componentes.

---

## Workstream 0 — Entorno y seguridad de datos (leer antes de tocar nada)

El branch de Git aísla el **código**, no los **datos**. Firestore, la Cloud
Function `api` y Firebase Auth viven en el proyecto Firebase; trabajar en otra
rama NO los aísla. Si corres local apuntando al proyecto real, escribes en la
base de datos de producción aunque estés en otro branch.

Reglas:
1. **Emulador obligatorio en dev.** Todo el trabajo local corre contra el
   **Firebase Emulator Suite** (project id `demo-app`: Functions + Firestore +
   Auth), sin login de Firebase. Producción no se entera de nada que pase ahí.
2. **Guarda anti-producción.** Añade un chequeo en el arranque/bootstrap del
   backend que **falle ruidosamente** si en modo dev/emulador detecta
   credenciales o project id de producción. Es una guarda barata contra el
   accidente clásico de "creí que estaba en local".
3. **Las migraciones son la zona de peligro.** El script de migración de roles
   (`authority/command → organizador`, Workstream 1) se prueba **solo contra el
   emulador** hasta que yo lo apruebe. Debe ser **idempotente** y correrse a mano,
   nunca en automático en un deploy.
4. **Los datos no son branch-revertibles.** `git checkout main` devuelve el
   código, no deshace escrituras hechas en una base real. Por eso el emulador es
   la regla, no la excepción.
5. **Nada de deploy** (`firebase deploy`, hosting, functions) como parte de este
   trabajo. El merge a `main` y el deploy a producción son una decisión mía
   aparte, después de validar todo en local.

---

## Workstream 1 — Roles: renombrar + colapsar (hacer PRIMERO, todo depende de esto)

Hoy: `Civilian(0) / Responder(1) / Authority(2) / Command(3) / Sudo(4)`.
Objetivo: colapsar a **4 ranks**, fusionando Authority+Command:

| Nuevo rol | Rank | Viene de |
|---|---|---|
| Colaborador | 0 | Civilian |
| Coordinador | 1 | Responder |
| Organizador | 2 | Authority **+** Command (fusionados) |
| Fundador | 3 | Sudo |

Cambios técnicos:
- `firebase/functions/src/auth.ts`: reescribir el mapa `RANK`, ajustar
  `hasRole(actor, min)` y `getActor()`. Mantener los dos tiers de almacenamiento:
  Coordinador en `users/{email}`, Organizador+ en `adminUsers/{email}`.
- `api.ts`: actualizar todos los chequeos de min-role a los nombres nuevos.
  Los antiguos `authority` y `command` colapsan ambos a `organizador`.
- Cliente: actualizar gating por rol y **etiquetas i18n** de roles. Eliminar los
  strings "Authority"/"Command" de cara al usuario (cargan semántica estatal).
- **Migración:** documentos en `adminUsers` con rol `authority` o `command` → `organizador`.
  Entrégame un script/seed idempotente, no lo corras en automático.

---

## Workstream 2 — Liberar los hubs → "zonas" del coordinador

Hoy crear un hub (`POST /hubs`) e inventario son `authority+`. Eso encierra la
feature central detrás del tier que ya no existe como institución.

- `POST /hubs` y gestión de inventario: bajar el gate a **Coordinador** dueño de
  su zona (un coordinador vouched posee y administra su propia zona).
  Organizador+ conserva crear zonas y asignar coordinadores.
- En UI, renombrar "hub/relief hub" → **"zona/punto"**. Mantener el modelo de
  datos interno si renombrarlo es caro; el rename obligatorio es el de cara al usuario.
- Conservar: badges de urgencia (depleted/low/available), **stale warning ~2h**,
  WhatsApp del coordinador, QR de la zona.

---

## Workstream 3 — Ciclo de vida de "necesidad" (el verdadero trabajo nuevo)

Reutiliza la infraestructura de inventario existente; un ítem de inventario pasa
a ser una **necesidad** con máquina de estados:

```
abierta ──(claim)──► tomada ──(confirm)──► confirmada
   ▲                   │
   └──────(reopen)─────┘   (reopen también desde confirmada si hace falta)
```

Campos a añadir a la necesidad:
- `status`: `abierta | tomada | confirmada` (`reabierta` se modela como vuelta a `abierta`).
- `claimedBy` (uid + nombre/alias), `claimedAt`.
- `confirmedBy` (uid del coordinador), `confirmedAt`.
- `proofUrl?` (opcional: foto recibo/entrega).
- `reopenedCount` / historial breve para auditoría.
- **NADA de campos de dinero/pago.** La app no procesa transacciones.

Endpoints (nuevos/ajustados, dentro de la Cloud Function `api`):
- `POST /needs/:id/claim` — signed-in (Colaborador+). `abierta → tomada`, setea
  `claimedBy`. **Idempotente:** rechaza si ya está `tomada` (evita duplicados, el "don't buy twice").
- `POST /needs/:id/confirm` — **solo el Coordinador dueño de la zona**.
  `tomada → confirmada`, setea `confirmedBy/At`, `proofUrl?`. El que se encargó
  NO confirma: el coordinador es la única fuente de verdad.
- `POST /needs/:id/reopen` — Coordinador dueño. `tomada|confirmada → abierta`,
  limpia el claim. Para que el tablero nunca mienta sobre lo que falta.
- **Claim vencido (opcional):** una necesidad `tomada` sin confirmar tras N días
  se marca con un flag `staleClaim` que el coordinador ve para decidir reabrir.
  No auto-borrar ni auto-reabrir.
- Auditar cada transición en el audit log append-only existente.

WhatsApp: el campo de contacto/WhatsApp ya existe en el hub. Exponerlo en el
detalle de la necesidad (visible siempre; protagonista cuando `status = tomada`,
como respaldo: el que se encarga pregunta dirección / el coordinador pregunta si
sigue en pie). Sin chat interno ni paso de coordinación obligatorio.

---

## Workstream 4 — Parquear el motor SAR y recortar

Tras crear `parked/sar-engine`, en `main` **desconectar del cliente** (no del
backend sin confirmar):

- Quitar del `router/index.ts` y de la navegación: `/report` (wizard),
  `/people` (desaparecidos / pacientes / building-status), y las acciones SAR de
  incidentes en la UI primaria.
- Dejar de invocar desde el cliente: `lib/triage.ts`, el clustering
  (`resolveClusterId`) y los pases de `ai.ts` (panic check, image triage,
  patient-list matching). Que queden tree-shaken, no referenciados.
- `Announcements` (hoy "Command only") → reducir a un **aviso simple** de
  Organizador, baja prioridad. No megáfono.
- Endpoints de backend correspondientes (`/missing`, `/location-requests`,
  `/patients`, image/panic): **mantener pero desconectados del cliente** salvo que
  yo apruebe removerlos. Son baratos de conservar.

---

## Workstream 5 — Home rediseñado (bundle de Claude Design)

Implementar el handoff de Claude Design del home, **role-aware**, contra los
componentes existentes:
- Vista por defecto = **Colaborador**: lista de necesidades primero, mapa
  (Leaflet) como toggle secundario; franja de confianza pequeña; filtros (zona /
  urgencia / categoría / solo abiertas); tarjeta de necesidad en sus 4 estados
  (abierta → botón "Me encargo"; tomada → sin botón, muestra quién se encargó +
  WhatsApp; confirmada; reabierta).
- Vista **Coordinador**: tarjeta "Mi zona" arriba (frescura, abiertas,
  "N esperando que confirmes llegada", "+ Nueva necesidad") + FAB.
- Bottom tab bar: **Necesidades / Zonas / Mi actividad / Organizar**
  (la pestaña Organizar solo visible para Organizador+).
- Todo el texto por i18n. Conservar transiciones suaves del router actual.

---

## Orden sugerido

0. Entorno + guarda anti-producción (Workstream 0) — antes de cualquier código.
1. Roles (Workstream 1) — todo gatea sobre esto.
2. Zonas liberadas (2).
3. Ciclo de necesidad (3).
4. Parquear SAR (4).
5. Home (5).

Empieza confirmando el entorno (Workstream 0) y entregándome el plan de
Workstream 1 (archivos + migración). Espera mi OK antes de codear.
