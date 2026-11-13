<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NCard, NTag, NEmpty, NSpace, NButton, NSpin, NAlert, NGrid, NGi, NText,
  NModal, NInput, NList, NListItem, NThing,
} from 'naive-ui'
import { api, type DocVideo, type DocFile } from '../api/client'

const videos = ref<DocVideo[]>([])
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const kbAvailable = ref(true)

// 展开详情
const selected = ref<DocVideo | null>(null)
const docFiles = ref<DocFile[]>([])
const docsLoading = ref(false)

// 预览
const preview = ref<{ name: string; content: string } | null>(null)
const previewLoading = ref(false)
const previewQuery = ref('')

function kindLabel(kind: DocFile['kind']): string {
  return kind === 'transcript' ? '转写文档' : kind === 'skill' ? 'Skill 包' : '摘要'
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const r = await api.docs()
    videos.value = r.videos
    kbAvailable.value = r.kb_available
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '请求失败'
    videos.value = []
  } finally {
    loading.value = false
  }
}

async function openVideo(v: DocVideo) {
  selected.value = v
  docFiles.value = []
  docsLoading.value = true
  try {
    const r = await api.videoDocs(v.video_id)
    docFiles.value = r.docs
  } catch (e: unknown) {
    docFiles.value = []
    loadError.value = (e as Error).message || '加载文档清单失败'
  } finally {
    docsLoading.value = false
  }
}

async function previewDoc(f: DocFile) {
  if (!selected.value) return
  previewLoading.value = true
  previewQuery.value = ''
  try {
    const r = await api.readDoc(selected.value.video_id, f.path)
    preview.value = { name: r.name, content: r.content }
  } catch (e: unknown) {
    preview.value = { name: f.name, content: '读取失败：' + ((e as Error).message || '未知错误') }
  } finally {
    previewLoading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div style="max-width: 1200px; margin: 0 auto">
    <!-- 精简模式提示 -->
    <NAlert v-if="!kbAvailable && !loadError" type="info" title="精简模式" style="margin-bottom: 16px">
      当前安装未包含知识库（PostgreSQL），以下为文档与 Skill 产物管理。
      需要检索/问答时，重装选「完整安装」即可（数据不丢）。
    </NAlert>

    <NAlert v-if="loadError" type="error" title="文档加载失败" style="margin-bottom: 16px">
      {{ loadError }}
      <NButton size="tiny" style="margin-left: 8px" @click="load">重试</NButton>
    </NAlert>

    <NCard size="small">
      <template #header-extra>
        <NSpace>
          <NInput v-model:value="keyword" placeholder="搜索标题 / video_id" clearable style="width: 240px" size="small" />
          <NButton size="small" @click="load">刷新</NButton>
        </NSpace>
      </template>

      <NSpin :show="loading">
        <NEmpty v-if="!videos.length && !loadError" description="还没有产物 —— 先在任务台处理一个视频" />

        <NGrid v-else :cols="2" :x-gap="14" :y-gap="14">
          <NGi v-for="v in videos.filter(x => !keyword.trim() || (x.title + x.video_id).toLowerCase().includes(keyword.trim().toLowerCase()))" :key="v.video_id">
            <NCard
              size="small"
              hoverable
              style="cursor: pointer; height: 100%"
              :title="v.title || v.video_id"
              @click="openVideo(v)"
            >
              <template #header-extra>
                <NTag size="tiny" :bordered="false">{{ v.doc_count }} 个文档</NTag>
              </template>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px">{{ v.video_id }}</div>
              <NSpace :size="6">
                <NTag v-if="v.has_transcript" size="small" type="info" :bordered="false">转写文档</NTag>
                <NTag v-if="v.has_skill" size="small" type="success" :bordered="false">Skill 包</NTag>
                <NTag v-if="v.has_summary" size="small" type="warning" :bordered="false">摘要</NTag>
              </NSpace>
            </NCard>
          </NGi>
        </NGrid>
      </NSpin>
    </NCard>

    <!-- 文件清单 -->
    <NCard v-if="selected" size="small" style="margin-top: 16px" :title="(selected.title || selected.video_id) + ' — 文档清单'" closable @close="selected = null; docFiles = []">
      <NSpin :show="docsLoading">
        <NList hoverable clickable>
          <NListItem v-for="f in docFiles" :key="f.path" @click="previewDoc(f)">
            <NThing :title="f.name" content-style="font-size: 12px; color: #94a3b8">
              <template #header-extra>
                <NSpace :size="6">
                  <NTag size="tiny" :bordered="false" :type="f.kind === 'skill' ? 'success' : f.kind === 'transcript' ? 'info' : 'warning'">
                    {{ kindLabel(f.kind) }}
                  </NTag>
                  <NText depth="3" style="font-size: 12px">{{ (f.size / 1024).toFixed(1) }} KB</NText>
                </NSpace>
              </template>
              {{ f.path }}
            </NThing>
          </NListItem>
        </NList>
        <NEmpty v-if="!docFiles.length && !docsLoading" description="该视频暂无 md 产物" />
      </NSpin>
    </NCard>

    <!-- 内容预览 -->
    <NModal
      :show="!!preview"
      @update:show="(v: boolean) => { if (!v) preview = null }"
      preset="card"
      :title="preview?.name"
      style="width: 860px; max-width: 92vw"
    >
      <template #header-extra>
        <NInput v-model:value="previewQuery" placeholder="在文中查找…" size="small" clearable style="width: 200px" />
      </template>
      <NSpin :show="previewLoading">
        <div
          style="max-height: 64vh; overflow: auto; font-size: 14px; line-height: 1.8; color: #334155; white-space: pre-wrap; background: #f8fafc; padding: 16px; border-radius: 6px"
        >{{ preview?.content }}</div>
      </NSpin>
    </NModal>
  </div>
</template>
