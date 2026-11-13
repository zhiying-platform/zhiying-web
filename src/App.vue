<script setup lang="ts">
import { computed, h, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NConfigProvider, NLayout, NLayoutSider, NLayoutContent, NLayoutHeader, NMenu,
  NMessageProvider, zhCN, dateZhCN,
} from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { api, type AppConfig } from './api/client'

const route = useRoute()
const router = useRouter()
const collapsed = ref(false)

// 能力标志（V1.3）：null=未知（首帧）；true 才显示知识库/问答，
// 避免「先渲染后消失」的闪现；结果写 localStorage，再次打开首帧即正确
const cfg = ref<AppConfig | null>(null)
const kbAvailable = ref<boolean | null>(
  localStorage.getItem('zhiying_kb') === null ? null : localStorage.getItem('zhiying_kb') === '1',
)

onMounted(async () => {
  try {
    cfg.value = await api.config()
    kbAvailable.value = cfg.value.kb_available
    localStorage.setItem('zhiying_kb', cfg.value.kb_available ? '1' : '0')
  } catch {
    // 后端未起：保持未知态（仅基础菜单），各视图自己的报错 UI 生效
  }
})

// 深链守卫：已停在知识库/问答页时切到精简模式 → 自动跳转文档库
watch(kbAvailable, (v) => {
  if (v === false && ['/library', '/ask'].includes(route.path)) router.push('/docs')
})

function renderIconEmoji(emoji: string) {
  return () => h('span', { style: 'font-size: 16px' }, emoji)
}

const menuOptions = computed<MenuOption[]>(() => {
  const items: MenuOption[] = [
    { label: '任务台', key: '/tasks', icon: renderIconEmoji('🎬') },
    { label: '文档库', key: '/docs', icon: renderIconEmoji('📄') },
  ]
  if (kbAvailable.value === true) {
    items.push({ label: '知识库', key: '/library', icon: renderIconEmoji('📚') })
    items.push({ label: '问答', key: '/ask', icon: renderIconEmoji('💬') })
  }
  return items
})

const activeKey = computed(() => route.path)
const pageTitle = computed(() => (route.meta.title as string) || '')

function onMenu(key: string) {
  router.push(key)
}
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="{ common: { primaryColor: '#2563eb' } }">
    <NMessageProvider>
      <NLayout position="absolute" has-sider>
        <!-- 侧边栏 -->
        <NLayoutSider
          v-model:collapsed="collapsed"
          bordered
          :width="200"
          :collapsed-width="64"
          collapse-mode="width"
          show-trigger
          style="background: #fff"
        >
          <div style="padding: 20px 20px 12px; display: flex; align-items: baseline; gap: 8px; white-space: nowrap; overflow: hidden">
            <span style="font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #1e293b">知映</span>
            <span v-if="!collapsed" style="font-size: 12px; color: #94a3b8">zhiying</span>
          </div>
          <NMenu
            :options="menuOptions"
            :value="activeKey"
            :indent="24"
            :collapsed="collapsed"
            :collapsed-width="64"
            :collapsed-icon-size="20"
            @update:value="onMenu"
          />
          <div style="position: absolute; bottom: 16px; padding: 0 20px; font-size: 12px; color: #cbd5e1">
            {{ cfg ? `视频知识库 v${cfg.version}` : '视频知识库' }}
          </div>
        </NLayoutSider>

        <!-- 主区 -->
        <NLayout>
          <NLayoutHeader
            bordered
            style="height: 52px; display: flex; align-items: center; padding: 0 24px; background: #fff"
          >
            <span style="font-size: 16px; font-weight: 600; color: #334155">{{ pageTitle }}</span>
          </NLayoutHeader>
          <NLayoutContent content-style="padding: 24px; min-height: calc(100vh - 52px)">
            <RouterView />
          </NLayoutContent>
        </NLayout>
      </NLayout>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}
body {
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  background: #f1f5f9;
}
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
</style>
