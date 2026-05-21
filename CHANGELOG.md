# CHANGELOG.md

## 2026-05-02 Session (Phase 1 MVP Init)

### 完成
- [x] 项目脚手架：Next.js 16 + TypeScript + Tailwind CSS + shadcn-style UI components
- [x] 数据库：Prisma + SQLite，6个模型（User, Resume, Job, Application, StatusLog, Setting）
- [x] 用户认证：注册、登录、JWT签发验证、bcryptjs密码哈希
- [x] 数据隔离：所有API Route通过auth中间件注入userId，查询强制过滤
- [x] 简历管理：上传（PDF/Word/文本）、解析、CRUD API、列表页
- [x] AI简历诊断：三维度评分（结构/内容/关键词）+ 修改建议，SVG仪表盘可视化
- [x] 岗位管理：JD输入、AI解析、列表+详情页
- [x] 简历-岗位匹配：匹配度评分 + 绿/红/黄关键词标签 + AI重写建议
- [x] 设置页：API Key加密存储（AES-256）、模型选择、密码修改、账号删除
- [x] LLM适配层：OpenAI兼容SDK，支持DeepSeek/Kimi/通义千问

## 2026-05-02 Phase 2 Complete

### 完成
- [x] 求职信生成API + UI（三种语气：正式/自信/真诚）
- [x] 面试准备题生成API + UI（行为/情景/技术题 + STAR答案展开）
- [x] 申请追踪看板（@dnd-kit拖拽、7列状态流转）
- [x] 数据统计仪表盘（投递趋势柱状图、转化漏斗、5个统计卡片）
- [x] 应用详情API（状态变更日志）
- [x] Edge cases: 空状态、权限拦截、错误提示

## 2026-05-02 Phase 3

### 完成
- [x] CSV数据导出（申请记录导出为CSV文件）
- [x] Turbopack配置修复（root目录警告消除）
- [x] 所有页面完整错误处理（401/403/404/500状态覆盖）
- [x] API Key加密存储、数据脱敏显示

### 完成
- [x] 单元测试：18 tests pass (auth, crypto, ai) via vitest
- [x] 浏览器岗位采集API（支持URL抓取 + 页面内容直接解析）
- [x] jest → vitest迁移（Node v23兼容）
- [x] `/api/jobs/scrape` 端点：提交招聘页面URL或HTML内容，AI自动提取岗位并存入岗位库

### 部署
- `ecosystem.config.cjs` — PM2配置（阿里云ECS）
- `npm run build && pm2 start ecosystem.config.cjs`

## 2026-05-03 详情页 JD 二次抓取 (`feat/job-detail-jd`)

### 痛点
PR #2 后, AI 搜来的 Boss 岗位 `Job.jdText` 只有列表摘要 (18-20 字), 匹配
prompt 拿空 JD 跑 LLM 出来的分基本是噪音 — 功能在跑但结果不可信.

### 完成
- [x] 新模型 `JdFetchTask` (一 job 一条 upsert, `@@index([userId,status])`)
- [x] `enqueueJdFetch(userId, candidates)` + 8 单测: 上限 50 / 非 Boss 跳过 / 空 url 跳过 / 冷却判定 / stale-running sweep
- [x] SearchTask done 时自动入队新 jobs (失败 swallow, 非关键路径)
- [x] `extractList` 列表片段兜底 (.tag-list / .info-desc / .job-area)
- [x] `/api/jd-fetch-tasks/pending` GET — 原子翻转 pending → running + 同 user JdFetchTask/SearchTask running 锁 + 30min cool-off (3 失败/10min)
- [x] `/api/jd-fetch-tasks/:id` PATCH — done 事务里升级 Job.jdText, jdText < 30 字 coerce 为 failed (不覆盖摘要)
- [x] 扩展 SW 同 alarm 触发 search + jd-fetch 轮询, 互斥跑, 4s 节流, console.log 详细日志
- [x] content/content.js 加 `AUTO_COLLECT_DETAIL` 消息处理
- [x] boss extractor 鲁棒化: JSON-LD 长度门槛 + 多 fallback 选择器 + 启发式找含"职位描述/岗位职责"的最大文本块
- [x] 抽屉 / `/jobs/[id]` 抓取中态 banner + 15s 自动刷新, 失败灰色 banner

