// Options page script
;(function () {
  "use strict"

  document.addEventListener("DOMContentLoaded", function () {
    var apiUrlInput = document.getElementById("api-url")
    var apiKeyInput = document.getElementById("api-key")
    var testResult = document.getElementById("test-result")
    var saveResult = document.getElementById("save-result")

    chrome.storage.local.get(["apiUrl", "apiKey"], function (data) {
      apiUrlInput.value = data.apiUrl || "http://localhost:3000"
      apiKeyInput.value = data.apiKey || ""
    })

    document.getElementById("show-key-btn").onclick = function () {
      var isPass = apiKeyInput.type === "password"
      apiKeyInput.type = isPass ? "text" : "password"
      this.textContent = isPass ? "隐藏" : "显示"
    }

    function doSave(cb) {
      chrome.storage.local.set({
        apiUrl: apiUrlInput.value.trim() || "http://localhost:3000",
        apiKey: apiKeyInput.value.trim(),
      }, cb)
    }

    document.getElementById("test-btn").onclick = function () {
      doSave(function () {
        var apiUrl = apiUrlInput.value.trim() || "http://localhost:3000"
        var apiKey = apiKeyInput.value.trim()
        if (!apiKey) { testResult.textContent = "未配置API Key"; testResult.className = "result error"; return }
        fetch(apiUrl + "/api/auth/verify-api-key", { headers: { "X-API-Key": apiKey } })
          .then(function (r) { return r.json() })
          .then(function (d) {
            testResult.textContent = d.valid ? "连接成功" : (d.message || "无效")
            testResult.className = "result " + (d.valid ? "success" : "error")
          })
          .catch(function () {
            testResult.textContent = "无法连接服务器"
            testResult.className = "result error"
          })
      })
    }

    document.getElementById("save-btn").onclick = function () {
      doSave(function () {
        saveResult.textContent = "已保存"
        saveResult.className = "result success"
      })
    }
  })
})()
