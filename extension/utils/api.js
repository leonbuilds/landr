// API client — loaded as content script, uses global scope
async function aijaImportJobs(jobs) {
  var apiUrl = await aijaGetApiUrl()
  var apiKey = await aijaGetApiKey()

  if (!apiKey) {
    throw new Error("请先在插件选项中配置API Key")
  }

  var res = await fetch(apiUrl + "/api/jobs/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ jobs: jobs }),
  })

  if (!res.ok) {
    var err = await res.json().catch(function () { return {} })
    throw new Error(err.error?.message || "请求失败 (" + res.status + ")")
  }

  var result = await res.json()

  for (var i = 0; i < jobs.length; i++) {
    await aijaAddToHistory({
      title: jobs[i].title, company: jobs[i].company || "",
      platform: jobs[i].platform || "unknown", url: jobs[i].url || "",
    })
  }

  return result.data
}