### 验证
- [x] vitest 26/26 pass (新增 jd-fetch 8 项)
- [x] lint exit 0
- [x] build 36 routes 全编 (新增 /api/jd-fetch-tasks/pending + /api/jd-fetch-tasks/[id])
- [x] `scripts/verify-jd-fetch.ts` API e2e 18/18 断言: 原子翻转/锁/冷却/jdText 升级/failed 保留摘要/coerce 短 jdText
- [x] **真机 Chrome 端到端**: SearchTask done → 自动入队 14 条 → SW 拾取 → 后台 active:false 开 tab → extractor 拿 JSON-LD JobPosting → PATCH 回传 → 5 done (jdText 18-20 字 → 344-534 字真实 JD), 3 failed (cool-off 触发, 设计如此), 6 pending. 详见 `docs/plans/2026-05-03-job-detail-jd-verification.md`

### 顺手修
- [x] PR #2 c10c877 带进的祖传 bug: `extension/content/boss-apply.js` 中文字符串里 ASCII `"` 误终止字符串导致 SW 加载失败 (ce reload 前一直没暴露)
- [x] `.gitignore` 屏蔽 `scripts/_*` `docs/screenshots/mockup-*` (避免 `git add -A` 扫到外部 scratch 资产)

### 不在本期
- 多平台 detail extractor (LinkedIn/拉勾/智联) — 已有列表 extractor, 加路由即可
- 手动"重抓 JD"按钮 (失败任务 / 老 job)
- 失败一次自动重试 (隔 1h)
- 优先级队列 (看板 applied 状态优先)
- L3 自动打招呼 (Boss 风控线明确不踩)

## 2026-05-03 visionOS / Glassmorphism 视觉改版 (`feat/visionos-redesign`)

### 选型
四个候选风格 (D 现代 SaaS / E 新中式编辑 / F visionOS / 混搭) HTML demo 对比, 选 F:
多彩 mesh 光晕 + 玻璃卡片 + 渐变强调色, 区别于满屏 SaaS 工具的同质化观感.

### 完成
- [x] `globals.css` 全套设计 token: bg-elevated/glass-edge/mesh 五色/shadow-glass/语义 hi-med-lo + `.glass` `.glass-strong` `.glass-card` `.gradient-text` `.ring-mesh` 工具类
- [x] body 多色 radial-gradient mesh + SVG 噪点 overlay (visionOS 质感), `background-attachment: fixed`
- [x] `Button` 6 variants 全改: 紫蓝渐变主 CTA / 玫红渐变 destructive / glass outline / 软玻璃 secondary / ghost / link
- [x] `Badge` 7 variants: 渐变默认 + 带边语义 success/warning/danger
- [x] `Card` `Input` `Textarea` 玻璃化, focus-ring 改紫色 mesh
- [x] `Sidebar` 整体玻璃, mesh 渐变 logo + 头像, 等宽 mono 二级标签 (Workspace/Insights/System)
- [x] `JobsPage` 加面包屑 + 渐变标题问候 + 真实空态 glass-card
- [x] `JobCard` 玻璃卡片 + hover translate-y + mono 数字 + 平台标签

### 验证
- [x] vitest 26/26 pass
- [x] lint exit 0
- [x] 5 张 visionOS 截图归档 docs/screenshots/v-*.png

### Simplify 后处理
- [x] `Badge` 移除基类 `backdrop-blur-md` (列表里成倍叠加, 性能负担)
- [x] `JobCard` `transition-all` → `transition-transform` (避免 hover shadow 触发 repaint)
- [x] `JobCard` `JSON.parse(parsedJson)` 包 `useMemo`
- [x] 干掉 `const stats = { total: jobs.length }` 单字段包装
- [x] 删 `// Topbar` `// Greeting` `// Logo` 等 narration 注释
- [x] 删未使用的 `.gradient-bg-primary` 工具类

### 不在本期 (后续 PR)
- 把 `--text` `--muted` `--dim` `--mesh-*` 桥到 `@theme inline`, 让 `text-muted` / `bg-mesh-sky` 成为真 Tailwind 工具类 — 当前到处 `style={{color:"var(--muted)"}}` 是这个缺位的副作用
- `/board` `/jobs/[id]` `/resumes` `/settings` `/extension-setup` + auth 三页迁移 (仍是 `text-gray-*` `bg-white`)
- 共享 UI 原子 `dialog` `dropdown-menu` `select` `tabs` `tooltip` `switch` `scroll-area` `separator` `avatar` 玻璃化
- `Input` / `Textarea` 抽 `.glass-input` 共享类
- `JobCard` 改回用 `<Card>` + `<Badge>` 原子 (本期直接写 `glass-card` div)
