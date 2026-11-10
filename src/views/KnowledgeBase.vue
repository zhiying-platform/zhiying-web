<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NCard, NTag, NEmpty, NSpace, NInput, NButton, NDescriptions, NDescriptionsItem, NDivider, NSpin } from 'naive-ui'
import { api, fmtTs, type VideoItem } from '../api/client'

const videos = ref<VideoItem[]>([])
const loading = ref(false)
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

const allTopics = computed(() => {
  const s = new Set<string>()
  videos.value.forEach((v) => (v.topics || []).forEach((t) => s.add(t)))
  return Array.from(s)
})

async function load() {
  loading.value = true
  try {
    const r = await api.videos()
    videos.value = r.videos
  } catch {
    videos.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div style="max-width: 1080px; margin: 0 auto">
    <NCard title="知识库" size="small">
      <template #header-extra>
        <NSpace>
          <NInput v-model:value="keyword" placeholder="搜索标题 / 主题 / 摘要" clearable style="width: 260px" size="small" />
          <NButton size="small" @click="load">刷新</NButton>
        </NSpace>
      </template>

      <NSpin :show="loading">
        <NEmpty v-if="!filtered.length" description="知识库为空 —— 先在任务台提交视频，或到问答页检索" />

        <NSpace v-else vertical :size="12">
          <NCard v-for="v in filtered" :key="v.video_id" size="small" embedded hoverable @click="selected = v">
            <div style="display: flex; gap: 12px; align-items: flex-start">
              <div style="flex: 1; min-width: 0">
                <div style="font-weight: 500; margin-bottom: 4px">{{ v.title || v.video_id }}</div>
                <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px">
                  {{ v.uploader || '未知 UP 主' }} · {{ fmtTs(v.duration) }} · {{ v.video_id }}
                </div>
                <NSpace :size="6" style="margin-bottom: 8px">
                  <NTag v-for="t in v.topics || []" :key="t" size="small" type="info" :bordered="false">{{ t }}</NTag>
                </NSpace>
                <div style="font-size: 13px; color: #475569; line-height: 1.6">
                  {{ v.summary || '（无摘要）' }}
                </div>
              </div>
            </div>
          </NCard>
        </NSpace>
      </NSpin>
    </NCard>

    <!-- 详情抽屉 -->
    <NCard v-if="selected" size="small" style="margin-top: 16px" :title="selected.title || selected.video_id" closable @close="selected = null">
      <NDescriptions :column="2" size="small" bordered>
        <NDescriptionsItem label="video_id">{{ selected.video_id }}</NDescriptionsItem>
        <NDescriptionsItem label="UP 主">{{ selected.uploader || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="时长">{{ fmtTs(selected.duration) }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">{{ selected.status }}</NDescriptionsItem>
      </NDescriptions>

      <NDivider style="margin: 12px 0">主题标签</NDivider>
      <NSpace :size="6">
        <NTag v-for="t in selected.topics || []" :key="t" type="info" :bordered="false">{{ t }}</NTag>
        <span v-if="!selected.topics?.length" style="color: #94a3b8; font-size: 13px">无</span>
      </NSpace>

      <NDivider style="margin: 12px 0">摘要</NDivider>
      <div style="font-size: 14px; line-height: 1.8; color: #334155; white-space: pre-wrap">
        {{ selected.summary || '（无摘要）' }}
      </div>

      <NDivider style="margin: 12px 0">本库主题索引</NDivider>
      <NSpace :size="6">
        <NTag v-for="t in allTopics" :key="t" size="small" :bordered="false">{{ t }}</NTag>
      </NSpace>
    </NCard>
  </div>
</template>
