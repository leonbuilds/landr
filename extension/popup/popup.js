// Popup script — runs in extension popup context
document.addEventListener("DOMContentLoaded", async () => {
  var statusDot = document.getElementById("status-dot")
  var statusText = document.getElementById("status-text")
  var platformBadge = document.getElementById("platform-badge")
  var historyList = document.getElementById("history-list")
  var emptyHistory = document.getElementById("empty-history")

  // Check connection
  var conn = await testConnection()
  if (conn.ok) {
    statusDot.className = "dot connected"
    statusText.textContent = "已连接"
  } else {
    statusDot.className = "dot disconnected"
    statusText.textContent = conn.message || "未连接"
  }

  // Get current platform
  chrome.runtime.sendMessage({ type: "GET_PLATFORM" }, function (res) {
    if (res && res.platform && res.platform !== "非招聘平台") {
      platformBadge.textContent = "当前平台: " + res.platform
    } else if (res && res.platform === "非招聘平台") {
      platformBadge.textContent = "当前页面非招聘平台"
    } else {
      platformBadge.style.display = "none"
    }
  })

  // Load history
  var data = await chrome.storage.local.get(["extractionHistory"])
  var history = data.extractionHistory || []
  if (history.length === 0) {
    emptyHistory.style.display = "block"
  } else {
    emptyHistory.style.display = "none"
    history.slice(0, 20).forEach(function (item) {
      var div = document.createElement("div")
      div.className = "history-item"
      div.innerHTML =
        '<div class="info"><div class="title">' + esc(item.title || "无标题") + '</div>' +
        '<div class="company">' + esc(item.company || "") + '</div></div>' +
        '<span class="badge">' + esc(item.platform || "") + '</span>'
      historyList.appendChild(div)
    })
  }

  // Buttons
  document.getElementById("open-app-btn").addEventListener("click", async () => {
    var d = await chrome.storage.local.get(["apiUrl"])
    chrome.tabs.create({ url: d.apiUrl || "http://localhost:3000" })
  })

  document.getElementById("clear-btn").addEventListener("click", async () => {
    await chrome.storage.local.set({ extractionHistory: [] })
    historyList.innerHTML = ""
    emptyHistory.style.display = "block"
  })

  document.getElementById("options-btn").addEventListener("click", function () {
    chrome.runtime.openOptionsPage()
  })
})

async function testConnection() {
  var data = await chrome.storage.local.get(["apiUrl", "apiKey"])
  if (!data.apiKey) return { ok: false, message: "未配置API Key" }
  return new Promise(function (resolve) {
    chrome.runtime.sendMessage({ type: "TEST_CONNECTION" }, function (d) {
      if (!d) { resolve({ ok: false, message: "无法连接到服务器" }); return }
      resolve({ ok: d.valid, message: d.valid ? "连接成功" : (d.message || "验证失败") })
    })
  })
}

function esc(str) {
  var d = document.createElement("div")
  d.textContent = str
  return d.innerHTML
}
