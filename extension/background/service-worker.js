// Background service worker — handles API requests to bypass page CSP
// 增量功能：定时轮询 search-tasks/pending → 借用户登录态自动跑 Boss 搜索 → 上传结果

// ---------- 自主搜岗位任务轮询（v2 新增） ----------
const POLL_ALARM = "aija-search-poll"
let isRunningTask = false

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 })
})
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 })
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) pollSearchTasksOnce()
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

async function runSearchTask(task, base, apiKey) {
  await patchTask(base, apiKey, task.id, { status: "running" })
  const allJobs = []
  let lastErr = null

  for (const url of task.urls) {
    let tabId = null
    try {
      const tab = await chrome.tabs.create({ url, active: false })
      tabId = tab.id
      await waitForTabComplete(tabId)
      // give Boss SPA extra time to hydrate list
      await new Promise((r) => setTimeout(r, 5000))
      const jobs = await extractFromTab(tabId)
      for (const j of jobs) allJobs.push(j)
    } catch (e) {
      lastErr = e.message
    } finally {
      if (tabId) try { await chrome.tabs.remove(tabId) } catch {}
    }
  }

  // dedup by url within this batch (server also dedups against existing)
  const seen = new Set()
  const dedup = []
  for (const j of allJobs) {
    if (j.url && seen.has(j.url)) continue
    if (j.url) seen.add(j.url)
    dedup.push(j)
  }

  const status = dedup.length === 0 ? "failed" : "done"
  const message = dedup.length === 0 ? (lastErr || "未提取到任何岗位（Boss 可能未登录或反爬）") : `共提取 ${dedup.length} 个岗位`
  await patchTask(base, apiKey, task.id, { status, jobs: dedup, message })
}

// ---------- 原有消息路由 ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
