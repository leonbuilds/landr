import { getApiUrl, setApiUrl, getApiKey, setApiKey } from "../utils/storage.js"
import { testConnection } from "../utils/api.js"

document.addEventListener("DOMContentLoaded", async () => {
  const apiUrlInput = document.getElementById("api-url")
  const apiKeyInput = document.getElementById("api-key")
  const testResult = document.getElementById("test-result")
  const saveResult = document.getElementById("save-result")

  // Load saved values
  apiUrlInput.value = await getApiUrl()
  apiKeyInput.value = await getApiKey()

  // Show/hide key
  document.getElementById("show-key-btn").addEventListener("click", () => {
    const type = apiKeyInput.type === "password" ? "text" : "password"
    apiKeyInput.type = type
    document.getElementById("show-key-btn").textContent = type === "password" ? "显示" : "隐藏"
  })

  // Test connection
  document.getElementById("test-btn").addEventListener("click", async () => {
    await saveSettings()
    const result = await testConnection()
    testResult.textContent = result.message
    testResult.className = "result " + (result.ok ? "success" : "error")
  })

  // Save
  document.getElementById("save-btn").addEventListener("click", async () => {
    await saveSettings()
    saveResult.textContent = "设置已保存"
    saveResult.className = "result success"
    setTimeout(() => { saveResult.textContent = "" }, 2000)
  })
})

async function saveSettings() {
  const apiUrl = document.getElementById("api-url").value.trim() || "http://localhost:3000"
  const apiKey = document.getElementById("api-key").value.trim()
  await setApiUrl(apiUrl)
  await setApiKey(apiKey)
}
