# 详情页 JD 二次抓取 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 AI 搜来的 Boss 岗位的 `Job.jdText` 从空字符串/列表摘要升级为详情页完整 JD，让匹配度评分变得可信。

**Architecture:** 新增 `JdFetchTask` 模型（一 job 一条），后端在 SearchTask done 时自动入队，浏览器扩展 SW 复用现有 30s 轮询模式拾取 → 后台开 detail tab → 调已有 boss extractor `extractDetail()` → PATCH 回传。串行 + 4s 节流 + 连失败 30min 冷却。失败保留摘要兜底，不阻塞匹配。

**Tech Stack:** Prisma (sqlite) / Next.js 16 App Router / TypeScript / Chrome MV3 SW / Playwright + vitest

设计文档: `docs/plans/2026-05-03-job-detail-jd-design.md`

---

## Task 1: Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_jd_fetch_task/migration.sql` (prisma 生成)

**Step 1:** 在 `schema.prisma` `User` 块加 `jdFetchTasks JdFetchTask[]`，`Job` 块加 `jdFetchTask JdFetchTask?`，文件末尾追加 `JdFetchTask` 模型（见 design doc 数据模型节）。

**Step 2:** 生成 migration

```bash
npx prisma migrate dev --name add_jd_fetch_task
```

预期：`✔ Generated Prisma Client`，新建 migration 目录。

