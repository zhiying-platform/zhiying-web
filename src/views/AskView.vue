<script setup lang="ts">
import { ref } from 'vue'
import { NCard, NInput, NButton, NSpace, NTag, NSpin, NEmpty, NAlert, NCollapse, NCollapseItem, useMessage } from 'naive-ui'
import { api, type AskResult } from '../api/client'

const message = useMessage()
const question = ref('')
const loading = ref(false)
const history = ref<{ q: string; r: AskResult }[]>([])

async function ask() {
  const q = question.value.trim()
  if (!q) {
    message.warning('请输入问题')
    return
  }
  loading.value = true
  try {
    const r = await api.ask(q)
    history.value.unshift({ q, r })
    question.value = ''
  } catch (e: unknown) {
    message.error(`提问失败：${(e as Error).message}（确认后端已启动）`)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div style="max-width: 900px; margin: 0 auto">
    <NCard title="知识库问答" size="small">
      <NSpace vertical>
        <NSpace>
          <NInput
            v-model:value="question"
            placeholder="问点什么，比如：视频里是怎么处理菠萝的？"
            style="width: 640px"
            @keyup.enter="ask"
          />
          <NButton type="primary" :loading="loading" @click="ask">提问</NButton>
        </NSpace>
        <NAlert type="info" :bordered="false" size="small">
          答案基于已入库视频内容生成，每条回答都带来源引用（视频名 + 时间戳）；知识库无依据时会明确告知。
        </NAlert>
      </NSpace>
    </NCard>

    <NSpin :show="loading" style="margin-top: 16px">
      <NEmpty v-if="!history.length" description="还没有提问记录" />

      <NSpace v-else vertical :size="14">
        <NCard v-for="(h, i) in history" :key="i" size="small">
          <template #header>
            <span style="font-weight: 600; color: #2563eb">Q</span>
            <span style="margin-left: 8px">{{ h.q }}</span>
          </template>

          <div style="font-size: 14px; line-height: 1.9; color: #1e293b; white-space: pre-wrap">
            {{ h.r.answer_text }}
          </div>

          <NAlert v-if="h.r.note === 'no_evidence'" type="warning" :bordered="false" size="small" style="margin-top: 10px">
            知识库中无依据，建议先入库相关视频。
          </NAlert>

          <template v-if="h.r.citations?.length">
            <div style="margin-top: 12px; font-size: 12px; color: #94a3b8">
              引用 {{ h.r.citations.length }} 条
            </div>
            <NSpace :size="6" style="margin-top: 6px">
              <NTag
                v-for="(c, ci) in h.r.citations"
                :key="ci"
                size="small"
                type="success"
                :bordered="false"
                style="cursor: default"
              >
                [{{ c.start_ts_fmt }}] {{ c.title?.slice(0, 16) }}
              </NTag>
            </NSpace>

            <NCollapse style="margin-top: 10px">
              <NCollapseItem title="查看引用原文" size="small">
                <NSpace vertical :size="10">
                  <div v-for="(c, ci) in h.r.citations" :key="ci" style="font-size: 13px; line-height: 1.7">
                    <div style="color: #64748b; margin-bottom: 2px">
                      【{{ c.title }}】{{ c.start_ts_fmt }} - {{ c.end_ts_fmt }}
                    </div>
                    <div style="color: #334155; background: #f8fafc; padding: 8px; border-radius: 4px; white-space: pre-wrap">
                      {{ c.quote }}
                    </div>
                  </div>
                </NSpace>
              </NCollapseItem>
            </NCollapse>
          </template>
        </NCard>
      </NSpace>
    </NSpin>
  </div>
</template>
