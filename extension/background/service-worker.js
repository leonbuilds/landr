// Background service worker — handles API requests to bypass page CSP
// 增量功能：定时轮询 search-tasks/pending → 借用户登录态自动跑 Boss 搜索 → 上传结果

// ---------- 自主搜岗位任务轮询（v2 新增） ----------
const POLL_ALARM = "aija-search-poll"
let isRunningTask = false   // 搜任务跑中
let isRunningJd = false     // JD 抓取跑中

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 })
})
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 })
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) {
    pollSearchTasksOnce()
    pollJdFetchOnce()
  }
})

async function pollSearchTasksOnce() {
  if (isRunningTask) return
  const { apiUrl, apiKey } = await chrome.storage.local.get(["apiUrl", "apiKey"])
  if (!apiKey) return
  const base = apiUrl || "http://localhost:3000"
  try {
    const r = await fetch(base + "/api/jobs/search-tasks/pending", {
      headers: { "X-API-Key": apiKey },
    })
    if (!r.ok) return
    const j = await r.json()
    const task = j.data
    if (!task) return
    isRunningTask = true
    try { await runSearchTask(task, base, apiKey) }
    finally { isRunningTask = false }
  } catch (e) {
    console.warn("[aija] poll failed:", e.message)
  }
}

async function patchTask(base, apiKey, id, body) {
  return fetch(`${base}/api/jobs/search-tasks/${id}`, {
    method: "PATCH",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve(true)
      }
      if (Date.now() - t0 > timeoutMs) {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve(false)
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

async function extractFromTab(tabId, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: "AUTO_COLLECT" }, (r) => {
          if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message })
          else resolve(r || {})
        })
      })
      if (resp.jobs && resp.jobs.length) return resp.jobs
      // wait + retry (Boss SPA hydrates lazily)
      await new Promise((r) => setTimeout(r, 3000))
    } catch (e) {
      console.warn("[aija] extract attempt failed:", e.message)
    }
  }
  return []
}

// 等用户登录或反爬验证：每 3s 探一次，最长 90s
// 探活策略：列表页有 .job-card 类元素 → 视为已就绪
async function waitForBossReady(tabId, base, apiKey, taskId, maxSec = 90) {
  for (let elapsed = 0; elapsed < maxSec; elapsed += 3) {
    const probe = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "BOSS_PROBE" }, (r) => {
        if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message })
        else resolve(r || {})
      })
    })
    if (probe.ready) return true
    // 心跳：让用户和 stale sweep 都看到任务还在 running
    if (elapsed % 30 === 0) {
      await patchTask(base, apiKey, taskId, {
        status: "running",
        message: probe.needLogin
          ? "请在打开的 Boss 标签页中完成登录/验证，扩展会自动继续"
          : "等待 Boss 页面就绪…",
      })
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return false
}

async function runSearchTask(task, base, apiKey) {
  await patchTask(base, apiKey, task.id, { status: "running", message: "正在打开 Boss 第 1 页…" })
  const allJobs = []
  let lastErr = null

  for (let i = 0; i < task.urls.length; i++) {
    const url = task.urls[i]
    const isFirst = i === 0
    let tabId = null
    try {
      // 第一页前台打开，给用户机会看见 / 登录 / 过验证
      // 后续页后台静默打开（cookies 已经在第一页设置）
      const tab = await chrome.tabs.create({ url, active: isFirst })
      tabId = tab.id
      await waitForTabComplete(tabId, 25000)

      // 第一页给充足时间登录（最长 90s 探活）；后续页只需 3s hydrate
      if (isFirst) {
        const ready = await waitForBossReady(tabId, base, apiKey, task.id, 90)
        if (!ready) {
          lastErr = "首页等待超时（90s）— 请确认已登录 Boss直聘，或刷新一次页面"
          break
        }
      } else {
        await new Promise((r) => setTimeout(r, 3000))
      }

      const jobs = await extractFromTab(tabId, isFirst ? 5 : 3)
      for (const j of jobs) allJobs.push(j)

      // 第一页完全失败 → 直接停止（避免继续开 N 个登录页）
      if (isFirst && jobs.length === 0) {
        lastErr = "首页未采到岗位 — 可能登录失败或 Boss 暂时反爬，请稍后重试"
        break
      }
    } catch (e) {
      lastErr = e.message
      if (isFirst) break
    } finally {
      if (tabId) try { await chrome.tabs.remove(tabId) } catch {}
    }
    // 每页完成后心跳，bump updatedAt 避免被 3min stale 误杀
    if (i < task.urls.length - 1) {
      await patchTask(base, apiKey, task.id, {
        status: "running",
        message: `已采 ${i + 1}/${task.urls.length} 页（${allJobs.length} 个）`,
      })
    }
  }

  // dedup by url（服务端再去重一次跟历史比对）
  const seen = new Set()
  const dedup = []
  for (const j of allJobs) {
    if (j.url && seen.has(j.url)) continue
    if (j.url) seen.add(j.url)
    dedup.push(j)
  }

  const status = dedup.length === 0 ? "failed" : "done"
  const message = dedup.length === 0
    ? (lastErr || "未提取到任何岗位（Boss 可能未登录或反爬）")
    : `共提取 ${dedup.length} 个岗位${lastErr ? "（中途出错: " + lastErr + "）" : ""}`
  await patchTask(base, apiKey, task.id, { status, jobs: dedup, message })
}

