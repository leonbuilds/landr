# 详情页 JD 二次抓取 — 设计文档

日期: 2026-05-03
分支: `feat/job-detail-jd`
前序 PR: #2 (AI 自主搜岗位)

## 背景

PR #2 把 Boss 列表页采集打通了，但列表 extractor 只抓 `title / company / salary / url`，**`Job.jdText` 是空字符串**。
匹配 Prompt (`/api/resumes/:id/match`) 拿空 JD 跑 LLM，匹配分基本是噪音。
用户体感"功能在跑、结果不可信"——这是从"可演示"到"可用"之间最大的一个洞。

## 目标

- 搜任务终态后，自动给本次新入库的 Boss 岗位补全完整 JD
- 不阻塞匹配：列表片段先作摘要兜底，详情抓失败保留摘要
- 不踩 Boss 风控：串行 + 节流 + 连失败冷却

## 非目标 (YAGNI)

- 多平台（只 Boss）
- 手动重抓按钮
- 失败重试
- 优先级 / 标星先抓
- 详情页里的"立即沟通"自动化 (L3，已明确不做)

## 数据模型

新模型 `JdFetchTask`，不污染 `SearchTask`：

```prisma
model JdFetchTask {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobId     Int      @unique
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  status    String   @default("pending") // pending | running | done | failed
  error     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, status])
}
```

`@unique jobId` 保证一个 job 永远只排一次队 (后端入队时用 `upsert`)。

`Job` 表不动。

`extractList` 在 `extension/content/extractors/boss.js` 增取 job-card 内的福利标签 / 一行简介，拼成短 jdText 入库 (摘要兜底)。

## 数据流

```
SearchTask.PATCH(status=done, jobs=[...])
  └─ /api/jobs/search-tasks/:id PATCH
     └─ 写入 Job (jdText = list snippet)
        └─ for each job (platform=boss, url 非空):
             prisma.jdFetchTask.upsert({ jobId, status: pending })

[扩展 SW 30s 轮询]
  GET /api/jd-fetch-tasks/pending  (X-API-Key)
  → null | { id, jobId, url }   单条 FIFO
     ├ atomic flip pending → running (where status=pending)
     ├ 同 user 已有 running JdFetchTask 或 SearchTask → 返回 null (lock)
     └ 连续 3 条 failed (近 10 分钟) → 30 分钟 cool-off, 返回 null

  SW 拾到一条:
    chrome.tabs.create(url, active:false)
    wait page hydrate (3s) + DOMContentLoaded
    sendMessage(AUTO_COLLECT_DETAIL)
    content/content.js 调 boss extractor.extractDetail()
    chrome.tabs.remove(tab)
    PATCH /api/jd-fetch-tasks/:id { status: done, jdText }
       └─ 后端 update Job.jdText (覆盖摘要)
    sleep 4s 防风控
    再轮询下一条
```

失败路径：

```
extract 拿到空 jdText / hydrate 超时 30s / tab 异常关闭
  → PATCH { status: failed, error: "..." }
     └─ Job.jdText 不动 (摘要保留)
```

## API

| Method | Path | Auth | 用途 |
|---|---|---|---|
| GET | `/api/jd-fetch-tasks/pending` | X-API-Key | SW 拾取下一条 |
| PATCH | `/api/jd-fetch-tasks/:id` | X-API-Key | SW 回传 done / failed |
| GET | `/api/jd-fetch-tasks` | JWT (cookie) | UI 查进度 (可选, 第一版只在搜任务页展示统计) |

`pending` 端点返回结构:
```json
{ "id": 1, "jobId": 42, "url": "https://www.zhipin.com/job_detail/..." }
```
或 `null` (无任务 / 锁中 / 冷却中)。

## 风控边界

| 项 | 值 | 理由 |
|---|---|---|
| 同 user 同时 running | ≤ 1 | 串行，跟 SearchTask 互斥 |
| 单条间隔 | 4s sleep | 防 Boss 行为指纹 |
| 连续失败冷却阈 | 3 条 / 10 min | 触发即 30 分钟暂停 |
| 单 user pending 上限 | 50 | 入队时超限丢弃 |
| 单条 hydrate 超时 | 30s | 失败而非永等 |

## UI 改动

最小化:
- 抽屉 / `/jobs/[id]` JD 区: 若该 job 有 pending/running JdFetchTask, 显示灰色 banner "JD 抓取中…"
- `/jobs` AI 搜任务列表: 终态搜任务下方多一行 "JD 补全 N/M" (N=已 done 的 fetch task 数, M=该批次总数)。第一版只展示, 不可点

## 验证

### 单元测试 (vitest)
- `pending` 路由: pending → running 原子翻转
- `pending` 路由: 已有 running 时返回 null
- `pending` 路由: cool-off 窗口
- 入队: 重复 jobId upsert 不创建第二条

### Playwright E2E (`scripts/verify-jd-fetch.ts`)
1. 注册 + 配 key
2. 直接 seed 3 条 Boss job (绕过搜任务, 节省时间) + 给它们各塞一条 JdFetchTask pending
3. 加载真实扩展, SW 轮询
4. 断言:
   - 3 条 task 终态在 60s 内
   - 至少 1 条 done (在 Playwright Chrome 被 Boss 反爬阻挡时, 整批可能全 failed —— 这种情况下断言放宽: 终态即可, error 信息含"超时/反爬")
   - done 的 Job.jdText 长度 > 摘要长度 (摘要 ~50 字, 完整 JD 通常 > 300 字)

### 真实 Chrome 验证 (Computer-use / Chrome MCP)
本次必须做:
- 加载 `extension/` 到本地用户 Chrome
- 登录 Boss
- 走完一遍搜任务 → 等 SW 自动补 JD → 截图抽屉里看到完整 JD

## 风险 & 缓解

| 风险 | 缓解 |
|---|---|
| Boss 加新指纹检测 | cool-off + 节流 + 失败保留摘要不阻塞匹配 |
| Boss 详情页改版 | extractor 已有 JSON-LD fallback + 多 selector |
| 用户关浏览器, SW 任务卡 running | 复用 PR #2 的 3min stale sweep 机制 |
| 50 条上限对重度用户不够 | YAGNI, 后续按 status 优先级再说 |

## 不变量

- 一个 `Job` 的生命周期内最多一条 `JdFetchTask` (upsert 强制)
- `JdFetchTask` 状态机: pending → running → (done | failed), 终态不再改
- 失败永远不回写 `Job.jdText`

## 第二版可加

(放这里只为不忘, 当前不做)

- 手动"重抓 JD"按钮 (失败任务 / 老 job)
- 多平台: LinkedIn / 拉勾 / 智联 detail extractor 已有, 加 platform 路由即可
- 优先级: 看板里已变 applied 的 job 优先, 防匹配分滞后
- 失败一次自动重试 (隔 1h)

## 验收标准

- [ ] vitest 18+ tests pass
- [ ] lint exit 0
- [ ] build 36+ routes 全编
- [ ] `verify-jd-fetch.ts` 全部断言过
- [ ] 真实 Chrome 走通: 搜任务 done 后 5 分钟内, Job.jdText 至少有 1 条被升级到 > 300 字
- [ ] PR 描述含截图: 抓取中态 + 抓完后抽屉里完整 JD
