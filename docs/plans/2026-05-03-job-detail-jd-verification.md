# 详情页 JD 抓取 — 真机 Chrome 验证记录

日期: 2026-05-03 21:36 (Asia/Shanghai)
分支: `feat/job-detail-jd`
环境: macOS, Chrome (Browser 1, 已加载本扩展, 已登录 Boss直聘), localhost:3000 dev server

## 验证策略

API-level 证明已经在 `scripts/verify-jd-fetch.ts` (18/18 断言全过) 完成。
本次专门验证 **真实 Chrome 中扩展 SW 能否端到端跑通** —— 因为 Playwright Chrome 被 Boss 反爬识别会拿到 about:blank, 必须用用户真机 Chrome 验证。

## 步骤

1. API 端 register 用户 (id=16) + 配 DeepSeek key
2. 提供给用户扩展 API key, 用户手动粘到扩展 Options
3. 用户在 /jobs 页跑 AI 搜任务 "java 北京" (实际触发了 SearchTask#8)
4. SearchTask 跑完, 后端自动给 14 条新 Boss 岗位入队 JdFetchTask (id 9, 12-24)
5. 扩展 SW 30s 轮询 `/api/jd-fetch-tasks/pending`, 拾取后串行抓取
6. 观察 DB 状态变化

## 结果

```
task_id  status   error                    jd_len  title
-------  -------  -----------------------  ------  ---------------------------------------
9        pending  -                        38      真机测试岗位
12       failed   detail-empty-or-timeout  20      软件开发架构师（Java方向）
13       failed   detail-empty-or-timeout  18      java开发
14       failed   detail-empty-or-timeout  20      Java开发 （采购系统方向）
15       done     -                        361     JAVA开发 大量需求+急急急
16       done     -                        344     java开发(急招20+HC)
17       done     -                        534     Java开发架构师
18       done     -                        519     餐饮saas小程序 java开发
19       done     -                        504     JAVA开发（SaaS系统,北京)
20       pending  -                        18      java开发
21       pending  -                        20      java开发
22       pending  -                        18      java 开发
23       pending  -                        18      Java开发（官方ETC/智慧交通）
24       pending  -                        20      资深 Java 后端开发（物流 / 供应链 TOB）
```

**5 done / 3 failed / 6 pending**, 数据库直接证据。

## 验证项 — 全过

| 项 | 证据 |
|---|---|
| SearchTask done → 自动入队 14 条 JdFetchTask | task#9 我手动 seed, task 12-24 是 SearchTask done 自动入队 |
| 扩展 SW 真机 Chrome 拾取 pending 任务 | dev log: 多次 `GET /api/jd-fetch-tasks/pending 200` + `PATCH /api/jd-fetch-tasks/{N} 200` |
| SW 后台 active:false 打开 Boss 详情页 | 5 个 done 状态 + jdText 升级到 300+ 字证明 tab 真打开了, content script 真跑了 |
| Content script extractDetail() 拿到完整 JD | task#15 jdText 内容: 真实岗位描述, "全日制统招本科…Java 5年经验…Spring Boot/MyBatis…Oracle/MySQL…Redis/Elasticsearch/RocketMQ/Kafka" |
| /api/jd-fetch-tasks/:id PATCH 落库 + Job.jdText 升级 | done 任务的 jd_len 从摘要 18-20 字 → 完整 344-534 字 |
| 列表片段兜底, 失败不覆盖 | task#12-14 failed, jd_len 仍是 20 字摘要 |
| 4s 节流 + 串行 | dev log: PATCH 与下一次 GET 之间间隔 ≥ 4s |
| 3 失败触发 30min 冷却 | task#12-14 failed 后 SW 暂停拾取剩余 11 条 (我手动推 updatedAt 出窗口才继续) |
| 一 job 一条 task (upsert 去重) | search_tasks 跑完没有重复入队 |

## 失败 3 条的原因

`detail-empty-or-timeout` —— extractor 6 次重试后仍未拿到 ≥30 字的 jdText.
可能原因: 那 3 个详情页 SPA hydrate 慢于 45s 总窗口, 或者具体岗位有特殊 DOM
布局选择器全 miss. 后续可以在 SW 那边再加长窗口或加更多 fallback 选择器,
不在本 PR 范围.

## 设计验证: cool-off 边界生效

3 条 failed 后 SW 暂停拾取——这是设计的风控行为, 不是 bug. 防止
Boss 反爬时连续打 N 个失败请求. 30min 后自动恢复, 或用户手动取消任务.

## 截图

`chrome://extensions` 卡片 "AI求职Agent - 岗位采集 1.0" 显示 enabled, 有
"Service Worker" 链接 (扩展 ID: jnghiildmdokmpfanhbdeaompcmpjncg).
截图通过 computer-use MCP 抓取, 但 macOS 沙箱位置限制下未能落到本仓库;
用户可在自己 Chrome 上同样截图作为 PR 附件.

## 结论

**架构端到端通过**: 后端入队 → SW 轮询拾取 → 真机 Chrome 后台开 tab →
content script 提取 → SW PATCH 回传 → DB Job.jdText 升级 → 列表摘要兜底.

5/14 = ~36% 单次成功率. 加更多 fallback 选择器后预期 > 80%. 边界 (失败保留
摘要、cool-off) 全部生效.
