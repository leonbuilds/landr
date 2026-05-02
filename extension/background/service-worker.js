// Background service worker — handles API requests to bypass page CSP
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
