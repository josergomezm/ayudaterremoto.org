<script setup lang="ts">
// Registrar un "movimiento" (lote): entrada o salida con razón, multi-ítem.
// Cada línea elige un ítem existente (combobox → suma/resta) o crea uno nuevo.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHubsStore, type InventoryItem, type MovementType, type MovementPayload } from '../stores/hubs'
import { useToast } from '../lib/toast'
import MaterialIcon from './MaterialIcon.vue'

const props = defineProps<{ hubId: string; items: InventoryItem[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const { t } = useI18n()
const hubs = useHubsStore()
const toast = useToast()

const CATEGORIES = ['water', 'food', 'tools', 'medical', 'shelter', 'clothing', 'hygiene', 'other'] as const

const type = ref<MovementType>('entrada')
const reason = ref('')
const note = ref('')
const submitting = ref(false)

interface Line {
  search: string
  itemId: string | null
  name: string
  unit: string
  category: InventoryItem['category']
  quantity: number | null
  open: boolean
}
function blankLine(): Line {
  return { search: '', itemId: null, name: '', unit: '', category: 'food', quantity: null, open: false }
}
const lines = ref<Line[]>([blankLine()])

function matches(line: Line) {
  const q = line.search.trim().toLowerCase()
  const list = q ? props.items.filter((i) => i.name.toLowerCase().includes(q)) : props.items
  return list.slice(0, 8)
}
function exactExisting(line: Line) {
  const q = line.search.trim().toLowerCase()
  return props.items.find((i) => i.name.toLowerCase() === q)
}
function pickExisting(line: Line, item: InventoryItem) {
  line.itemId = item.id
  line.name = item.name
  line.unit = item.unit
  line.category = item.category
  line.search = `${item.name} (${item.unit})`
  line.open = false
}
function makeNew(line: Line) {
  line.itemId = null
  line.name = line.search.trim()
  line.open = false
}
function addLine() { lines.value.push(blankLine()) }
function removeLine(i: number) {
  lines.value.splice(i, 1)
  if (!lines.value.length) lines.value.push(blankLine())
}

async function submit() {
  if (!reason.value.trim()) { toast.error(t('movements.needReason')); return }
  const payloadLines: MovementPayload['lines'] = []
  for (const l of lines.value) {
    const qty = Number(l.quantity)
    if (!qty || qty <= 0) continue
    if (l.itemId) {
      payloadLines.push({ itemId: l.itemId, quantity: qty })
    } else {
      const name = (l.name || l.search).trim()
      if (!name || !l.unit.trim()) continue
      payloadLines.push({ name, category: l.category, unit: l.unit.trim(), quantity: qty })
    }
  }
  if (!payloadLines.length) { toast.error(t('movements.needLines')); return }

  submitting.value = true
  const r = await hubs.addMovement(props.hubId, {
    type: type.value,
    reason: reason.value.trim(),
    note: note.value.trim() || undefined,
    lines: payloadLines,
  })
  submitting.value = false
  if (r.ok) { toast.success(t('movements.saved')); emit('saved'); emit('close') }
  else toast.error((r as { error?: string }).error || t('common.error'))
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" @click.self="emit('close')">
    <div class="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-base font-bold text-slate-900">{{ t('movements.title') }}</h3>
        <button class="text-slate-400 hover:text-slate-700" @click="emit('close')"><MaterialIcon name="close" :size="22" /></button>
      </div>

      <!-- Tipo -->
      <div class="mb-4 flex gap-2">
        <button
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ring-1 transition"
          :class="type === 'entrada' ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-slate-700 ring-slate-300'"
          @click="type = 'entrada'"
        ><MaterialIcon name="arrow_downward" :size="16" /> {{ t('movements.entrada') }}</button>
        <button
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ring-1 transition"
          :class="type === 'salida' ? 'bg-amber-600 text-white ring-amber-600' : 'bg-white text-slate-700 ring-slate-300'"
          @click="type = 'salida'"
        ><MaterialIcon name="arrow_upward" :size="16" /> {{ t('movements.salida') }}</button>
      </div>

      <!-- Razón -->
      <div class="mb-3 space-y-1">
        <label class="text-xs font-semibold text-slate-600">{{ t('movements.reason') }}</label>
        <input
          v-model="reason"
          type="text"
          :placeholder="type === 'entrada' ? t('movements.reasonInPlaceholder') : t('movements.reasonOutPlaceholder')"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </div>

      <!-- Líneas -->
      <label class="text-xs font-semibold text-slate-600">{{ t('hubs.inventory') }}</label>
      <div class="mt-1 mb-3 space-y-2">
        <div v-for="(line, i) in lines" :key="i" class="space-y-2 rounded-xl bg-slate-50/60 p-3 ring-1 ring-slate-200">
          <div class="flex gap-2">
            <div class="relative flex-1">
              <input
                v-model="line.search"
                type="text"
                :placeholder="t('movements.searchItem')"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                @focus="line.open = true"
                @input="line.open = true; line.itemId = null"
              />
              <div v-if="line.open" class="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                <button
                  v-for="it in matches(line)"
                  :key="it.id"
                  type="button"
                  class="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  @click="pickExisting(line, it)"
                >
                  <span class="font-semibold text-slate-800">{{ it.name }}</span>
                  <span class="text-slate-400"> ({{ it.unit }} · {{ it.quantity }})</span>
                </button>
                <button
                  v-if="type === 'entrada' && line.search.trim() && !exactExisting(line)"
                  type="button"
                  class="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                  @click="makeNew(line)"
                >
                  <MaterialIcon name="add" :size="14" /> {{ t('movements.newItem', { name: line.search.trim() }) }}
                </button>
              </div>
            </div>
            <input
              v-model.number="line.quantity"
              type="number"
              min="0"
              step="any"
              :placeholder="t('movements.quantity')"
              class="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            <button class="px-1 text-slate-300 hover:text-red-500" @click="removeLine(i)"><MaterialIcon name="delete" :size="18" /></button>
          </div>

          <!-- Ítem nuevo: categoría + unidad -->
          <div v-if="!line.itemId && line.name" class="flex items-center gap-2">
            <select v-model="line.category" class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              <option v-for="c in CATEGORIES" :key="c" :value="c">{{ t('hubs.categories.' + c) }}</option>
            </select>
            <input v-model="line.unit" type="text" :placeholder="t('hubs.unit')" class="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" />
            <span class="self-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">{{ t('movements.newBadge') }}</span>
          </div>
          <div v-else-if="line.itemId" class="text-[11px] text-slate-500">{{ line.unit }}</div>
        </div>
        <button type="button" class="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-900" @click="addLine">
          <MaterialIcon name="add" :size="16" /> {{ t('movements.addLine') }}
        </button>
      </div>

      <!-- Nota -->
      <div class="mb-4 space-y-1">
        <label class="text-xs font-semibold text-slate-600">{{ t('movements.note') }}</label>
        <input v-model="note" type="text" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900" />
      </div>

      <button class="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-50" :disabled="submitting" @click="submit">
        {{ t('movements.save') }}
      </button>
    </div>
  </div>
</template>
