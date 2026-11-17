<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import {
  NButton, NCard, NInput, NSpace, NTag, NProgress, NEmpty, useMessage, NSelect,
  NTabs, NTabPane, NUpload, NUploadDragger, NInputGroup, NGrid, NGi, NText,
  NTooltip, NPopconfirm, NPagination,
} from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { api, STAGE_LABEL, fmtTs, type Task, type TaskStats, type ApiError, type Precision } from '../api/client'

const message = useMessage()
const source = ref('')
const quality = ref('480')
const precision = ref<Precision>('fast')
const submitting = ref(false)
const tasks = ref<Task[]>([])
let timer: number | undefined

// DR-37：统计/筛选/分页均由后端返回
const stats = ref<TaskStats>({ total: 0, running: 0, done: 0, failed: 0, stuck: 0 })
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')

const batchText = ref('')
const uploading = ref(false)

const qualityOptions = [
  { label: '480p（快）', value: '480' },
  { label: '720p', value: '720' },
  { label: '1080p（慢）', value: '1080' },
]

const precisionOptions = [
  { label: '快速（默认，长视频秒级）', value: 'fast' },
  { label: '🔬 精细（逐帧检测，长视频约 10 分钟）', value: 'precise' },
]

const STAGE_PERCENT: Record<string, number> = {
  queued: 5, downloading: 25, transcribing: 50, visual: 75, summarizing: 90, done: 100, failed: 100,
}
const STAGE_TYPE: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  queued: 'default', downloading: 'info', transcribing: 'info', visual: 'info',
  summarizing: 'warning', done: 'success', failed: 'error', '-': 'default',
}

/** 状态筛选（点击统计卡片切换；再次点击已选中的卡片则回到全部） */
const stageFilter = ref('all')

interface StatCard {
  key: string
  label: string
  value: number
  color: string
  bg: string
  border: string
}

// 统计值来自后端（DR-37），不受当前筛选影响
const statCards = computed<StatCard[]>(() => [
  { key: 'all', label: '全部任务', value: stats.value.total, color: '#334155', bg: '#f8fafc', border: '#e2e8f0' },
  { key: 'running', label: '处理中', value: stats.value.running, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'done', label: '已完成', value: stats.value.done, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { key: 'failed', label: '失败', value: stats.value.failed, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
])

function selectStat(key: string) {
  stageFilter.value = stageFilter.value === key ? 'all' : key
  page.value = 1 // 切筛选回到第一页
  refresh()
}

/** 搜索（回车/清空触发，回到第一页） */
function onSearch() {
  page.value = 1
  refresh()
}

/** 改每页条数（回到第一页） */
function onPageSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  refresh()
}

const stuckCount = computed(() => stats.value.stuck)

/** 重置卡住任务（DR-34） */
const resetting = ref<string | null>(null)
async function resetTask(id: string) {
  resetting.value = id
  try {
    await api.resetTask(id)
    message.success('已重置，任务重新入队（已完成的阶段复用缓存）')
    await refresh()
  } catch (e: unknown) {
    message.error(`重置失败：${(e as Error).message}`)
  } finally {
    resetting.value = null
  }
}

/** 删除任务（DR-26 两档）：record=仅清记录（保留 KB 与源视频/产物）；all=彻底删除 */
const deleting = ref<string | null>(null)
async function removeTask(id: string, mode: 'record' | 'all') {
  deleting.value = id
  try {
    const r = await api.deleteTask(id, mode)
    if (mode === 'record') {
      message.success('任务记录已清除（知识库与源视频/产物保留）')
    } else {
      const parts = []
      if (r.kb_deleted) parts.push('知识库条目')
      if (r.dir_deleted) parts.push('工作目录（含源视频）')
      message.success(`已彻底删除：${parts.join(' + ') || '无数据'}`)
    }
    await refresh()
  } catch (e: unknown) {
    message.error(`删除失败：${(e as Error).message}`)
  } finally {
    deleting.value = null
  }
}

/** 批量文本 → 有效行（去注释/空行/重复） */
const batchLines = computed(() => {
  const seen = new Set<string>()
  return batchText.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !seen.has(l) && seen.add(l))
})

async function refresh() {
  try {
    // DR-37：后端返回全量统计 + 条件查询 + 分页结果
    // stats 不受当前筛选影响（后端基于全量算），列表只返当前页
    const r = await api.listTasks({
      stageFilter: stageFilter.value,
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value,
    })
    tasks.value = r.tasks
    stats.value = r.stats
    total.value = r.total
    page.value = r.page
  } catch {
    /* 服务未启动时静默 */
  }
}

