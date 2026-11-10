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
}

/** POST /api/tasks 的 202 响应（新任务） */
export interface CreateTaskResult {
  task_id: string
  stage?: string
}

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
  start_ts: number
  end_ts: number
  text: string
  score: number
  source: string
}

export interface Citation {
  video_id: string
  title: string
  start_ts: number
  end_ts: number
  quote: string
  start_ts_fmt: string
  end_ts_fmt: string
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

export const api = {
  health: () => req<{ status: string; version: string }>('/health'),

  createTask: (source: string, quality = '480') =>
    req<CreateTaskResult>('/tasks', { method: 'POST', body: JSON.stringify({ source, quality }) }),

  listTasks: () => req<{ tasks: Task[] }>('/tasks'),

  taskDetail: (id: string) => req<TaskDetail>(`/tasks/${id}`),

  search: (query: string, top_k = 5) =>
    req<{ query: string; results: SearchHit[] }>('/search', {
      method: 'POST',
      body: JSON.stringify({ query, top_k }),
    }),

  ask: (question: string, top_k = 5) =>
    req<AskResult>('/ask', { method: 'POST', body: JSON.stringify({ question, top_k }) }),

  videos: () => req<{ videos: VideoItem[] }>('/videos'),
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
