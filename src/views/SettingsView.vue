<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NCard, NForm, NFormItem, NInput, NButton, NSpace, NAlert, NTag, NSpin, NText,
} from 'naive-ui'
import { api } from '../api/client'

const sfKey = ref('')
const lcKey = ref('')
const states = ref<Record<string, { configured: boolean; masked: string }>>({})
const saving = ref(false)
const loading = ref(true)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

async function load() {
  loading.value = true
  try {
    const r = await api.getSettings()
    states.value = r.keys
  } catch (e: unknown) {
    message.value = '读取配置失败：' + ((e as Error).message || '未知错误')
    messageType.value = 'error'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  message.value = ''
  try {
    const r = await api.saveSettings(sfKey.value.trim(), lcKey.value.trim())
    states.value = r.keys
    sfKey.value = ''
    lcKey.value = ''
    if (r.saved) {
      message.value = `已保存并生效（更新：${(r.changed || []).join('、')}）。新任务立即可用；失败任务点「重新运行」即可续跑。`
      messageType.value = 'success'
    } else {
      message.value = r.detail || '未提交任何修改'
      messageType.value = 'error'
    }
  } catch (e: unknown) {
    message.value = '保存失败：' + ((e as Error).message || '未知错误')
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div style="max-width: 760px; margin: 0 auto">
    <NAlert type="info" title="配置说明" style="margin-bottom: 16px">
      模型 API Key 用于视频转写（SenseVoice）与画面识别 / 摘要 / skill 蒸馏（LongCat）。
      Key 保存到本机 <NText code>.env</NText>，不会上传到任何服务器；保存后立即生效，无需重启。
      支持混搭：两个 Key 可以是不同厂商。
      <div style="margin-top: 6px">
        硅基流动 Key：<a href="https://cloud.siliconflow.cn" target="_blank" rel="noreferrer">cloud.siliconflow.cn</a>
        （以 sk- 开头）　LongCat Key：<a href="https://longcat.chat" target="_blank" rel="noreferrer">longcat.chat</a>
      </div>
    </NAlert>

    <NCard title="模型 API Key">
      <NSpin :show="loading">
        <NForm label-placement="left" label-width="150">
          <NFormItem label="硅基流动 Key">
            <NSpace vertical style="width: 100%">
              <NInput
                v-model:value="sfKey"
                type="password"
                show-password-on="click"
                placeholder="sk-...（留空 = 不修改）"
              />
              <NTag v-if="states.SILICONFLOW_API_KEY?.configured" size="small" type="success" :bordered="false">
                已配置：{{ states.SILICONFLOW_API_KEY.masked }}
              </NTag>
              <NTag v-else size="small" type="warning" :bordered="false">未配置（视频转写不可用）</NTag>
            </NSpace>
          </NFormItem>

          <NFormItem label="LongCat Key">
            <NSpace vertical style="width: 100%">
              <NInput
                v-model:value="lcKey"
                type="password"
                show-password-on="click"
                placeholder="留空 = 不修改"
              />
              <NTag v-if="states.LONGCAT_API_KEY?.configured" size="small" type="success" :bordered="false">
                已配置：{{ states.LONGCAT_API_KEY.masked }}
              </NTag>
              <NTag v-else size="small" type="warning" :bordered="false">未配置（画面识别 / 摘要 / skill 不可用）</NTag>
            </NSpace>
          </NFormItem>

          <NFormItem label=" ">
            <NButton type="primary" :loading="saving" @click="save">保存</NButton>
          </NFormItem>
        </NForm>

        <NAlert v-if="message" :type="messageType" style="margin-top: 12px">
          {{ message }}
        </NAlert>
      </NSpin>
    </NCard>
  </div>
</template>
