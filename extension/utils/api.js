import { getApiUrl, getApiKey, addToHistory } from "./storage.js"

export async function importJobs(jobs) {
  const apiUrl = await getApiUrl()
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new Error("请先在插件选项中配置API Key")
  }

  const res = await fetch(`${apiUrl}/api/jobs/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ jobs }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `请求失败 (${res.status})`)
  }

  const result = await res.json()

  // Record to history
  for (const job of jobs) {
    await addToHistory({
      title: job.title,
      company: job.company || "",
      platform: job.platform || "unknown",
      url: job.url || "",
    })
  }

  return result.data
}

export async function testConnection() {
  const apiUrl = await getApiUrl()
  const apiKey = await getApiKey()

  if (!apiKey) return { ok: false, message: "未配置API Key" }

  try {
    const res = await fetch(`${apiUrl}/api/resumes`, {
      headers: { "X-API-Key": apiKey },
    })
    return { ok: res.ok, message: res.ok ? "连接成功" : `服务器返回 ${res.status}` }
  } catch {
    return { ok: false, message: "无法连接到服务器，请检查API地址" }
  }
}