**Step 3:** 提交

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): JdFetchTask 模型 — 一 job 一条 JD 抓取任务"
```

---

## Task 2: 入队工具 + 单测

**Files:**
- Create: `src/lib/jd-fetch.ts` — `enqueueJdFetch(userId, jobIds)` 含上限 50、upsert 去重
- Create: `src/__tests__/jd-fetch.test.ts`

**Step 1:** 写测试（TDD），覆盖：upsert 重复 jobId 不创建第二条 / 单 user pending 上限 50 / 非 boss 平台跳过 / url 空跳过。

**Step 2:** 跑测试看红 — `npx vitest run src/__tests__/jd-fetch.test.ts`，预期失败（函数不存在）。

**Step 3:** 实现 `enqueueJdFetch`：查 user 当前 pending 数 → 计算可入数 → 对每个 jobId `prisma.jdFetchTask.upsert`。

**Step 4:** 跑测试看绿。

**Step 5:** 提交 `feat(jd-fetch): 入队工具 + 单测`。

---

## Task 3: SearchTask done 时自动入队

**Files:**
- Modify: `src/app/api/jobs/search-tasks/[id]/route.ts` (PATCH 处理器，写完 Job 之后调 `enqueueJdFetch`)
- Modify: `src/app/api/jobs/route.ts` (POST 写 job 后回返 jobId 给前面 PATCH 用，或在 PATCH 内拿 ids)

**Step 1:** 在 PATCH 写完 jobs 之后拿到所有写入 / 已存在 jobId（去重前已经做过 by url），调 `enqueueJdFetch(userId, allJobIds)`。

**Step 2:** 改 `extension/content/extractors/boss.js` `extractList`：把 job-card 内的 `.tag-list / .info-desc / .job-area` 文本拼成 `jdText` 摘要返回。

**Step 3:** 后端 PATCH 处理器：写入 Job 时若收到 `jdText` 摘要，原样存。

**Step 4:** 跑测试 + lint + build。

**Step 5:** 提交 `feat(search): SearchTask done 时入队 JD 抓取 + 列表摘要兜底`。

---

## Task 4: API 端点 — pending / patch

**Files:**
- Create: `src/app/api/jd-fetch-tasks/pending/route.ts` (GET, X-API-Key)
- Create: `src/app/api/jd-fetch-tasks/[id]/route.ts` (PATCH, X-API-Key)
- Create: `src/__tests__/jd-fetch-tasks-route.test.ts` （覆盖原子翻转 / running 锁 / cool-off）

**Step 1:** 写测试 — pending → running 原子化、user 已有 running 时返回 null、近 10 分钟 ≥ 3 失败时返回 cool-off。

**Step 2:** 跑测试看红。

**Step 3:** 实现 GET `/pending`：

```ts
// 锁: 同 user 已有 running JdFetchTask 或 SearchTask → null
// 冷却: 近 10min failed >= 3 → null
// 拾取: updateMany where {userId, status: pending} take 1, set running, returning row
// 返回 { id, jobId, url } | null
```

**Step 4:** 实现 PATCH `/:id`：接收 `{ status, jdText?, error? }`。done → update `Job.jdText`；failed → 保留。

**Step 5:** 跑测试看绿，跑 build 看类型 OK。

**Step 6:** 提交 `feat(api): jd-fetch-tasks pending/patch + 风控锁 + cool-off`。

---

## Task 5: 扩展 SW — 拾取 + 抓 + 回传

**Files:**
- Modify: `extension/background/service-worker.js` — 加 `pollJdFetch()` 与 search 任务同 alarm 触发
- Modify: `extension/content/content.js` — 加 `AUTO_COLLECT_DETAIL` 消息处理（调 boss extractor `extractDetail()`）

**Step 1:** SW alarm handler 现已轮询 search-tasks/pending；新加同步轮询 `/api/jd-fetch-tasks/pending`。

**Step 2:** 拾到一条 → `chrome.tabs.create({ url, active: false })` → 等 `tabs.onUpdated complete` → 多 sleep 3s hydrate → `chrome.tabs.sendMessage(tabId, { type: 'AUTO_COLLECT_DETAIL' })` → 拿 `{ jdText }`。

**Step 3:** 关 tab → PATCH 回传 → sleep 4s → 再轮询。

**Step 4:** 失败兜底：30s 拿不到 sendMessage 响应 → PATCH failed `{ error: 'detail-timeout' }`。

**Step 5:** 提交 `feat(ext): SW 拾取 JD 抓取任务 + 串行节流`。

---

## Task 6: UI — 抓取中提示 + 任务进度

**Files:**
- Modify: `src/components/board/application-drawer.tsx` — JD 区头加状态行
- Modify: `src/app/jobs/[id]/page.tsx` — 同上
- Modify: `src/components/jobs/auto-search.tsx` — 任务列表终态行下加 "JD 补全 N/M"
- Create: `src/app/api/jd-fetch-tasks/route.ts` — GET 列表（JWT），supply UI 用

**Step 1:** GET 列表端点（仅当前 user 的 pending+running 列表 + 各 job 的 fetch 状态）。

**Step 2:** 抽屉 / 详情页用 `useEffect` 30s 拉一次状态，pending/running 时灰色 banner "JD 抓取中…"。

**Step 3:** auto-search 任务列表终态行：调 `/api/jd-fetch-tasks?searchTaskId=...` 拿统计。最简：直接按 `createdAt` 范围算（搜任务 done 后 5 分钟内入队的属于该批）。

**Step 4:** 提交 `feat(ui): JD 抓取中态 + 进度展示`。

---

## Task 7: Playwright e2e

**Files:**
- Create: `scripts/verify-jd-fetch.ts`

**Step 1:** 注册 + 配 key + 直接 prisma seed 3 条 Boss job + 3 条 JdFetchTask pending。

**Step 2:** 启动 Playwright + 加载真实扩展 + 等 SW 轮询。

**Step 3:** 90s 内断言：3 条任务全终态，至少 1 条 done 或全部 failed 但 error 含"反爬/超时"。

**Step 4:** 截图存 `docs/screenshots/jdfetch-{1,2,3}-*.png`。

**Step 5:** 提交 `test: scripts/verify-jd-fetch.ts e2e`。

---

## Task 8: 真实 Chrome 验证

通过 Computer-use MCP 在用户真机 Chrome 操作：

**Step 1:** 加载 `extension/` 到本地 Chrome (chrome://extensions devmode load unpacked)。
**Step 2:** 登录 Boss直聘。
**Step 3:** 在 `localhost:3000/jobs` 跑一次 AI 搜任务。
**Step 4:** 等 5 分钟（喝杯水），检查抽屉里 JD 长度，截图。
**Step 5:** 截图存到 `docs/screenshots/real-jdfetch-*.png`。

---

## Task 9: 收尾 — lint / build / vitest 全绿 + PR

**Step 1:** `npm run lint && npx vitest run && npm run build`，三个 exit 0。
**Step 2:** 更新 `CHANGELOG.md` 加本期。
**Step 3:** push + `gh pr create`，描述含设计 doc 链接 + 截图 + 验收标准对照。
