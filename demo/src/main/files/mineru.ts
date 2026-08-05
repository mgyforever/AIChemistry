import { readFileSync, existsSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'fs'
import { basename, extname, join } from 'path'
import { app } from 'electron'
import AdmZip from 'adm-zip'

/**
 * MinerU 精准解析客户端（v0.8，见实施计划 §6）
 *
 * API 文档：https://mineru.net/apiManage/docs
 * 流程：上传文件（/api/v4/file-urls/batch）→ 创建任务（/api/v4/extract/task）
 *       → 轮询任务状态 → 下载 content_list.json（含全部文本/表格/图片块，免 zip 解压）
 *
 * 未配置 MINERU_API_KEY 时返回 null，由 pdfjs+OCR 本地管线兜底。
 *
 * v3 问题⑦⑨：返回完整 markdown（md）供 papers_md 落盘；图片块供紧接的图表解析。
 */

const MINERU_BASE = 'https://mineru.net'

export interface MineruParseResult {
  /** 重建的正文全文（Markdown 风格文本，来自 content_list 的 text/md 块） */
  text: string
  /** 完整 markdown（v3 问题⑨：各块 md 拼接，用于 papers_md 落盘） */
  md: string
  /** 表格（content_list 中 table 块的二维数组） */
  tables: unknown[][][]
  /** 图片（从结果 zip 内直接提取的 dataURL + 说明，供紧接的图表解析） */
  images: Array<{ path: string; caption: string }>
}

function getApiKey(): string {
  return process.env.MINERU_API_KEY || ''
}

/** MinerU 响应信封（业务错误也返回 HTTP 200，以 code != 0 标识） */
interface MineruEnvelope<T> {
  code: number
  msg?: string
  data?: T
}

async function request<T>(path: string, init?: RequestInit): Promise<MineruEnvelope<T>> {
  const res = await fetch(`${MINERU_BASE}${path}`, init)
  if (!res.ok) {
    throw new Error(`MinerU 请求失败: ${res.status} ${await res.text().catch(() => '')}`)
  }
  const json = (await res.json()) as MineruEnvelope<T>
  if (typeof json.code === 'number' && json.code !== 0) {
    throw new Error(`MinerU 接口错误 ${path}: code=${json.code} msg=${json.msg ?? ''}`)
  }
  return json
}

/**
 * 解析 PDF（走 MinerU 精准解析）。未配置 Key 或解析失败返回 null。
 */
export async function parsePdfWithMineru(filePath: string): Promise<MineruParseResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.log('[MinerU] 未配置 MINERU_API_KEY，走本地 pdfjs 管线兜底')
    return null
  }
  if (!existsSync(filePath) || extname(filePath).toLowerCase() !== '.pdf') {
    return null
  }
  console.log('[MinerU] 开始精准解析:', filePath)
  try {
    // 1. 申请批量上传链接（v4：本地文件必须走 file-urls/batch，上传后系统自动提交解析任务）
    const buf = readFileSync(filePath)
    const batch = await request<{ batch_id: string; file_urls?: string[]; batch_errors?: unknown[] }>(
      '/api/v4/file-urls/batch',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ name: basename(filePath) }],
          enable_formula: true,
          enable_table: true
        })
      }
    )
    const batchId = batch.data?.batch_id
    const uploadUrl = batch.data?.file_urls?.[0]
    if (!batchId) throw new Error('MinerU 上传未返回 batch_id')
    if (!uploadUrl) throw new Error('MinerU 上传未返回文件上传 URL')

    // 2. 将文件字节 PUT 到签名上传 URL（v4 要求：不设置 Content-Type）
    const putRes = await fetch(uploadUrl, { method: 'PUT', body: buf })
    if (!putRes.ok) {
      throw new Error(`MinerU 文件上传失败: ${putRes.status} ${await putRes.text().catch(() => '')}`)
    }
    console.log('[MinerU] 文件上传完成, batch_id:', batchId)

    // 3. 上传完成后系统自动提交解析任务，轮询批量结果（最长 300s）
    let fullZipUrl = ''
    let failMsg = ''
    const startedAt = Date.now()
    while (Date.now() - startedAt < 300_000) {
      const res = await request<{
        batch_id?: string
        extract_result?: Array<{
          file_name?: string
          state?: string
          full_zip_url?: string
          err_msg?: string
        }>
      }>(`/api/v4/extract-results/batch/${batchId}`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      const list = res.data?.extract_result ?? []
      const entry = list.find((r) => !r.file_name || r.file_name === basename(filePath)) ?? list[0]
      const state = entry?.state ?? ''
      failMsg = entry?.err_msg ?? ''
      if (state === 'done' && entry?.full_zip_url) {
        fullZipUrl = entry.full_zip_url
        break
      }
      if (state === 'failed') throw new Error(`MinerU 解析失败: ${failMsg || '未知错误'}`)
      await new Promise((r) => setTimeout(r, 4000))
    }
    if (!fullZipUrl) throw new Error(`MinerU 解析超时: ${failMsg || '最终状态未知'}`)

    // 4. 下载结果 zip（内含 full.md + *_content_list.json + images）
    const zipRes = await fetch(fullZipUrl)
    if (!zipRes.ok) throw new Error(`MinerU 结果下载失败: ${zipRes.status}`)
    const zip = new AdmZip(Buffer.from(await zipRes.arrayBuffer()))
    const entries = zip.getEntries()

    // 5. 提取 full.md（v3 问题⑨：真实 markdown，直接落盘 papers_md）
    const mdEntry = entries.find((e) => e.entryName.toLowerCase().endsWith('full.md'))
    const md = mdEntry ? mdEntry.getData().toString('utf-8') : ''

    // 6. 解析 content_list.json：结构化表格 + 图片块（供紧接的图表解析）
    const textParts: string[] = []
    const tables: unknown[][][] = []
    const images: MineruParseResult['images'] = []
    const clEntry = entries.find((e) => e.entryName.toLowerCase().endsWith('_content_list.json'))
    if (clEntry) {
      let blocks: Array<{
        type?: string
        text?: string
        md?: string
        img_path?: string
        table_body?: unknown
        page_idx?: number
      }> = []
      try {
        blocks = JSON.parse(clEntry.getData().toString('utf-8')) as typeof blocks
      } catch (err) {
        console.warn('[MinerU] content_list.json 解析失败:', err)
      }
      // 图片：直接从 zip 内 images/ 目录读取字节转 dataURL（免二次下载）
      const extMime: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp'
      }
      const imageMap = new Map<string, string>()
      for (const e of entries) {
        if (imageMap.size >= 12) break
        const name = e.entryName.split('/').pop() ?? ''
        const mime = extMime[extname(name).toLowerCase()]
        if (!mime) continue
        const data = e.getData()
        if (data.byteLength > 5 * 1024 * 1024) continue
        imageMap.set(name, `data:${mime};base64,${data.toString('base64')}`)
      }
      for (const b of blocks) {
        const type = b.type ?? ''
        const blockText = b.md || b.text || ''
        if (type === 'table' && b.table_body) {
          tables.push(b.table_body as unknown[][])
          if (blockText) textParts.push(blockText)
        } else if (type === 'image' || type === 'figure') {
          const fileName = (b.img_path ?? '').split('/').pop() ?? ''
          images.push({ path: imageMap.get(fileName) ?? '', caption: blockText })
        } else if (blockText) {
          textParts.push(blockText)
        }
      }
    }
    const text = md || textParts.join('\n\n').trim()
    console.log('[MinerU] 解析完成:', {
      textLen: text.length,
      mdLen: md.length,
      tableCount: tables.length,
      imageCount: images.length
    })
    return { text, md, tables, images }
  } catch (err) {
    console.error('[MinerU] 解析失败，走本地兜底:', err)
    return null
  }
}

