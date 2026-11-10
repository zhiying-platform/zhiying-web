<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  NButton, NCard, NInput, NSpace, NTag, NProgress, NEmpty, useMessage, NSelect, NAlert,
} from 'naive-ui'
import { api, STAGE_LABEL, type Task, type ApiError } from '../api/client'

const message = useMessage()
const source = ref('')
const quality = ref('480')
const submitting = ref(false)
const tasks = ref<Task[]>([])
let timer: number | undefined

const qualityOptions = [
  { label: '480p（快）', value: '480' },
  { label: '720p', value: '720' },
  { label: '1080p（慢）', value: '1080' },
]

const STAGE_PERCENT: Record<string, number> = {
  queued: 5, downloading: 25, transcribing: 50, visual: 75, summarizing: 90, done: 100, failed: 100,
}
const STAGE_TYPE: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  queued: 'default', downloading: 'info', transcribing: 'info', visual: 'info',
  summarizing: 'warning', done: 'success', failed: 'error', '-': 'default',
}

async function refresh() {
  try {
    const r = await api.listTasks()
    tasks.value = r.tasks
  } catch {
    /* 服务未启动时静默 */
  }
}

async function submit() {
  const src = source.value.trim()
  if (!src) {
    message.warning('请先粘贴视频链接')
    return
  }
  submitting.value = true
  try {
    const r = await api.createTask(src, quality.value)
    message.success(`任务已创建：${r.task_id}`)
    source.value = ''
    await refresh()
  } catch (e: unknown) {
    const err = e as ApiError
    if (err.status === 409) {
      const d = err.detail as { task_id?: string; stage?: string } | undefined
      message.info(`该视频已在知识库或处理中（${d?.stage ?? '-'}）`)
    } else {
      message.error(`提交失败：${err.message}`)
    }
  } finally {
    submitting.value = false
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
    <NCard title="提交视频" size="small" style="margin-bottom: 16px">
      <NSpace vertical>
        <NSpace>
          <NInput
            v-model:value="source"
            placeholder="粘贴 B站 / YouTube 链接，或本地文件路径"
            style="width: 560px"
            @keyup.enter="submit"
          />
          <NSelect v-model:value="quality" :options="qualityOptions" style="width: 140px" />
          <NButton type="primary" :loading="submitting" @click="submit">开始处理</NButton>
        </NSpace>
        <NAlert type="info" :bordered="false" size="small">
          全流程：下载 → 语音转写 → 画面识别 → 多模态文案 → 摘要 → 入库。处理期间可离开本页，任务在服务端继续。
        </NAlert>
      </NSpace>
    </NCard>

    <NCard title="任务列表" size="small">
      <NEmpty v-if="!tasks.length" description="暂无任务，先提交一个视频链接" />
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
