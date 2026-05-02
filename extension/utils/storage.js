// Storage utilities — loaded as content script, uses global scope
async function aijaGetApiUrl() {
  const data = await chrome.storage.local.get(["apiUrl"])
  return data.apiUrl || "http://localhost:3000"
}

async function aijaGetApiKey() {
  const data = await chrome.storage.local.get(["apiKey"])
  return data.apiKey || ""
}

async function aijaAddToHistory(entry) {
  const data = await chrome.storage.local.get(["extractionHistory"])
  const history = data.extractionHistory || []
  history.unshift({ ...entry, timestamp: Date.now() })
  if (history.length > 50) history.length = 50
  return chrome.storage.local.set({ extractionHistory: history })
}