/** papers_md 目录（v3 问题⑨） */
export function papersMdDir(): string {
  return app.isPackaged
    ? join(app.getPath('userData'), 'papers_md')
    : join(process.cwd(), 'src/main/database/data/papers_md')
}

/** 将 MinerU 解析出的文献 markdown 落盘到 papers_md，返回文件路径（失败返回 null） */
export function saveMineruMd(documentId: number, title: string, md: string): string | null {
  try {
    const dir = papersMdDir()
    mkdirSync(dir, { recursive: true })
    const safeTitle = (title || 'document').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
    const filePath = join(dir, `${documentId}-${safeTitle}.md`)
    writeFileSync(filePath, md, 'utf-8')
    console.log('[MinerU] 文献 markdown 已保存:', filePath)
    return filePath
  } catch (err) {
    console.error('[MinerU] papers_md 落盘失败:', err)
    return null
  }
}

/** 删除某篇文献的 markdown 文件（删除文档/项目时调用） */
export function cleanupMineruMd(mdPath: string | null | undefined): void {
  if (!mdPath) return
  try {
    if (existsSync(mdPath)) rmSync(mdPath, { force: true })
  } catch (err) {
    console.error('[MinerU] papers_md 清理失败:', mdPath, err)
  }
}

/**
 * 附件/媒体托管（v0.10 D10 已定）：
 * 将用户选择的图片/视频复制到应用数据目录 appData/repro-media/{projectId}/…，
 * 返回可持久化的本地路径数组。删除项目时由 deleteProject 清理目录。
 */
export function importMediaToAppData(
  projectId: number,
  sourcePaths: string[]
): string[] {
  const mediaRoot = app.isPackaged
    ? join(app.getPath('userData'), 'repro-media', String(projectId))
    : join(process.cwd(), 'src/main/database/data/repro-media', String(projectId))
  mkdirSync(mediaRoot, { recursive: true })
  const saved: string[] = []
  for (const src of sourcePaths) {
    if (!existsSync(src)) continue
    const dest = join(mediaRoot, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${basename(src)}`)
    try {
      copyFileSync(src, dest)
      saved.push(dest)
    } catch (err) {
      console.error('[Files] 媒体复制失败:', src, err)
    }
  }
  return saved
}

/** 清理某项目的媒体目录（删除项目时调用） */
export function cleanupProjectMedia(projectId: number): void {
  const mediaRoot = app.isPackaged
    ? join(app.getPath('userData'), 'repro-media', String(projectId))
    : join(process.cwd(), 'src/main/database/data/repro-media', String(projectId))
  try {
    rmSync(mediaRoot, { recursive: true, force: true })
    console.log('[Files] 已清理项目媒体目录:', mediaRoot)
  } catch (err) {
    console.error('[Files] 清理媒体目录失败:', mediaRoot, err)
  }
}
