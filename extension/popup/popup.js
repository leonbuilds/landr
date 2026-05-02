import { getApiUrl, getHistory, clearHistory } from "../utils/storage.js"
import { testConnection } from "../utils/api.js"

document.addEventListener("DOMContentLoaded", async () => {
  const statusDot = document.getElementById("status-dot")
  const statusText = document.getElementById("status-text")
  const platformBadge = document.getElementById("platform-badge")
  const historyList = document.getElementById("history-list")
  const emptyHistory = document.getElementById("empty-history")

  // Check connection
  const conn = await testConnection()
  if (conn.ok) {
    statusDot.className = "dot connected"
    statusText.textContent = "已连接"
  } else {
    statusDot.className = "dot disconnected"
    statusText.textContent = conn.message || "未连接"
  }

  // Get current platform
  chrome.runtime.sendMessage({ type: "GET_PLATFORM" }, (res) => {
    if (res?.platform && res.platform !== "非招聘平台") {
      platformBadge.textContent = "当前平台: " + res.platform
    } else if (res?.platform === "非招聘平台") {
      platformBadge.textContent = "当前页面非招聘平台"
    } else {
      platformBadge.style.display = "none"
    }
  })

  // Load history
  const history = await getHistory()
  if (history.length === 0) {
    emptyHistory.style.display = "block"
  } else {
    emptyHistory.style.display = "none"
    history.slice(0, 20).forEach((item) => {
      const div = document.createElement("div")
      div.className = "history-item"
      div.innerHTML = `
        <div class="info">
          <div class="title">${escapeHtml(item.title || "无标题")}</div>
          <div class="company">${escapeHtml(item.company || "")}</div>
        </div>
        <span class="badge">${escapeHtml(item.platform || "")}</span>
      `
      historyList.appendChild(div)
    })
  }

  // Buttons
  document.getElementById("open-app-btn").addEventListener("click", async () => {
    const apiUrl = await getApiUrl()
    chrome.tabs.create({ url: apiUrl })
  })

  document.getElementById("clear-btn").addEventListener("click", async () => {
    await clearHistory()
    historyList.innerHTML = ""
    emptyHistory.style.display = "block"
  })

  document.getElementById("options-btn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage()
  })
})

function escapeHtml(str) {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML
}
