<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NConfigProvider, NLayout, NLayoutSider, NLayoutContent, NLayoutHeader, NMenu,
  NMessageProvider, zhCN, dateZhCN,
} from 'naive-ui'
import type { MenuOption } from 'naive-ui'

const route = useRoute()
const router = useRouter()
const collapsed = ref(false)

function renderIconEmoji(emoji: string) {
  return () => h('span', { style: 'font-size: 16px' }, emoji)
}

const menuOptions: MenuOption[] = [
  { label: '任务台', key: '/tasks', icon: renderIconEmoji('🎬') },
  { label: '知识库', key: '/library', icon: renderIconEmoji('📚') },
  { label: '问答', key: '/ask', icon: renderIconEmoji('💬') },
]

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
            视频知识库 V0.3
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