async function submitLink() {
  const src = source.value.trim()
  if (!src) {
    message.warning('请先粘贴视频链接')
    return
  }
  submitting.value = true
  try {
    const r = await api.createTask(src, quality.value, precision.value)
    message.success(`任务已创建：${r.task_id}（${precision.value === 'precise' ? '精细' : '快速'}档）`)
    source.value = ''
    await refresh()
  } catch (e: unknown) {
    handleErr(e)
  } finally {
    submitting.value = false
  }
}

/** 待确认的上传文件（确认门前本地暂存，不发请求） */
const pendingFile = ref<File | null>(null)
const pendingPreviewUrl = ref('')
const pendingDuration = ref<number | null>(null)

function onFilePicked({ file }: { file: UploadFileInfo }) {
  const f = file.file
  if (!f) return
  if (f.size > 2 * 1024 * 1024 * 1024) {
    message.error('文件超过 2GB 上限')
    return
  }
  pendingFile.value = f
  pendingPreviewUrl.value = URL.createObjectURL(f)
  pendingDuration.value = null
  // 读时长预览（视频元数据）
  const v = document.createElement('video')
  v.preload = 'metadata'
  v.onloadedmetadata = () => {
    pendingDuration.value = v.duration
    URL.revokeObjectURL(v.src)
  }
  v.src = pendingPreviewUrl.value
}

function clearPending() {
  pendingFile.value = null
  if (pendingPreviewUrl.value) URL.revokeObjectURL(pendingPreviewUrl.value)
  pendingPreviewUrl.value = ''
  pendingDuration.value = null
}

/** 确认后才真正上传建任务 */
async function confirmUpload() {
  const f = pendingFile.value
  if (!f) return
  uploading.value = true
  try {
    const r = await api.uploadVideo(f, quality.value, precision.value)
    message.success(`上传完成，任务已创建：${r.task_id}`)
    clearPending()
    await refresh()
  } catch (e: unknown) {
    handleErr(e)
  } finally {
    uploading.value = false
  }
}

async function submitBatch() {
  const lines = batchLines.value
  if (!lines.length) {
    message.warning('请先粘贴视频链接（每行一条）')
    return
  }
  submitting.value = true
  let ok = 0
  const results: string[] = []
  for (const line of lines) {
    try {
      const r = await api.createTask(line, quality.value, precision.value)
      ok++
      results.push(`✅ ${r.task_id}`)
    } catch (e: unknown) {
      const err = e as ApiError
      if (err.status === 409) {
        const d = err.detail as { task_id?: string } | undefined
        results.push(`ℹ 已存在 ${d?.task_id ?? line}`)
        ok++
      } else {
        results.push(`❌ ${line.slice(0, 40)}: ${err.message}`)
      }
    }
  }
  submitting.value = false
  message.success(`批量提交完成：${ok}/${lines.length} 条成功`)
  console.log(results.join('\n'))
  batchText.value = ''
  await refresh()
}

function handleErr(e: unknown) {
  const err = e as ApiError
  if (err.status === 409) {
    const d = err.detail as { task_id?: string; stage?: string; reason?: string } | undefined
    if (d?.reason === 'duplicate_content') {
      message.info(`相同内容的视频已存在（${d.task_id}，${d.stage}），已自动跳过，不会重复处理`)
    } else {
      message.info(`该视频已在知识库或处理中（${d?.stage ?? '-'}）`)
    }
  } else {
    message.error(`提交失败：${err.message}（确认后端已启动）`)
  }
}

