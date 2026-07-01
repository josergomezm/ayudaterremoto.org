<script setup lang="ts">
// Registrar un "movimiento" (lote): entrada o salida con razón, multi-ítem,
// con preview de saldo resultante. Rediseño "Centro Detalle" de Claude Design.
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHubsStore, type InventoryItem, type MovementType, type MovementPayload } from '../stores/hubs'
import { useToast } from '../lib/toast'
import MaterialIcon from './MaterialIcon.vue'

const props = defineProps<{ hubId: string; items: InventoryItem[]; preselect?: InventoryItem | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const { t, tm } = useI18n()
const hubs = useHubsStore()
const toast = useToast()

const CATEGORIES = ['water', 'food', 'tools', 'medical', 'shelter', 'clothing', 'hygiene', 'other'] as const

const type = ref<MovementType>('entrada')
const reason = ref('')
const note = ref('')
const submitting = ref(false)

const reasonChips = computed<string[]>(() =>
  (type.value === 'entrada' ? tm('movements.reasonChipsIn') : tm('movements.reasonChipsOut')) as string[],
)

interface Line {
  search: string
  itemId: string | null
  name: string
  unit: string
  category: InventoryItem['category']
  currentQty: number
  quantity: number | null
  open: boolean
}
function blankLine(): Line {
  return { search: '', itemId: null, name: '', unit: '', category: 'food', currentQty: 0, quantity: null, open: false }
}
const lines = ref<Line[]>([blankLine()])

onMounted(() => {
  if (props.preselect) pickExisting(lines.value[0], props.preselect)
})

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
  line.currentQty = item.quantity
  line.search = `${item.name} (${item.unit})`
  line.open = false
}
function makeNew(line: Line) {
  line.itemId = null
  line.name = line.search.trim()
  line.currentQty = 0
  line.open = false
}
function addLine() { lines.value.push(blankLine()) }
function removeLine(i: number) {
  lines.value.splice(i, 1)
  if (!lines.value.length) lines.value.push(blankLine())
}

const sign = computed(() => (type.value === 'entrada' ? 1 : -1))
function resulting(line: Line) {
  const q = Number(line.quantity) || 0
  return Math.max(0, line.currentQty + sign.value * q)
}
function fmt(n: number) { return (Math.round(n * 100) / 100).toString() }

