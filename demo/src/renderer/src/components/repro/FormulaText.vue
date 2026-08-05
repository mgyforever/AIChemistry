<template>
  <span class="formula-text" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import katex from 'katex'
// mhchem 扩展：KaTeX 核心不内置 \ce，必须显式引入注册（否则 \ce{...} 渲染失败并回退为原文）
import 'katex/contrib/mhchem'
import 'katex/dist/katex.min.css'

/**
 * 化学式/公式文本渲染（KaTeX + 内置 mhchem）
 * 1) 识别 $...$ 行内公式与 $$...$$ 块级公式，用 KaTeX 渲染（mhchem 支持 \ce{...}）
 * 2) 无 $ 包裹的"纯化学式"自动转成 \ce{...} 渲染（如 H2SO4 → H₂SO₄）
 * 3) 其余内容按纯文本输出，渲染失败一律兜底为转义纯文本
 */
const props = defineProps<{ content: string }>()

/** 判断是否为纯化学式文本（可安全交给 \ce{} 处理） */
function isPureFormula(s: string): boolean {
  const t = s.trim()
  if (!t || t.length > 80) return false
  // 含中文/空白/普通标点则视为普通文本
  if (/[\u4e00-\u9fa5\s，。、：；！？（）]/.test(t)) return false
  // 仅允许化学式常见字符：字母/数字/加减/括号/点乘/水合物/电荷
  if (!/^[A-Za-z][A-Za-z0-9·.()+\-]*$/.test(t)) return false
  // 至少包含一个字母（排除纯数字/纯符号）
  return /[A-Za-z]/.test(t)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * 规范化裸 \ce：\ce{...} 保留原样；\ceXXX（模型漏写花括号）补成 \ce{XXX}。
 * 例：\ceCH2Cl2 → \ce{CH2Cl2}；\ce{CH2Cl2} 不变。
 */
function normalizeCe(raw: string): string {
  return raw.replace(/\\ce(?!\{)([^\s\\]+)/g, '\\ce{$1}')
}

function renderKatex(code: string, displayMode: boolean): string {
  try {
    return katex.renderToString(normalizeCe(code.trim()), { displayMode, throwOnError: false })
  } catch {
    return `<code>${escapeHtml(code.trim())}</code>`
  }
}

function renderAutoCe(formula: string): string {
  try {
    return katex.renderToString(`\\ce{${formula}}`, { displayMode: false, throwOnError: true })
  } catch {
    return escapeHtml(formula)
  }
}

/** 渲染模型输出的裸 \ce{...}（无 $ 包裹，如 \ce{Cu}、\ce{2H2 + O2 -> 2H2O}） */
function renderBareCe(raw: string): string | null {
  if (!/\\ce/.test(raw)) return null
  try {
    return katex.renderToString(normalizeCe(raw), { displayMode: false, throwOnError: true })
  } catch {
    return escapeHtml(raw)
  }
}

const html = computed(() => {
  const content = props.content ?? ''
  if (!content) return ''
  const trimmed = content.trim()

  // 无 $ 包裹：优先尝试裸 \ce{...}，其次纯化学式自动 \ce
  if (!trimmed.includes('$')) {
    const bare = renderBareCe(trimmed)
    if (bare !== null) return bare
    if (isPureFormula(trimmed)) return renderAutoCe(trimmed)
    return escapeHtml(content)
  }

  // 拆分行内 $...$ 与块级 $$...$$ 段
  const parts = trimmed.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g)
  return parts
    .map((p) => {
      if (!p) return ''
      if (p.startsWith('$$') && p.endsWith('$$')) {
        return renderKatex(p.slice(2, -2), true)
      }
      if (p.startsWith('$') && p.endsWith('$')) {
        return renderKatex(p.slice(1, -1), false)
      }
      return escapeHtml(p)
    })
    .join('')
})
</script>

<style scoped>
.formula-text {
  white-space: normal;
  word-break: break-word;
}
.formula-text :deep(.katex) {
  font-size: 1em;
}
</style>
