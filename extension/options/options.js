// Options page script
document.addEventListener("DOMContentLoaded", async () => {
  var apiUrlInput = document.getElementById("api-url")
  var apiKeyInput = document.getElementById("api-key")
  var testResult = document.getElementById("test-result")
  var saveResult = document.getElementById("save-result")

  var data = await chrome.storage.local.get(["apiUrl", "apiKey"])
  apiUrlInput.value = data.apiUrl || "http://localhost:3000"
  apiKeyInput.value = data.apiKey || ""

  document.getElementById("show-key-btn").addEventListener("click", function () {
    var isPass = apiKeyInput.type === "password"
    apiKeyInput.type = isPass ? "text" : "password"
    document.getElementById("show-key-btn").textContent = isPass ? "隐藏" : "显示"
  })

  document.getElementById("test-btn").addEventListener("click", async () => {
    await saveSettings()
    var apiUrl = apiUrlInput.value.trim() || "http://localhost:3000"
    var apiKey = apiKeyInput.value.trim()
    if (!apiKey) { testResult.textContent = "未配置API Key"; testResult.className = "result error"; return }
    try {
      var res = await fetch(apiUrl + "/api/resumes", { headers: { "X-API-Key": apiKey } })
      testResult.textContent = res.ok ? "连接成功" : "服务器返回 " + res.status
      testResult.className = "result " + (res.ok ? "success" : "error")
    } catch (e) {
      testResult.textContent = "无法连接到服务器"
      testResult.className = "result error"
    }
  })

  document.getElementById("save-btn").addEventListener("click", async () => {
    await saveSettings()
    saveResult.textContent = "设置已保存"
    saveResult.className = "result success"
    setTimeout(function () { saveResult.textContent = "" }, 2000)
  })

  async function saveSettings() {
    await chrome.storage.local.set({
      apiUrl: apiUrlInput.value.trim() || "http://localhost:3000",
      apiKey: apiKeyInput.value.trim(),
    })
  }
})
