# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AgentFlow - macOS 桌面应用，用于监控 AI 编码助手（Claude Code、Codex、OpenClaw 等）的使用时长和会话。基于 Electron + React + Express 构建。

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发模式（Express 服务器 + Vite 热重载） |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run lint` | TypeScript 类型检查（`tsc --noEmit`） |
| `npm run electron:dev` | Electron 开发模式（同时启动 Web 和 Electron） |
| `npm run electron` | 直接运行 Electron（需先 build） |
| `npm run dist` | 打包 Electron 应用（输出到 `build/`） |

## 架构

### 技术栈
- **前端**: React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Motion
- **后端**: Express.js（端口 3001，单文件 `server.ts`）
- **桌面**: Electron（macOS），主进程入口 `main.js`
- **存储**: Dexie.js（IndexedDB），用于会话数据持久化
- **AI**: Gemini API（`@google/genai`）

### 双进程模型

**主进程** (`main.js`): Electron 窗口管理，加载 `dist/index.html`，通过 `preload.js` 桥接。

**渲染进程** (`src/`): React 应用，通过 fetch 调用本地 Express API。

### 前后端通信

前端每 2 秒轮询 `GET /api/active-process` 获取当前前台应用，后端使用 `osascript` 和 `pgrep` 检测 macOS 进程。非 macOS 环境返回模拟数据（`simulated: true`）。

`server.ts` 中的 `AppStatusManager` 类封装所有 macOS 进程操作：
- 检测前台应用、检查应用是否运行/安装
- 启动/关闭应用、测量启动时间
- 检查 Claude Code CLI 状态

### 核心模块

| 文件/目录 | 职责 |
|-----------|------|
| `server.ts` → `server.cjs` | Express API 服务器，macOS 进程监控 |
| `src/App.tsx` | 主应用，管理标签页状态和实时进程轮询 |
| `src/types.ts` | 核心类型：`Session`、`AIService`、`DailyStats` |
| `src/lib/db.ts` | Dexie 数据库定义（sessions 表） |
| `src/components/` | 5 个视图组件：ActiveSession、Dashboard、History、Navigation、Settings |

数据流：`mapProcessToService()` 将进程名映射为 AI 服务名 → 会话数据存储到 IndexedDB → 通过 `useLiveQuery` 实时响应。

### 环境变量

- `GEMINI_API_KEY` - Gemini API 密钥，通过 Vite `loadEnv` 注入到 `process.env.GEMINI_API_KEY`
- 参考 `.env.example` 配置 `.env.local`（已在 `.gitignore` 中）

## 注意事项

- 编辑 `server.ts` 后需重新编译为 `server.cjs`（生产环境使用），开发时可用 `tsx server.ts` 直接运行
- `server.ts` 中 `AppStatusManager` 对特殊应用名（Trae CN、QClaw）有硬编码处理
- Electron 生产构建读取 `dist/index.html`，确保先执行 `npm run build`
- 进程检测仅在 macOS 有效，其他平台返回模拟数据
- Vite 配置中 `base: './'` 用于 Electron 相对路径加载
