<template>
  <div class="markdown-body repro-md" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import katex from 'katex'
// mhchem 扩展：KaTeX 核心不内置 \ce，必须显式引入注册（否则 \ce{...} 渲染失败并回退为原文）
import 'katex/contrib/mhchem'
import 'katex/dist/katex.min.css'

const props = defineProps<{ content: string }>()

marked.setOptions({ breaks: true, gfm: true })

/**
 * 统一 Markdown 渲染（v0.4）
 * marked + KaTeX：$...$ 行内公式、$$...$$ 块级公式，语法错误兜底占位
 */

/** 规范化裸 \ce：\ce{...} 保留原样；\ceXXX（模型漏写花括号）补成 \ce{XXX} */
function normalizeCe(raw: string): string {
  return raw.replace(/\\ce(?!\{)([^\s\\]+)/g, '\\ce{$1}')
}

/** 统一渲染数学公式（先规范化 \ce，再交给 KaTeX） */
function renderMath(code: string, displayMode: boolean): string {
  return katex.renderToString(normalizeCe(code.trim()), { displayMode, throwOnError: false })
}

function render(content: string): string {
  if (!content) return ''
  const blocks: Record<string, string> = {}
  let i = 0
  let src = content

  // 块级公式 $$...$$
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_m, code: string) => {
    const key = `@@MATH${i++}@@`
    try {
      blocks[key] = renderMath(code, true)
    } catch {
      console.warn('[Component] MarkdownRenderer 块级公式解析失败')
      blocks[key] = '<span class="math-error">公式解析失败</span>'
    }
    return key
  })

  // 行内公式 $...$（避免匹配金额/编号）
  src = src.replace(/(^|[^$\w])\$([^$\n]+?)\$(?![$\w])/g, (_m, pre: string, code: string) => {
    const key = `@@MATH${i++}@@`
    try {
      blocks[key] = renderMath(code, false)
    } catch {
      console.warn('[Component] MarkdownRenderer 行内公式解析失败')
      blocks[key] = `<code>${code}</code>`
    }
    return pre + key
  })

  // 裸 \ce{...}（无 $ 包裹，模型常漏写）：同样交给 KaTeX/mhchem 渲染，避免显示成原文 \ceCH2Cl2
  src = src.replace(/\\ce\{[^{}]*\}|\\ce(?!\{)([^\s\\$]+)/g, (m) => {
    const key = `@@MATH${i++}@@`
    try {
      blocks[key] = renderMath(m, false)
    } catch {
      console.warn('[Component] MarkdownRenderer 裸 \\ce 解析失败')
      blocks[key] = `<code>${escapeHtml(m)}</code>`
    }
    return key
  })

  const html = marked.parse(src) as string
  return html.replace(/@@MATH\d+@@/g, (k) => blocks[k] ?? '')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const html = computed(() => render(props.content))
</script>

<style scoped>
.math-error {
  color: var(--color-danger);
  font-style: italic;
  font-size: 12px;
}
.repro-md {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--color-text);
  word-break: break-word;
}
:deep(.markdown-body) {
  background: transparent;
}
</style>
