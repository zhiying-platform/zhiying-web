<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { NCard, NTag, NEmpty, NSpace, NInput, NButton, NDescriptions, NDescriptionsItem, NDivider, NSpin, NAlert, NGrid, NGi, NStatistic, NText } from 'naive-ui'
import { api, fmtTs, type VideoItem } from '../api/client'

const videos = ref<VideoItem[]>([])
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const selected = ref<VideoItem | null>(null)

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return videos.value
  return videos.value.filter(
    (v) =>
      (v.title || '').toLowerCase().includes(k) ||
      (v.topics || []).some((t) => t.toLowerCase().includes(k)) ||
      (v.summary || '').toLowerCase().includes(k),
  )
})

const totalDuration = computed(() => videos.value.reduce((a, v) => a + (v.duration || 0), 0))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const r = await api.videos()
    videos.value = r.videos
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '请求失败'
    videos.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div style="max-width: 1200px; margin: 0 auto">
    <!-- 加载失败：显式报错而非伪装成空 -->
    <NAlert v-if="loadError" type="error" title="知识库加载失败" style="margin-bottom: 16px">
      {{ loadError }} —— 确认后端已启动（python -m zhiying.api），然后点重试。
      <NButton size="tiny" style="margin-left: 8px" @click="load">重试</NButton>
    </NAlert>

    <!-- 统计条 -->
    <NCard size="small" style="margin-bottom: 16px" v-if="!loadError">
      <NGrid :cols="3" :x-gap="12">
        <NGi><NStatistic label="视频数" :value="videos.length" /></NGi>
        <NGi><NStatistic label="总时长" :value="fmtTs(totalDuration)" /></NGi>
        <NGi>
          <NStatistic label="主题数" :value="String(new Set(videos.flatMap((v) => v.topics || [])).size)" />
        </NGi>
      </NGrid>
    </NCard>

    <NCard size="small">
      <template #header-extra>
        <NSpace>
          <NInput v-model:value="keyword" placeholder="搜索标题 / 主题 / 摘要" clearable style="width: 260px" size="small" />
          <NButton size="small" @click="load">刷新</NButton>
        </NSpace>
      </template>

      <NSpin :show="loading">
        <NEmpty v-if="!filtered.length && !loadError" description="知识库为空 —— 先在任务台提交视频，处理完成后自动入库" />

        <NGrid v-else :cols="2" :x-gap="14" :y-gap="14">
          <NGi v-for="v in filtered" :key="v.video_id">
            <NCard
              size="small"
              hoverable
              style="cursor: pointer; height: 100%"
              :title="v.title || v.video_id"
              @click="selected = v"
            >
              <template #header-extra>
                <NTag size="tiny" :bordered="false" type="default">{{ fmtTs(v.duration) }}</NTag>
              </template>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px">
                {{ v.uploader || '未知 UP 主' }} · {{ v.video_id }}
              </div>
              <NSpace :size="6" style="margin-bottom: 8px; min-height: 22px">
                <NTag v-for="t in (v.topics || []).slice(0, 4)" :key="t" size="small" type="info" :bordered="false">
                  {{ t }}
                </NTag>
                <NTag v-if="(v.topics || []).length > 4" size="small" :bordered="false">+{{ v.topics.length - 4 }}</NTag>
              </NSpace>
              <NText depth="3" style="font-size: 13px; line-height: 1.6; display: block">
                {{ (v.summary || '（无摘要）').slice(0, 120) }}{{ (v.summary || '').length > 120 ? '…' : '' }}
              </NText>
            </NCard>
          </NGi>
        </NGrid>
      </NSpin>
    </NCard>

    <!-- 详情：选中后展开 -->
    <NCard v-if="selected" size="small" style="margin-top: 16px" :title="selected.title || selected.video_id" closable @close="selected = null">
      <NDescriptions :column="3" size="small" bordered>
        <NDescriptionsItem label="video_id">{{ selected.video_id }}</NDescriptionsItem>
        <NDescriptionsItem label="UP 主">{{ selected.uploader || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="时长">{{ fmtTs(selected.duration) }}</NDescriptionsItem>
      </NDescriptions>

      <NDivider style="margin: 12px 0">主题标签</NDivider>
      <NSpace :size="6">
        <NTag v-for="t in selected.topics || []" :key="t" type="info" :bordered="false">{{ t }}</NTag>
        <span v-if="!selected.topics?.length" style="color: #94a3b8; font-size: 13px">无</span>
      </NSpace>

      <NDivider style="margin: 12px 0">完整摘要</NDivider>
      <div style="font-size: 14px; line-height: 1.8; color: #334155; white-space: pre-wrap">
        {{ selected.summary || '（无摘要）' }}
      </div>
    </NCard>
  </div>
</template>
