/**
 * 文本向量化（P5，决策点 D1：本地模型）
 *
 * 主方案：@huggingface/transformers + Xenova/all-MiniLM-L6-v2（384 维，首次调用时下载模型）
 * 降级方案：模型不可用时使用哈希 embedding（同 384 维，保证 LanceDB 表结构一致可用）
 */
import { pipeline, env } from '@huggingface/transformers'

// 国内网络直连 huggingface.co 超时，统一走 hf-mirror.com 镜像下载模型
// （transformers.js 的 remoteHost 为硬编码，必须在使用 pipeline 之前设置）
env.remoteHost = 'https://hf-mirror.com/'

const DIM = 384

type Extractor = (text: string, options: { pooling: string; normalize: boolean }) => {
  data: Float32Array | ArrayLike<number>
}

let extractor: Extractor | null = null

async function getExtractor(): Promise<Extractor | null> {
  if (extractor) return extractor
  try {
    extractor = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as unknown as Extractor
    console.log('[Embedding] 本地模型加载成功:', 'Xenova/all-MiniLM-L6-v2')
    return extractor
  } catch (err) {
    console.warn('[Embedding] 本地模型加载失败，降级为哈希 embedding:', err)
    return null
  }
}

/**
 * 生成文本向量（384 维）
 */
export async function embedText(text: string): Promise<number[]> {
  console.log('[Embedding] 开始向量化文本，文本长度:', text.length)
  const ex = await getExtractor()
  if (ex) {
    try {
      const output = await ex(text.slice(0, 2000), { pooling: 'mean', normalize: true })
      const vector = Array.from(output.data as Float32Array)
      console.log('[Embedding] 向量化完成，维度:', vector.length)
      return vector
    } catch {
      /* 降级 */
    }
  }
  const vector = hashEmbedding(text, DIM)
  console.log('[Embedding] 向量化完成（哈希兜底），维度:', vector.length)
  return vector
}

/**
 * 哈希 embedding（兜底）：基于字符 n-gram 的确定性 384 维向量
 */
function hashEmbedding(text: string, dim: number): number[] {
  const vector = new Array<number>(dim).fill(0)
  const tokens = text.toLowerCase().split(/[\s\-_./,:;()\[\]{}+]+/)
  for (const token of tokens) {
    if (!token) continue
    for (let i = 0; i <= token.length - 1; i++) {
      const gram = token.slice(i, i + 3)
      let hash = 2166136261
      for (let j = 0; j < gram.length; j++) {
        hash ^= gram.charCodeAt(j)
        hash = Math.imul(hash, 16777619)
      }
      const idx = Math.abs(hash) % dim
      vector[idx] += 1
    }
  }
  // L2 归一化
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1
  return vector.map((v) => v / norm)
}
