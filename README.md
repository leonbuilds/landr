<div align="center">

# Landr

### **Land the job. — AI 求职 Agent**

**简历理解 → 岗位匹配 → 面试准备 → 智能投递**
**One agent for the entire job-hunting workflow.**

[![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[功能](#-核心功能) · [快速开始](#-快速开始) · [浏览器扩展](#-浏览器扩展) · [部署](#-部署) · [Roadmap](#-roadmap)

</div>

---

## 📖 项目介绍

**Landr** 是一款面向求职者的**全链路智能助手**,把"找工作"这件事拆成可被 LLM 自动化的若干环节,并用一套连贯的 Agent 工作流串起来:

```
[上传简历] → [AI 三维度诊断] → [抓取/录入岗位] → [简历-岗位匹配评分]
                                                  ↓
[一键投递] ← [申请追踪看板] ← [面试题生成] ← [求职信生成]
```

不只是 prompt 套壳,还覆盖了真实求职场景里的**脏活**:岗位列表只有摘要怎么办、Boss 直聘风控怎么躲、多平台 JD 字段怎么对齐、申请状态怎么跟踪——都内置了工程化方案。

---

## ✨ 核心功能

### 🧠 简历智能体
- **多格式上传**:PDF / Word / 纯文本,服务端用 `pdf2json` + `pdfjs-dist` 解析
- **AI 三维度诊断**:结构 / 内容 / 关键词,SVG 仪表盘可视化评分,附**修改建议**
- **隐私保护**:支持本地化部署,简历内容不出你的服务器

### 🎯 岗位智能体
- **手动录入**:粘贴 JD,AI 自动结构化(职位 / 公司 / 要求 / 关键词)
- **浏览器扩展自动采集**:一键采集 Boss 直聘等平台列表 + 详情页 JD
- **JD 二次抓取**:列表只有 18-20 字摘要时,后台自动开 tab 抓取详情页 JSON-LD,**让匹配分可信**

### 🎨 匹配与重写
- **匹配度评分**:基于简历 × JD,返回综合分数 + 关键词标签(绿/红/黄)
- **AI 重写建议**:针对薄弱项,给出 STAR 式改写示例
- **求职信生成**:三种语气(正式 / 自信 / 真诚),一键复制

### 💬 面试准备
- **题目生成**:行为题 / 情景题 / 技术题
- **STAR 答案展开**:Situation · Task · Action · Result 四段式参考答案

### 📊 申请追踪
- **7 列拖拽看板**:`@dnd-kit` 驱动 · 已投 / 沟通中 / 笔试 / 一面 / 二面 / Offer / 已拒
- **状态变更日志**:每次拖拽自动记录时间线
- **数据看板**:投递趋势柱状图、转化漏斗、5 个核心指标卡
- **CSV 导出**:申请记录一键导出

### 🔌 LLM 适配层
- 支持 OpenAI 兼容协议:**DeepSeek / Kimi / 通义千问 / OpenAI** 任选
- API Key 服务端 **AES-256 加密存储**
- 模型配置可视化:在「设置」页随时切换

---

## 🛠 技术栈

| 分层 | 技术 |
|---|---|
| **前端** | Next.js 16 · React 19 · TypeScript 5 · Tailwind v4 · shadcn/ui · Radix |
| **后端** | Next.js Route Handlers · Prisma ORM · SQLite |
| **AI** | OpenAI SDK(OpenAI 兼容协议)· DeepSeek / Kimi / 通义千问 |
| **认证** | JWT · bcryptjs · 用户级数据隔离(中间件强制注入 userId) |
| **加密** | AES-256-GCM API Key 加密存储 |
| **测试** | Vitest 26+ tests · Playwright e2e |
| **扩展** | Chrome Extension MV3 · Service Worker + Content Script |
| **部署** | PM2 · 阿里云 ECS(也可 Vercel / 自建) |

---

## 🚀 快速开始

### 环境要求
- Node.js **≥ 20**(推荐 20 / 22 / 23)
- pnpm / npm / yarn 任选

### 本地开发

```bash
# 1. clone & 装依赖
git clone https://github.com/liangliang125977/landr.git
cd landr
pnpm install

# 2. 初始化数据库
cp .env.example .env       # 填入 JWT_SECRET / ENCRYPTION_KEY
pnpm prisma migrate dev    # 生成 dev.db

# 3. 启动开发服务器
pnpm dev
# → http://localhost:3000
```

首次注册账号后,在「设置」页填入你的 LLM API Key(DeepSeek / Kimi / 通义千问任选),即可解锁全部 AI 功能。

### 测试

```bash
pnpm test          # vitest 单测
pnpm test:watch    # watch 模式
pnpm lint          # ESLint
```

---

## 🧩 浏览器扩展

`/extension` 目录是一个独立的 Chrome MV3 扩展,负责把"打开 Boss 直聘 → 收集岗位"这个原本 30 分钟的人工劳动压到 **1 分钟**。

### 安装

1. Chrome 打开 `chrome://extensions`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」,选择本仓库的 `extension/` 目录
4. 在扩展的「选项」页,填入你的 Landr 主站地址(默认 `http://localhost:3000`)与登录 Token

### 工作原理

```
搜索任务(主站) → SearchTask 入库 → SW 轮询 → 打开 Boss 列表 tab
                                              ↓
                                    采集列表(职位/公司/摘要)
                                              ↓
                          摘要 < 30 字 → 入队 JdFetchTask
                                              ↓
                          后台开详情页 tab → JSON-LD 抓真实 JD
                                              ↓
                                   PATCH 回主站 → Job.jdText 升级
```

详细设计见 [`docs/plans/`](docs/plans/)。

---

## 🚢 部署

### PM2 + 阿里云 ECS(推荐)

```bash
pnpm build
pm2 start ecosystem.config.cjs
pm2 logs landr
```

`ecosystem.config.cjs` 已配置好实例数 / 日志路径 / 环境变量加载。

### Vercel(零配置)

直接 import 本仓库 → 设置环境变量(`JWT_SECRET` / `ENCRYPTION_KEY` / `DATABASE_URL`)→ Deploy。
注意 SQLite 在 Vercel Serverless 不持久,生产环境建议切换到 Postgres / Turso / PlanetScale。

---

## 📁 项目结构

```
landr/
├── app/                  # Next.js App Router · 页面 + Route Handlers
├── extension/            # Chrome MV3 扩展(独立模块)
│   ├── background/       # Service Worker:SearchTask + JdFetchTask 轮询
│   ├── content/          # Content Script:Boss / 拉勾 / 智联 列表 + 详情 extractor
│   ├── options/          # 配置页(API endpoint + token)
│   └── popup/            # 工具栏弹窗
├── prisma/
│   └── schema.prisma     # 6 模型:User / Resume / Job / Application / SearchTask / JdFetchTask
├── docs/
│   ├── plans/            # 设计 / 验证文档
│   └── screenshots/      # 演示截图
├── scripts/              # 部署 + e2e 验证脚本
├── public/
└── ecosystem.config.cjs  # PM2 配置
```

---

## 🗺 Roadmap

### ✅ 已完成
- 简历 CRUD + 三维度 AI 诊断
- 岗位 CRUD + AI 解析 + 列表/详情双抓取
- 简历-岗位匹配评分 + 重写建议
- 求职信 / 面试题生成
- 申请追踪看板(7 状态)+ 转化漏斗
- Chrome 扩展自动采集 + JD 二次抓取
- 多 LLM 适配 + API Key 加密

### ⏳ 计划中
- 多平台详情 extractor(LinkedIn / 拉勾 / 智联)
- 失败任务手动「重抓 JD」按钮
- 失败一次自动重试(隔 1h)
- 优先级队列(看板 applied 状态优先)
- Postgres / Turso 生产数据源切换

### ❌ 不做(明确)
- Boss 自动打招呼 / 自动投递(风控线)
- 帮你 P 简历或刷工作经历
- 简历内容上传到非你自己的 LLM provider

---

## 📜 License

MIT © [liangliang125977](https://github.com/liangliang125977)

---

## 🔗 相关链接

- **作者**:阿亮 · 一线 AI Agent 工程师 · vibe coding 实战派
- **品牌**:[与智行 · YuZhiXing](https://github.com/liangliang125977) — AI 工程化训练营 · 大模型咨询落地
- **报告 issue**:[GitHub Issues](https://github.com/liangliang125977/landr/issues)

> **Landr** 是与智行 (YuZhiXing) 案例库中的旗舰开源项目,
> 展示如何用同一套 SPEC + 检查点 + Skills 工程方法论,
> 把一个 vibe coding 想法做到上线、可维护、可商业化。
