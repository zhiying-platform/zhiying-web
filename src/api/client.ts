/** 知映 API 客户端（V0.3，对应 FastAPI 服务层） */

const BASE = import.meta.env.VITE_API_BASE || '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail: unknown = res.statusText
    try {
      const j = await res.json()
      detail = j.detail ?? j
    } catch {
      /* ignore */
    }
    const err = new Error(`HTTP ${res.status}`) as ApiError
    err.detail = detail
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

export interface ApiError extends Error {
  detail?: { task_id?: string; stage?: string } | string | unknown
  status?: number
}

export interface Task {
  video_id: string
  title?: string
  status?: string
  stage?: string
  /** 失败原因（仅 failed 状态返回） */
  error?: string
  /** 心跳超过 10 分钟未更新且仍处于运行阶段（DR-34，可一键重跑） */
  stuck?: boolean
  /** 任务心跳时间戳（iso） */
  updated_at?: string
}

/** POST /api/tasks 的 202 响应（新任务） */
export interface CreateTaskResult {
  task_id: string
  stage?: string
}

/** 画面识别精度（DR-22 两档） */
export type Precision = 'fast' | 'precise'

export interface TaskDetail {
  video_id: string
  stage: string
  detail: string
  error: string
  meta: Record<string, unknown>
}

export interface SearchHit {
  chunk_id: number
  video_id: string
  title: string
  /** 原视频链接（B站/YouTube；本地文件为空或路径） */
  source: string
  start_ts: number
  end_ts: number
  text: string
  score: number
  /** 命中方式：vector（向量）| fulltext（全文） */
  source_kind: 'vector' | 'fulltext'
}

export interface Citation {
  video_id: string
  title: string
  start_ts: number
  end_ts: number
  quote: string
  start_ts_fmt: string
  end_ts_fmt: string
  /** 视频深链（带时间点，可跳回原视频）；本地文件/未知来源为 null */
  url?: string | null
}

export interface AskResult {
  answer_text: string
  citations: Citation[]
  note?: string
}

export interface VideoItem {
  video_id: string
  title: string
  uploader: string
  duration: number
  status: string
  topics: string[]
  summary: string
}

export interface TaskStats {
  total: number
  running: number
  done: number
  failed: number
  stuck: number
}

/** GET /api/tasks 的分页响应（DR-37：后端主导统计+筛选+分页） */
export interface TaskListResult {
  tasks: Task[]
  stats: TaskStats
  total: number
  page: number
  page_size: number
  pages: number
  auto_resumed: string[]
  auto_resume_exhausted: string[]
}

export interface ListTasksParams {
  stageFilter?: string
  page?: number
  pageSize?: number
  keyword?: string
  autoResume?: boolean
}


/** GET /api/config 的能力标志（V1.3：精简安装 kb_available=false） */
export interface AppConfig {
  version: string
  vlm_provider: string
  text_provider: string
  embed_model: string
  data_dir: string
  keys_configured: { siliconflow: boolean; longcat: boolean }
  kb_available: boolean
}

/** 文档库条目（V1.3：文件系统驱动，不依赖 PG） */
export interface DocVideo {
  video_id: string
  title: string
  doc_count: number
  has_transcript: boolean
  has_skill: boolean
  has_summary: boolean
}

export interface DocFile {
  path: string
  name: string
  kind: 'transcript' | 'skill' | 'summary'
  size: number
  modified: number
}

export const api = {
  health: () => req<{ status: string; version: string }>('/health'),

  createTask: (source: string, quality = '480', precision: Precision = 'fast') =>
    req<CreateTaskResult>('/tasks', {
      method: 'POST',
      body: JSON.stringify({ source, quality, precision }),
    }),

  /** 上传本地视频文件（multipart 流式，一步到位建任务） */
  uploadVideo: (file: File, quality = '480', precision: Precision = 'fast') => {
    const form = new FormData()
    form.append('file', file)
    form.append('quality', quality)
    form.append('precision', precision)
    return req<CreateTaskResult & { file: string }>('/upload', { method: 'POST', body: form, headers: {} })
  },

  deleteTask: (video_id: string, mode: 'record' | 'all' = 'record', keep_source = false) =>
    req<{ deleted: boolean; mode: string; kb_deleted: boolean; dir_deleted: boolean; deleted_items: string[] }>(
      `/tasks/${video_id}?mode=${mode}&keep_source=${keep_source}`,
      { method: 'DELETE' },
    ),

  listTasks: (p: ListTasksParams = {}) => {
    const qs = new URLSearchParams({
      stage_filter: p.stageFilter || 'all',
      page: String(p.page ?? 1),
      page_size: String(p.pageSize ?? 20),
      keyword: p.keyword || '',
      auto_resume: String(p.autoResume ?? true),
    })
    return req<TaskListResult>(`/tasks?${qs.toString()}`)
  },

  /** 重置卡住的任务并重跑（DR-34；已完成阶段复用缓存） */
  resetTask: (video_id: string) =>
    req<{ reset: boolean; task_id: string; stage: string }>(`/tasks/${video_id}/reset`, {
      method: 'POST',
    }),

  taskDetail: (id: string) => req<TaskDetail>(`/tasks/${id}`),

  search: (query: string, top_k = 5) =>
    req<{ query: string; results: SearchHit[] }>('/search', {
      method: 'POST',
      body: JSON.stringify({ query, top_k }),
      signal: AbortSignal.timeout(60_000),
    }),

  ask: (question: string, top_k = 5) =>
    req<AskResult>('/ask', {
      method: 'POST',
      body: JSON.stringify({ question, top_k }),
      // 问答超时保护（DR-24）：180s 内未返回则中断，避免前端永久 pending
      signal: AbortSignal.timeout(180_000),
    }),

  videos: () => req<{ videos: VideoItem[] }>('/videos'),

  config: () => req<AppConfig>('/config'),

  docs: () => req<{ videos: DocVideo[]; kb_available: boolean }>('/docs'),

  videoDocs: (id: string) =>
    req<{ video_id: string; docs: DocFile[] }>(`/docs/${id}`),

  readDoc: (id: string, path: string) =>
    req<{ path: string; name: string; content: string }>(`/docs/${id}/file?path=${encodeURIComponent(path)}`),

  /** GET /api/settings：Key 配置状态（掩码显示，不回传完整值） */
  getSettings: () =>
    req<{ keys: Record<string, { configured: boolean; masked: string }> }>('/settings'),

  /** POST /api/settings：保存 Key（空值 = 不修改该项），写入 .env 后立即生效 */
  saveSettings: (siliconflow: string, longcat: string) =>
    req<{ saved: boolean; changed?: string[]; detail?: string; keys: Record<string, { configured: boolean; masked: string }> }>('/settings', {
      method: 'POST',
      body: JSON.stringify({ siliconflow_api_key: siliconflow, longcat_api_key: longcat }),
    }),
}

/** 秒 → mm:ss / hh:mm:ss */
export function fmtTs(sec: number): string {
  const s = Math.floor(sec || 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${p(h)}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`
}

export const STAGE_LABEL: Record<string, string> = {
  queued: '排队中',
  downloading: '下载视频',
  transcribing: '语音转写',
  visual: '画面识别',
  summarizing: '生成摘要',
  done: '已完成',
  failed: '失败',
  '-': '未开始',
}
