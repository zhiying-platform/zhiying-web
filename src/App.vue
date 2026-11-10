<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NConfigProvider, NLayout, NLayoutHeader, NLayoutContent, NMenu, NMessageProvider, zhCN, dateZhCN } from 'naive-ui'
import type { MenuOption } from 'naive-ui'

const route = useRoute()
const router = useRouter()

const menuOptions: MenuOption[] = [
  { label: '任务台', key: '/tasks' },
  { label: '知识库', key: '/library' },
  { label: '问答', key: '/ask' },
]

const activeKey = computed(() => route.path)

function onMenu(key: string) {
  router.push(key)
}
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="{ common: { primaryColor: '#2563eb' } }">
    <NMessageProvider>
      <NLayout position="absolute">
        <NLayoutHeader bordered style="height: 56px; display: flex; align-items: center; padding: 0 24px; gap: 32px">
          <div style="display: flex; align-items: baseline; gap: 8px">
            <span style="font-size: 18px; font-weight: 600; letter-spacing: 1px">知映</span>
            <span style="font-size: 12px; color: #94a3b8">zhiying</span>
          </div>
          <NMenu
            mode="horizontal"
            :options="menuOptions"
            :value="activeKey"
            responsive
            @update:value="onMenu"
          />
          <div style="margin-left: auto; font-size: 12px; color: #94a3b8">
            视频知识库 · V0.3
          </div>
        </NLayoutHeader>
        <NLayoutContent content-style="padding: 20px 24px">
          <RouterView />
        </NLayoutContent>
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
  background: #f8fafc;
}
</style>