const validCount = computed(() => lines.value.filter((l) => Number(l.quantity) > 0 && (l.itemId || (l.name || l.search).trim())).length)

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
  <div class="mv-overlay" @click.self="emit('close')">
    <div class="mv-card supply-theme">
      <div class="mv-head">
        <h3>{{ t('movements.title') }}</h3>
        <button class="mv-x" @click="emit('close')"><MaterialIcon name="close" :size="22" /></button>
      </div>

      <div class="mv-body">
        <!-- Segmented entrada/salida -->
        <div class="seg">
          <button class="seg-btn" :class="{ 'seg-on seg-in': type === 'entrada' }" @click="type = 'entrada'">
            <MaterialIcon name="south" :size="20" /> {{ t('movements.entrada') }}
          </button>
          <button class="seg-btn" :class="{ 'seg-on seg-out': type === 'salida' }" @click="type = 'salida'">
            <MaterialIcon name="north" :size="20" /> {{ t('movements.salida') }}
          </button>
        </div>
        <div class="hint" :class="type === 'entrada' ? 'hint-in' : 'hint-out'">
          <MaterialIcon name="info" :size="16" /> {{ type === 'entrada' ? t('movements.hintIn') : t('movements.hintOut') }}
        </div>

        <!-- Razón -->
        <div class="field-label">{{ t('movements.reason') }}</div>
        <div class="chips">
          <button v-for="c in reasonChips" :key="c" class="rchip" :class="{ 'rchip-on': reason === c }" @click="reason = c">{{ c }}</button>
        </div>
        <input
          v-model="reason"
          class="inp"
          :placeholder="type === 'entrada' ? t('movements.reasonInPlaceholder') : t('movements.reasonOutPlaceholder')"
        />

        <!-- Inventario afectado -->
        <div class="field-label" style="margin-top:16px;">{{ t('movements.affected') }}</div>
        <div class="lines">
          <div v-for="(line, i) in lines" :key="i" class="line">
            <div class="line-row">
              <div class="combo">
                <input
                  v-model="line.search"
                  class="inp inp-sm"
                  :placeholder="t('movements.searchItem')"
                  @focus="line.open = true"
                  @input="line.open = true; line.itemId = null; line.currentQty = 0"
                />
                <div v-if="line.open" class="dropdown">
                  <button v-for="it in matches(line)" :key="it.id" type="button" class="dd-item" @click="pickExisting(line, it)">
                    <b>{{ it.name }}</b> <span class="muted">({{ it.unit }} · {{ it.quantity }})</span>
                  </button>
                  <button
                    v-if="type === 'entrada' && line.search.trim() && !exactExisting(line)"
                    type="button" class="dd-new" @click="makeNew(line)"
                  ><MaterialIcon name="add" :size="14" /> {{ t('movements.newItem', { name: line.search.trim() }) }}</button>
                </div>
              </div>
              <div class="qty">
                <input v-model.number="line.quantity" type="number" min="0" step="any" :placeholder="t('movements.quantity')" />
                <span v-if="line.unit" class="qty-unit">{{ line.unit }}</span>
              </div>
              <button class="line-del" @click="removeLine(i)"><MaterialIcon name="delete" :size="20" /></button>
            </div>

            <!-- Campos de ítem nuevo -->
            <div v-if="!line.itemId && line.name" class="new-fields">
              <select v-model="line.category">
                <option v-for="c in CATEGORIES" :key="c" :value="c">{{ t('hubs.categories.' + c) }}</option>
              </select>
              <input v-model="line.unit" :placeholder="t('hubs.unit')" />
              <span class="new-badge">{{ t('movements.newBadge') }}</span>
            </div>

            <!-- Preview de saldo -->
            <div v-if="(line.itemId || line.name) && Number(line.quantity) > 0" class="preview" :class="type === 'entrada' ? 'preview-in' : 'preview-out'">
              <span>{{ t('movements.current') }} <b>{{ fmt(line.currentQty) }} {{ line.unit }}</b></span>
              <MaterialIcon name="arrow_forward" :size="16" />
              <span class="preview-res">{{ t('movements.remaining') }} {{ fmt(resulting(line)) }} {{ line.unit }}</span>
            </div>
          </div>
          <button type="button" class="add-line" @click="addLine"><MaterialIcon name="add_circle" :size="20" /> {{ t('movements.addLine') }}</button>
        </div>

        <!-- Nota -->
        <div class="field-label" style="margin-top:14px;">{{ t('movements.note') }}</div>
        <input v-model="note" class="inp" />
      </div>

      <!-- Footer -->
      <div class="mv-foot">
        <div class="foot-sum">
          <span>{{ t('movements.footerItems', { n: validCount, type: type === 'entrada' ? t('movements.entrada') : t('movements.salida') }) }}</span>
        </div>
        <button class="save" :class="type === 'entrada' ? 'save-in' : 'save-out'" :disabled="submitting" @click="submit">
          <MaterialIcon name="check" :size="21" /> {{ t('movements.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mv-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; background: rgba(0,0,0,.4); }
@media (min-width: 640px) { .mv-overlay { align-items: center; padding: 16px; } }
.mv-card {
  --primary:#2350C9;--primary-d:#1B3FA3;--primary-bg:#EEF2FB;--card:#fff;--line:#E7E2D9;--ink:#211F1B;--ink2:#6F685C;--ink3:#938B7D;
  --green-c:#15794B;--green-bg:#E9F6EE;--amber-c:#9A5808;--amber-bg:#FBF1DF;--red-c:#B42318;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: var(--ink);
  width: 100%; max-height: 92vh; overflow-y: auto; background: var(--card);
  border-radius: 26px 26px 0 0; box-shadow: 0 -10px 30px -8px rgba(0,0,0,.4);
}
@media (min-width: 640px) { .mv-card { max-width: 480px; border-radius: 20px; box-shadow: 0 24px 50px -24px rgba(30,26,20,.45); } }
.mv-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 22px 0; }
.mv-head h3 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -.01em; }
.mv-x { border: none; background: none; color: var(--ink3); cursor: pointer; }
.mv-body { padding: 0 22px; }

.seg { display: flex; gap: 4px; margin-top: 16px; padding: 4px; background: #EFEBE3; border-radius: 14px; }
.seg-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px; height: 46px; border: none; border-radius: 11px; background: transparent; font-size: 15px; font-weight: 700; color: var(--ink2); cursor: pointer; }
.seg-on { font-weight: 800; color: #fff; }
.seg-in { background: var(--green-c); box-shadow: 0 1px 3px rgba(21,121,75,.4); }
.seg-out { background: var(--amber-c); box-shadow: 0 1px 3px rgba(154,88,8,.4); }
.hint { display: flex; align-items: center; gap: 7px; margin-top: 9px; font-size: 12.5px; font-weight: 600; }
.hint-in { color: var(--green-c); } .hint-out { color: var(--amber-c); }

.field-label { font-size: 13px; font-weight: 800; margin: 18px 0 9px; }
.chips { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 10px; }
.rchip { padding: 7px 12px; border: 1px solid var(--line); background: #fff; border-radius: 999px; font-size: 12.5px; font-weight: 700; color: var(--ink2); cursor: pointer; }
.rchip-on { border: 1.5px solid var(--primary); background: var(--primary-bg); color: var(--primary); font-weight: 800; }
.inp { width: 100%; height: 46px; padding: 0 14px; background: #F7F5F1; border: 1px solid var(--line); border-radius: 12px; font: inherit; font-size: 14px; font-weight: 600; color: var(--ink); outline: none; }
.inp::placeholder { color: var(--ink3); font-weight: 500; }

.lines { display: flex; flex-direction: column; gap: 10px; }
.line { border: 1px solid var(--line); border-radius: 14px; padding: 13px; background: #FCFBF9; }
.line-row { display: flex; gap: 9px; align-items: center; }
.combo { position: relative; flex: 1; min-width: 0; }
.inp-sm { height: 44px; background: #fff; font-weight: 700; }
.dropdown { position: absolute; z-index: 10; margin-top: 4px; width: 100%; max-height: 12rem; overflow-y: auto; background: #fff; border: 1px solid var(--line); border-radius: 11px; box-shadow: 0 8px 20px rgba(0,0,0,.12); }
.dd-item, .dd-new { display: block; width: 100%; text-align: left; padding: 9px 12px; border: none; background: none; font: inherit; font-size: 14px; cursor: pointer; }
.dd-item:hover { background: #F6F4EF; }
.dd-new { color: var(--primary); font-weight: 800; border-top: 1px solid var(--line); }
.dd-new:hover { background: var(--primary-bg); }
.muted { color: var(--ink3); }
.qty { display: flex; align-items: center; width: 100px; height: 44px; padding: 0 12px; background: #fff; border: 1.5px solid var(--line); border-radius: 11px; }
.qty input { width: 100%; border: none; outline: none; font: inherit; font-size: 15px; font-weight: 800; background: transparent; }
.qty-unit { font-size: 12px; font-weight: 600; color: var(--ink3); margin-left: auto; }
.line-del { border: none; background: none; color: var(--ink3); cursor: pointer; flex: none; }
.new-fields { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.new-fields select, .new-fields input { height: 38px; border: 1px solid var(--line); border-radius: 10px; padding: 0 10px; font: inherit; font-size: 12.5px; background: #fff; }
.new-fields input { flex: 1; }
.new-badge { font-size: 10px; font-weight: 800; color: var(--primary); background: var(--primary-bg); padding: 3px 7px; border-radius: 6px; }
.preview { display: flex; align-items: center; gap: 8px; margin-top: 11px; padding: 9px 11px; border-radius: 10px; font-size: 12.5px; font-weight: 600; color: var(--ink2); }
.preview-in { background: var(--green-bg); } .preview-out { background: var(--amber-bg); }
.preview-res { font-weight: 800; }
.preview-in .preview-res, .preview-in :deep(.material-symbols-outlined) { color: var(--green-c); }
.preview-out .preview-res, .preview-out :deep(.material-symbols-outlined) { color: var(--amber-c); }
.add-line { display: flex; align-items: center; gap: 7px; padding: 9px 4px; border: none; background: none; font: inherit; font-size: 13.5px; font-weight: 800; color: var(--primary); cursor: pointer; }

.mv-foot { margin-top: 18px; padding: 14px 22px 24px; border-top: 1px solid var(--line); background: #FCFBF9; }
.foot-sum { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 13px; font-weight: 600; color: var(--ink2); }
.save { width: 100%; height: 54px; border: none; border-radius: 14px; color: #fff; font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
.save-in { background: var(--green-c); } .save-out { background: var(--amber-c); }
.save:disabled { opacity: .5; }
</style>
