# zhiying-web

知映 zhiying 的 Web 前端（Vue 3 + Vite + Naive UI）。

后端服务：[zhiying](https://github.com/zhiying-platform/zhiying)（Python / FastAPI）。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:5273（/api 代理到 127.0.0.1:8600）
```

先启动后端：

```bash
cd ../zhiying
.venv\Scripts\python -m zhiying.api    # 127.0.0.1:8600
```

## 页面

| 路由 | 页面 | 对应 PRD |
|---|---|---|
| `/tasks` | 任务台：粘贴链接 → 提交 → 实时进度 → 失败重试 | J1 / FR-303 |
| `/library` | 知识库：视频列表、主题标签筛选、摘要与分段浏览 | J2 |
| `/ask` | 问答：提问 → 答案 + 时间戳引用 | J3 / FR-204 |
| `/docs` | 文档库：md / skill 产物管理（不依赖知识库组件） | J4 |
| `/settings` | 设置：模型 API Key（保存后同步 .env + 进程环境 + 注册表） | FR-105 |

> 知识库组件可选：安装器精简安装（不含 PostgreSQL）时 `/library` `/ask` 隐藏，菜单按 `/api/config` 的 `kbAvailable` 渲染（结果缓存，未知态只渲染基础菜单防闪现）。

## 品牌资源

侧栏展开态用横版 Logo（`src/assets/logo-full.svg`），折叠态与 favicon 用印章（`src/assets/logo.svg` / `public/favicon.svg`），均与后端仓 `assets/logo/final/` 同源。菜单图标用内联 SVG 组件 `src/components/Icon.vue`（Lucide 风格，零依赖）。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_API_BASE` | `/api` | 浏览器侧 API 前缀（生产可指向完整域名） |
| `VITE_API_TARGET` | `http://127.0.0.1:8600` | 开发代理目标 |

## 构建

```bash
npm run build    # 产物在 dist/，可托管到任意静态服务器
```

## 架构约定

- 只通过 REST API 与后端通信，不共享任何代码
- API 契约以 FastAPI 的 `/openapi.json` 为准
- 进度用轮询（3–5s），单用户场景不需要 SSE

## License

MIT
