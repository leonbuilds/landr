const STORAGE_KEYS = {
  API_URL: "apiUrl",
  API_KEY: "apiKey",
  HISTORY: "extractionHistory",
}

async function getStorage(keys) {
  return chrome.storage.local.get(keys)
}

async function setStorage(items) {
  return chrome.storage.local.set(items)
}

export async function getApiUrl() {
  const data = await getStorage([STORAGE_KEYS.API_URL])
  return data.apiUrl || "http://localhost:3000"
}

export async function setApiUrl(url) {
  return setStorage({ [STORAGE_KEYS.API_URL]: url })
}

export async function getApiKey() {
  const data = await getStorage([STORAGE_KEYS.API_KEY])
  return data.apiKey || ""
}

export async function setApiKey(key) {
  return setStorage({ [STORAGE_KEYS.API_KEY]: key })
}

export async function getHistory() {
  const data = await getStorage([STORAGE_KEYS.HISTORY])
  return data.extractionHistory || []
}

export async function addToHistory(entry) {
  const history = await getHistory()
  history.unshift({ ...entry, timestamp: Date.now() })
  if (history.length > 50) history.length = 50
  return setStorage({ [STORAGE_KEYS.HISTORY]: history })
}

export async function clearHistory() {
  return setStorage({ [STORAGE_KEYS.HISTORY]: [] })
}
