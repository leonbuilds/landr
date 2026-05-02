// API client — loaded as content script, uses global scope
async function aijaImportJobs(jobs) {
  const apiUrl = await aijaGetApiUrl()
  const apiKey = await aijaGetApiKey()

  if (!apiKey) {
    throw new Error("请先在插件选项中配置API Key")
  }

  const res = await fetch(`${apiUrl}/api/jobs/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ jobs }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `请求失败 (${res.status})`)
  }

  const result = await res.json()

  for (const job of jobs) {
    await aijaAddToHistory({
      title: job.title, company: job.company || "",
      platform: job.platform || "unknown", url: job.url || "",
    })
  }

  return result.data
}