onMounted(() => {
  refresh()
  timer = window.setInterval(refresh, 4000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

/** 预期剩余秒数 → 人类可读（1m20s / 2h5m） */
function fmtEta(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h${m % 60}m`
  if (m > 0) return `${m}m${s % 60}s`
  return `${s}s`
}
</script>

<template>
  <div style="max-width: 1080px; margin: 0 auto">
    <NCard size="small" style="margin-bottom: 16px">
      <NTabs type="segment" animated>
        <!-- 链接模式 -->
        <NTabPane name="link" tab="视频链接">
          <NSpace vertical style="padding: 4px 0">
            <NSpace>
              <NInputGroup>
                <NInput
                  v-model:value="source"
                  placeholder="粘贴 B站 / YouTube 视频链接"
                  style="width: 520px"
                  @keyup.enter="submitLink"
                />
                <NButton type="primary" :loading="submitting" @click="submitLink">开始处理</NButton>
              </NInputGroup>
            </NSpace>
          </NSpace>
        </NTabPane>

        <!-- 本地上传：确认门（选中→预览确认→才上传） -->
        <NTabPane name="upload" tab="📁 本地上传">
          <NSpace vertical style="padding: 4px 0">
            <NUpload
              v-if="!pendingFile"
              draggable
              :max="1"
              :default-upload="false"
              :show-upload-list="false"
              accept="video/*,.mp4,.mkv,.webm,.mov,.avi"
              @change="onFilePicked"
            >
              <NUploadDragger style="padding: 24px 0">
                <div style="font-size: 32px; margin-bottom: 8px">📤</div>
                <NText strong>点击或拖拽视频文件到此处</NText>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 4px">
                  支持 mp4 / mkv / webm / mov / avi，单文件上限 2GB
                </div>
              </NUploadDragger>
            </NUpload>

            <!-- 确认面板：未点确认前不会上传 -->
            <NCard v-else size="small" embedded>
              <NSpace align="center" :size="16">
                <video
                  :src="pendingPreviewUrl"
                  style="width: 200px; max-height: 120px; border-radius: 4px; background: #000"
                  controls
                />
                <div style="flex: 1; min-width: 0">
                  <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                    {{ pendingFile.name }}
                  </div>
                  <div style="font-size: 12px; color: #94a3b8; margin-top: 4px">
                    {{ (pendingFile.size / 1024 / 1024).toFixed(1) }} MB
                    <template v-if="pendingDuration !== null"> · 时长 {{ fmtTs(pendingDuration) }}</template>
                  </div>
                </div>
              </NSpace>
              <NSpace justify="end" style="margin-top: 12px">
                <NButton quaternary @click="clearPending">重新选择</NButton>
                <NButton type="primary" :loading="uploading" @click="confirmUpload">确认处理</NButton>
              </NSpace>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 8px">
                点「确认处理」后文件才会上传；相同内容的重复上传会被自动识别并跳过
              </div>
            </NCard>
          </NSpace>
        </NTabPane>

        <!-- 批量导入 -->
        <NTabPane name="batch" tab="批量导入">
          <NSpace vertical style="padding: 4px 0">
            <NInput
              v-model:value="batchText"
              type="textarea"
              placeholder="每行一条视频链接，支持 B站 / YouTube；# 开头的行会被忽略"
              :autosize="{ minRows: 5, maxRows: 12 }"
            />
            <NSpace align="center">
              <NButton type="primary" :loading="submitting" :disabled="!batchLines.length" @click="submitBatch">
                批量提交（{{ batchLines.length }} 条）
              </NButton>
              <NText depth="3" style="font-size: 12px">已入库/处理中的链接会自动跳过（幂等）</NText>
            </NSpace>
          </NSpace>
        </NTabPane>
      </NTabs>

      <template #header-extra>
        <NSpace :size="10" align="center">
          <NTooltip trigger="hover" placement="bottom-end">
            <template #trigger>
              <NSelect v-model:value="precision" :options="precisionOptions" style="width: 320px" size="small" />
            </template>
            画面识别精度：
            快速 —— 日常收藏/批量导入（长视频秒级完成，抽帧均匀覆盖）
            🔬精细 —— 镜头切换快的视频（教程/PPT/游戏录像），需帧级切点；长视频约 10 分钟
          </NTooltip>
          <NSelect v-model:value="quality" :options="qualityOptions" style="width: 140px" size="small" />
        </NSpace>
      </template>
    </NCard>

    <NCard size="small" style="margin-bottom: 16px">
      <NGrid :cols="4" :x-gap="12">
        <NGi v-for="c in statCards" :key="c.key">
          <div
            :title="`点击筛选：${c.label}`"
            style="cursor: pointer; border-radius: 8px; padding: 12px 14px; transition: all .15s"
            :style="{
              background: stageFilter === c.key ? c.bg : '#fff',
              border: `2px solid ${stageFilter === c.key ? c.color : c.border}`,
              opacity: stageFilter === 'all' || stageFilter === c.key ? 1 : 0.55,
            }"
            @click="selectStat(c.key)"
          >
            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px">{{ c.label }}</div>
            <div :style="{ fontSize: '24px', fontWeight: 700, lineHeight: 1.1, color: c.color }">{{ c.value }}</div>
            <div v-if="c.key === 'running' && stuckCount > 0" style="font-size: 11px; color: #dc2626; margin-top: 4px">
              ⚠ {{ stuckCount }} 个疑似卡住
            </div>
          </div>
        </NGi>
      </NGrid>
    </NCard>

    <NCard title="任务列表" size="small">
      <template #header-extra>
        <NSpace :size="8" align="center">
          <NInput
            v-model:value="keyword"
            placeholder="搜索标题 / ID"
            clearable
            size="small"
            style="width: 200px"
            @keyup.enter="onSearch"
            @clear="onSearch"
          />
          <NText depth="3" style="font-size: 12px">共 {{ total }} 条</NText>
        </NSpace>
      </template>
      <NEmpty v-if="!tasks.length" description="该状态下暂无任务" />
      <NSpace v-else vertical :size="10">
        <NCard v-for="t in tasks" :key="t.video_id" size="small" embedded>
          <div style="display: flex; align-items: center; gap: 12px">
            <div style="flex: 1; min-width: 0">
              <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                {{ t.title || t.video_id }}
              </div>
              <div style="font-size: 12px; color: #94a3b8">{{ t.video_id }}</div>
              <!-- 进度条（V1.3：分片/帧计数 + 百分比 + 预期剩余时间） -->
              <div
                v-if="t.progress != null && t.progress_total != null && t.progress_total > 0 && t.stage !== 'done'"
                style="margin-top: 6px"
              >
                <NProgress
                  type="line"
                  :percentage="Math.min(100, Math.round((t.progress / t.progress_total) * 100))"
                  :height="8"
                  :border-radius="4"
                  :show-indicator="false"
                />
                <div style="font-size: 12px; color: #64748b; margin-top: 3px">
                  {{ t.progress }}/{{ t.progress_total }} {{ t.progress_unit || '' }}
                  （{{ Math.round((t.progress / t.progress_total) * 100) }}%）
                  <span v-if="t.eta_seconds != null && t.eta_seconds > 0">· 预计剩余 {{ fmtEta(t.eta_seconds) }}</span>
                </div>
              </div>
              <div v-if="t.stage === 'failed' && t.error" style="font-size: 12px; color: #ef4444; margin-top: 2px">
                {{ t.error.slice(0, 80) }}
              </div>
              <div v-if="t.stuck" style="font-size: 12px; color: #d97706; margin-top: 2px">
                ⚠ 心跳超过 10 分钟未更新，可能已卡住（后台进程被回收）——点右侧「重新运行」恢复
              </div>
            </div>
            <NTag :type="STAGE_TYPE[t.stage || '-'] || 'default'" size="small">
              {{ STAGE_LABEL[t.stage || '-'] || t.stage }}
            </NTag>
            <NButton
              v-if="t.stuck || t.stage === 'failed'"
              size="tiny"
              type="warning"
              secondary
              :loading="resetting === t.video_id"
              :title="t.stage === 'failed'
                ? '失败重试：重置任务状态并重跑；已完成的阶段（下载/音频抽取/帧提取）复用缓存，不重复花费 API'
                : '重置任务状态并重跑；已完成的阶段（下载/转写/帧描述）复用缓存，不重复花费 API'"
              @click="resetTask(t.video_id)"
            >重试</NButton>
            <NPopconfirm @positive-click="removeTask(t.video_id, 'record')">
              <template #trigger>
                <NButton
                  size="tiny"
                  quaternary
                  :loading="deleting === t.video_id"
                  title="仅清除任务进度记录（进度/状态）。知识库条目、源视频与产物全部保留；任何状态（含画面识别中）都可操作，但建议在完成后使用，避免与进行中的管道互相干扰"
                >清除记录</NButton>
              </template>
              仅清任务记录（进度/状态），保留知识库条目与源视频/产物。确认？
            </NPopconfirm>
            <NPopconfirm @positive-click="removeTask(t.video_id, 'all')">
              <template #trigger>
                <NButton
                  size="tiny"
                  quaternary
                  type="error"
                  :loading="deleting === t.video_id"
                  title="彻底删除知识库条目（含向量/全文索引）、源视频与全部产物，不可恢复。仅在确定不再需要该视频时使用"
                >彻底删除</NButton>
              </template>
              删除全部数据（知识库条目 + 源视频 + 产物）？不可恢复！
            </NPopconfirm>
          </div>
          <NProgress
            style="margin-top: 10px"
            :percentage="STAGE_PERCENT[t.stage || '-'] ?? 0"
            :status="t.stage === 'failed' ? 'error' : t.stage === 'done' ? 'success' : 'default'"
            :show-indicator="false"
            :height="6"
          />
        </NCard>
      </NSpace>
      <div v-if="total > pageSize" style="display: flex; justify-content: flex-end; margin-top: 16px">
        <NPagination
          v-model:page="page"
          :page-size="pageSize"
          :item-count="total"
          size="small"
          show-size-picker
          :page-sizes="[10, 20, 50]"
          @update:page="refresh"
          @update:page-size="onPageSizeChange"
        />
      </div>
    </NCard>
  </div>
</template>