// ---------- JD 二次抓取任务轮询 ----------
async function patchJdTask(base, apiKey, id, body) {
  return fetch(`${base}/api/jd-fetch-tasks/${id}`, {
    method: "PATCH",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function extractDetailFromTab(tabId, timeoutMs = 45000) {
  // SPA 详情页 hydrate 很慢，先等 6s
  await new Promise((r) => setTimeout(r, 6000))
  const start = Date.now()
  // 最多重试 6 次, 每次间隔 5s, 总不超 timeoutMs
  for (let i = 0; i < 6 && Date.now() - start < timeoutMs; i++) {
    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "AUTO_COLLECT_DETAIL" }, (r) => {
        if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message })
        else resolve(r || {})
      })
    })
    console.log("[aija-jd] retry#" + i, JSON.stringify({
      hasResp: !!resp,
      err: resp && resp.error,
      jdLen: resp && resp.jdText ? resp.jdText.length : 0,
      jdHead: resp && resp.jdText ? resp.jdText.slice(0, 80) : "",
    }))
    if (resp && resp.jdText && resp.jdText.length >= 30) return resp
    await new Promise((r) => setTimeout(r, 5000))
  }
  return null
}

async function pollJdFetchOnce() {
  if (isRunningTask || isRunningJd) return
  const { apiUrl, apiKey } = await chrome.storage.local.get(["apiUrl", "apiKey"])
  if (!apiKey) return
  const base = apiUrl || "http://localhost:3000"
  try {
    const r = await fetch(base + "/api/jd-fetch-tasks/pending", {
      headers: { "X-API-Key": apiKey },
    })
    if (!r.ok) return
    const j = await r.json()
    const task = j.data
    if (!task) return
    isRunningJd = true
    try {
      await runJdFetchTask(task, base, apiKey)
    } finally {
      isRunningJd = false
    }
  } catch (e) {
    console.warn("[aija-jd] poll failed:", e.message)
  }
}

async function runJdFetchTask(task, base, apiKey) {
  let tabId = null
  try {
    const tab = await chrome.tabs.create({ url: task.url, active: false })
    tabId = tab.id
    const ok = await waitForTabComplete(tabId, 25000)
    if (!ok) {
      await patchJdTask(base, apiKey, task.id, { status: "failed", error: "tab-load-timeout" })
      return
    }
    const detail = await extractDetailFromTab(tabId, 30000)
    if (!detail || !detail.jdText) {
      await patchJdTask(base, apiKey, task.id, { status: "failed", error: "detail-empty-or-timeout" })
      return
    }
    await patchJdTask(base, apiKey, task.id, { status: "done", jdText: detail.jdText })
  } catch (e) {
    await patchJdTask(base, apiKey, task.id, { status: "failed", error: (e && e.message) || "unknown" })
  } finally {
    if (tabId) try { await chrome.tabs.remove(tabId) } catch {}
    // 节流: 单条结束后 sleep 4s 再让 alarm 拾下一条
    await new Promise((r) => setTimeout(r, 4000))
  }
}

// ---------- 投递完成回写 ----------
async function handleApplyDone(appId, apiBase) {
  const { apiKey } = await chrome.storage.local.get(["apiKey"])
  if (!apiKey) return { ok: false, error: "扩展未配置 API Key" }
  const base = apiBase || "http://localhost:3000"
  try {
    const res = await fetch(`${base}/api/applications/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ status: "applied", appliedAt: new Date().toISOString() }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return { ok: false, error: j.error?.message || `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ---------- 原有消息路由 ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "APPLY_DONE") {
    handleApplyDone(message.appId, message.apiBase).then(sendResponse)
    return true
  }
  // Import jobs: content script sends job data, SW sends to API
  if (message.type === "IMPORT_JOBS") {
    handleImport(message.jobs).then(sendResponse).catch((e) => sendResponse({ error: e.message }))
    return true // keep channel open for async response
  }

  // Verify connection test
  if (message.type === "TEST_CONNECTION") {
    handleTest().then(sendResponse)
    return true
  }

  // Get platform info for popup
  if (message.type === "GET_PLATFORM") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.url) { sendResponse({ platform: "unknown" }); return }
      const url = tab.url
      if (/zhipin\.com/.test(url)) sendResponse({ platform: "Boss直聘" })
      else if (/linkedin\.com/.test(url)) sendResponse({ platform: "LinkedIn" })
      else if (/lagou\.com/.test(url)) sendResponse({ platform: "拉勾" })
      else if (/zhaopin\.com/.test(url)) sendResponse({ platform: "智联" })
      else if (/xiaohongshu\.com/.test(url)) sendResponse({ platform: "小红书" })
      else sendResponse({ platform: "非招聘平台" })
    })
    return true
  }

  if (message.type === "EXTRACT_JOB") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) { sendResponse({ error: "No active tab" }); return }
      chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB" }, (result) => {
        if (chrome.runtime.lastError) sendResponse({ error: chrome.runtime.lastError.message })
        else sendResponse(result || {})
      })
    })
    return true
  }
})

async function handleImport(jobs) {
  const data = await chrome.storage.local.get(["apiUrl", "apiKey"])
  const apiUrl = data.apiUrl || "http://localhost:3000"
  const apiKey = data.apiKey || ""

  if (!apiKey) throw new Error("请先在插件选项中配置API Key")

  const res = await fetch(apiUrl + "/api/jobs/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ jobs }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || "请求失败 (" + res.status + ")")
  }

  return (await res.json()).data
}

async function handleTest() {
  const data = await chrome.storage.local.get(["apiUrl", "apiKey"])
  const apiUrl = data.apiUrl || "http://localhost:3000"
  const apiKey = data.apiKey || ""

  if (!apiKey) return { valid: false, message: "未配置API Key" }

  try {
    const res = await fetch(apiUrl + "/api/auth/verify-api-key", { headers: { "X-API-Key": apiKey } })
    const d = await res.json()
    return d
  } catch (e) {
    return { valid: false, message: "无法连接服务器" }
  }
}
