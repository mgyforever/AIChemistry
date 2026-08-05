<template>
  <div class="chem-input">
    <textarea
      :value="modelValue"
      rows="3"
      class="ci-textarea"
      placeholder="输入内容，支持化学符号（见下方面板）与 $...$ 公式…"
      @input="onInput"
    />
    <div class="ci-toolbar">
      <button type="button" class="ci-btn" title="公式美化（H2O→H₂O）" @click="beautify">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        <span>美化公式</span>
      </button>
      <div class="ci-cats">
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          class="ci-cat"
          :class="{ active: cat.key === activeCat }"
          @click="activeCat = cat.key"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>
    <div v-if="activePanel" class="ci-symbols">
      <button
        v-for="s in currentSymbols"
        :key="s"
        type="button"
        class="ci-sym"
        :title="s"
        @click="insert(s)"
      >
        {{ s }}
      </button>
      <button
        v-if="activeCat === 'sub'"
        type="button"
        class="ci-sym ci-sym-action"
        @click="wrapSelection('subscript')"
      >
        转为下标
      </button>
      <button
        v-else-if="activeCat === 'sup'"
        type="button"
        class="ci-sym ci-sym-action"
        @click="wrapSelection('superscript')"
      >
        转为上标
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const activeCat = ref('sub')
const activePanel = ref(false)

onMounted(() => {
  console.log('[Component] ChemistryInput 挂载')
})

/* 化学符号数据（Unicode 上下标） */
const SUB = '₀₁₂₃₄₅₆₇₈₉₊₋'.split('')
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻'.split('')

const categories = [
  { key: 'sub', label: '下标' },
  { key: 'sup', label: '上标' },
  { key: 'greek', label: '希腊字母' },
  { key: 'arrow', label: '化学箭头' },
  { key: 'unit', label: '单位' },
  { key: 'ion', label: '离子/基团' },
  { key: 'state', label: '状态' }
]

const SYMBOLS: Record<string, string[]> = {
  sub: SUB,
  sup: SUP,
  greek: ['α', 'β', 'γ', 'δ', 'Δ', 'ε', 'θ', 'λ', 'μ', 'π', 'σ', 'φ', 'χ', 'ψ', 'ω', 'Ω'],
  arrow: ['→', '⇌', '↽⇀', '↺', '↑', '↓', '△(加热)', '⊕', '⊖'],
  unit: ['°C', '°F', 'mL', 'L', 'μL', 'mol', 'g', 'kg', 'ppm', 'Å', 'nm', 'μm', '%', 'w/w', 'v/v'],
  ion: [
    'H⁺', 'Na⁺', 'K⁺', 'Ca²⁺', 'Mg²⁺', 'Fe²⁺', 'Fe³⁺', 'Cu²⁺', 'Al³⁺', 'NH₄⁺',
    'OH⁻', 'Cl⁻', 'SO₄²⁻', 'CO₃²⁻', 'NO₃⁻', 'PO₄³⁻', 'CH₃', 'C₂H₅', 'Ph', 'Me', 'Et', 'Ac'
  ],
  state: ['(s)', '(l)', '(g)', '(aq)', '↓(沉淀)', '↑(气体)']
}

const currentSymbols = computed(() => SYMBOLS[activeCat.value] ?? [])

function onInput(e: Event): void {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}

function getSelection(): { start: number; end: number; text: string } {
  const el = textareaRef.value
  if (!el) return { start: 0, end: 0, text: '' }
  return { start: el.selectionStart, end: el.selectionEnd, text: props.modelValue.slice(el.selectionStart, el.selectionEnd) }
}

function replaceRange(start: number, end: number, value: string): void {
  const next = props.modelValue.slice(0, start) + value + props.modelValue.slice(end)
  emit('update:modelValue', next)
}

function insert(symbol: string): void {
  const { start, end } = getSelection()
  replaceRange(start, end, symbol)
  requestAnimationFrame(() => {
    const el = textareaRef.value
    if (el) {
      el.focus()
      const pos = start + symbol.length
      el.setSelectionRange(pos, pos)
    }
  })
}

/** 选中文本转 Unicode 下标/上标 */
function wrapSelection(kind: 'subscript' | 'superscript'): void {
  const { start, end, text } = getSelection()
  if (!text) return
  const map = kind === 'subscript' ? subMap() : supMap()
  let out = ''
  for (const ch of text) out += map[ch] ?? ch
  replaceRange(start, end, out)
}

function subMap(): Record<string, string> {
  const map: Record<string, string> = {}
  '0123456789+-'.split('').forEach((c, i) => (map[c] = SUB[i]))
  return map
}
function supMap(): Record<string, string> {
  const map: Record<string, string> = {}
  '0123456789+-'.split('').forEach((c, i) => (map[c] = SUP[i]))
  return map
}

/** 公式美化：H2O → H₂O、Fe3+ → Fe³⁺（元素符号后数字转下标，电荷转上标） */
function beautify(): void {
  const elements = new Set(
    ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl',
      'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Br', 'Ag', 'I',
      'Ba', 'Pt', 'Au', 'Hg', 'Pb', 'Sn', 'Sb', 'As', 'Se', 'Kr', 'Xe']
  )
  const sub = subMap()
  const sup = supMap()
  let src = props.modelValue
  // 电荷：数字紧跟 + / - 或 空格+数字+2- → 上标
  src = src.replace(/(\d)\s*([+-])(?![0-9])/g, (_m, d: string, s: string) => {
    const conv = (sub[d] ?? d) + (s === '+' ? '⁺' : '⁻')
    return `[${conv}]`
  })
  src = src.replace(/([+-])(\d)(?![0-9])/g, (_m, s: string, d: string) => `${s === '+' ? '⁺' : '⁻'}${sup[d] ?? d}`)
  src = src.replace(/\[(.+?)\]/g, '$1')
  // 元素符号后数字 → 下标
  src = src.replace(
    /([A-Z][a-z]?)(\d+)/g,
    (_m, el: string, d: string) => (elements.has(el) ? el + d.split('').map((c) => sub[c] ?? c).join('') : _m)
  )
  console.log('[Component] ChemistryInput 公式美化完成, 长度:', props.modelValue.length, '→', src.length)
  emit('update:modelValue', src)
}

defineExpose({ beautify })
</script>

<style scoped>
.chem-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ci-textarea {
  width: 100%;
  resize: vertical;
  min-height: 64px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.6;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.ci-textarea:focus {
  border-color: var(--color-primary-light);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}
.ci-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ci-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-alt);
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}
.ci-btn:hover {
  border-color: var(--color-primary-light);
}
.ci-cats {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}
.ci-cat {
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.ci-cat:hover {
  color: var(--color-text);
}
.ci-cat.active {
  color: var(--color-accent-ink);
  border-color: var(--color-border);
  background: var(--color-surface-alt);
}
.ci-symbols {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}
.ci-sym {
  min-width: 30px;
  padding: 4px 7px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-family: 'Segoe UI Symbol', 'Times New Roman', serif;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.ci-sym:hover {
  background: var(--color-primary);
  color: #fff;
}
.ci-sym-action {
  color: var(--color-accent-ink);
  border-color: var(--color-border);
  font-size: 12px;
}
</style>
