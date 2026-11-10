<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import {
  NButton, NCard, NInput, NSpace, NTag, NProgress, NEmpty, useMessage, NSelect,
  NTabs, NTabPane, NUpload, NUploadDragger, NInputGroup, NGrid, NGi, NText, NStatistic,
} from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { api, STAGE_LABEL, type Task, type ApiError, type Precision } from '../api/client'

const message = useMessage()
const source = ref('')
const quality = ref('480')
const precision = ref<Precision>('fast')
const submitting = ref(false)
const tasks = ref<Task[]>([])
let timer: number | undefined

const batchText = ref('')
const uploading = ref(false)

const qualityOptions = [
  { label: '480p（快）', value: '480' },
  { label: '720p', value: '720' },
  { label: '1080p（慢）', value: '1080' },
]

const precisionOptions = [
  { label: '⚡ 快速（默认，长视频秒级）', value: 'fast' },
  { label: '🔬 精细（逐帧场景检测，长视频 10min+）', value: 'precise' },
]

const STAGE_PERCENT: Record<string, number> = {
  queued: 5, downloading: 25, transcribing: 50, visual: 75, summarizing: 90, done: 100, failed: 100,
}
const STAGE_TYPE: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  queued: 'default', downloading: 'info', transcribing: 'info', visual: 'info',
  summarizing: 'warning', done: 'success', failed: 'error', '-': 'default',
}

const stats = computed(() => {
  const s = { total: tasks.value.length, done: 0, running: 0, failed: 0 }
  for (const t of tasks.value) {
    if (t.stage === 'done') s.done++
    else if (t.stage === 'failed') s.failed++
    else s.running++
  }
  return s
})

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
    const r = await api.listTasks()
    tasks.value = r.tasks
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

async function handleUpload({ file }: { file: UploadFileInfo }) {
  const f = file.file
  if (!f) return
  if (f.size > 2 * 1024 * 1024 * 1024) {
    message.error('文件超过 2GB 上限')
    return
  }
  uploading.value = true
  try {
    const r = await api.uploadVideo(f, quality.value, precision.value)
    message.success(`上传完成，任务已创建：${r.task_id}`)
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
    const d = err.detail as { task_id?: string; stage?: string } | undefined
    message.info(`该视频已在知识库或处理中（${d?.stage ?? '-'}）`)
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
</script>

<template>
  <div style="max-width: 1080px; margin: 0 auto">
    <NCard size="small" style="margin-bottom: 16px">
      <NTabs type="segment" animated>
        <!-- 链接模式 -->
        <NTabPane name="link" tab="🔗 视频链接">
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

        <!-- 本地上传 -->
        <NTabPane name="upload" tab="📁 本地上传">
          <NSpace vertical style="padding: 4px 0">
            <NUpload
              draggable
              :max="1"
              :default-upload="false"
              accept="video/*,.mp4,.mkv,.webm,.mov,.avi"
              @change="handleUpload"
            >
              <NUploadDragger style="padding: 24px 0">
                <div style="font-size: 32px; margin-bottom: 8px">📤</div>
                <NText strong>点击或拖拽视频文件到此处上传</NText>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 4px">
                  支持 mp4 / mkv / webm / mov / avi，单文件上限 2GB
                </div>
              </NUploadDragger>
            </NUpload>
          </NSpace>
        </NTabPane>

        <!-- 批量导入 -->
        <NTabPane name="batch" tab="📋 批量导入">
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
          <NSelect v-model:value="precision" :options="precisionOptions" style="width: 300px" size="small" />
          <NSelect v-model:value="quality" :options="qualityOptions" style="width: 140px" size="small" />
        </NSpace>
      </template>
    </NCard>

    <NCard size="small" style="margin-bottom: 16px">
      <NGrid :cols="4" :x-gap="12">
        <NGi><NStatistic label="全部任务" :value="stats.total" /></NGi>
        <NGi><NStatistic label="处理中" :value="stats.running" /></NGi>
        <NGi><NStatistic label="已完成" :value="stats.done" /></NGi>
        <NGi><NStatistic label="失败" :value="stats.failed" /></NGi>
      </NGrid>
    </NCard>

    <NCard title="任务列表" size="small">
      <NEmpty v-if="!tasks.length" description="暂无任务 —— 用上方任一方式提交视频" />
      <NSpace v-else vertical :size="10">
        <NCard v-for="t in tasks" :key="t.video_id" size="small" embedded>
          <div style="display: flex; align-items: center; gap: 12px">
            <div style="flex: 1; min-width: 0">
              <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                {{ t.title || t.video_id }}
              </div>
              <div style="font-size: 12px; color: #94a3b8">{{ t.video_id }}</div>
            </div>
            <NTag :type="STAGE_TYPE[t.stage || '-'] || 'default'" size="small">
              {{ STAGE_LABEL[t.stage || '-'] || t.stage }}
            </NTag>
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
    </NCard>
  </div>
</template>
