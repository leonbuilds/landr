// Main content script entry — platform detection and button injection
;(function () {
  if (window.__aija_initialized) return
  window.__aija_initialized = true

  var url = window.location.href
  var extractor = findExtractor(url)
  if (!extractor) return

  // ---- BOSS_PROBE 消息处理：SW 探活，判断页面是否就绪 ----
  // 返回 { ready: bool, needLogin: bool, jobCount: number }
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === "BOSS_PROBE") {
      try {
        var hasJobCards = !!document.querySelector(
          "[class*='job-card-wrap'], li.job-card-wrapper, [class*='job-card'], [class*='job-search-card'], [data-job-id]",
        )
        var url = location.href
        var needLogin =
          /\/login|\/security-check|\/verify/.test(url) ||
          !!document.querySelector(".btn-login, [class*='login-btn'], [class*='security']") ||
          /请登录|登录后查看|安全验证/.test(document.body.innerText || "")
        sendResponse({
          ready: hasJobCards,
          needLogin: needLogin,
          jobCount: document.querySelectorAll("[class*='job-card']").length,
          url: url,
        })
      } catch (err) {
        sendResponse({ ready: false, needLogin: false, error: err.message })
      }
      return true
    }
  })

  // ---- AUTO_COLLECT 消息处理：service worker 在自动搜岗位任务里调用 ----
  // 不依赖 UI，直接跑 extractor 的 list 逻辑，把整页所有岗位返回 SW
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === "AUTO_COLLECT") {
      try {
        var jobs = []
        if (typeof extractor.extractList === "function") {
          jobs = extractor.extractList() || []
        }
        if (!jobs.length) {
          // 兜底：扫描列表 DOM，沿用 ui.js 用过的选择器
          var items = document.querySelectorAll(
            "[class*='job-card-wrap'], li.job-card-wrapper, [class*='job-card'], [class*='job-search-card'], .joblist-box__item, [data-job-id]",
          )
          items.forEach(function (el) {
            var title = cleanText(
              (el.querySelector(".job-name") || el.querySelector('[class*="title"]') || el.querySelector("h3") || {}).textContent || "",
            )
            var company = cleanText(
              (el.querySelector(".company-name") || el.querySelector('[class*="company"]') || {}).textContent || "",
            )
            var salary = extractSalaryFromText(el.textContent || "")
            var link = (el.querySelector("a") || {}).href || ""
            if (title) jobs.push({ title: title, company: company, salaryRange: salary, url: link, platform: extractor.name })
          })
        }
        sendResponse({ jobs: jobs })
      } catch (err) {
        sendResponse({ error: err.message || String(err), jobs: [] })
      }
      return true
    }
  })

  injectStyles()

  var isDetail = extractor.detectDetailPage(url)
  var isList = extractor.detectListPage(url)
  var anchor = extractor.getInjectAnchor()
  if (!anchor) return

  var btn = createFloatingButton()

  if (isDetail) {
    btn.addEventListener("click", async function (e) {
      e.preventDefault()
      e.stopPropagation()
      setButtonLoading(true)
      try {
        var job = extractor.extractDetail()
        if (!job.title) { showToast("未能提取到岗位信息，请手动复制JD", "error"); return }
        var result = await aijaImportJobs([job])
        showToast("已采集: " + job.title + (result.skipped > 0 ? " (已存在)" : ""))
      } catch (err) {
        showToast(err.message || "采集失败", "error")
      } finally {
        setButtonLoading(false)
      }
    })
  } else if (isList) {
    var containerSel = ".job-list-box, [class*='joblist'], [class*='result-list'], body"
    var itemSel = "[class*='job-card-wrap'], li.job-card-wrapper, [class*='job-card'], [class*='job-search-card'], .joblist-box__item, [class*='item__'], [data-job-id]"

    setTimeout(function () { decorateListItems(containerSel, itemSel, extractor) }, 1000)
    observeListChanges(containerSel, itemSel, extractor)

    document.addEventListener("change", function (e) {
      if (e.target && e.target.classList.contains("aija-checkbox")) {
        showBatchButton(extractor)
      }
    })

    btn.addEventListener("click", async function (e) {
      e.preventDefault()
      e.stopPropagation()
      var selected = getSelectedItems()
      if (selected.length === 0) { showToast("请先勾选要采集的岗位", "error"); return }

      setButtonLoading(true)
      try {
        var jobs = []
        selected.forEach(function (el) {
          var title = cleanText(
            (el.querySelector(".job-name") || el.querySelector('[class*="title"]') || el.querySelector("h3") || {}).textContent || ""
          )
          var company = cleanText(
            (el.querySelector(".company-name") || el.querySelector('[class*="company"]') || {}).textContent || ""
          )
          var salary = extractSalaryFromText(el.textContent || "")
          var link = (el.querySelector("a") || {}).href || ""
          if (title) jobs.push({ title: title, company: company, salaryRange: salary, url: link, platform: extractor.name })
        })

        if (jobs.length === 0) { showToast("未提取到岗位信息", "error"); return }
        var result = await aijaImportJobs(jobs)
        var msg = "成功采集 " + result.created + " 个岗位"
        if (result.skipped > 0) msg += "，" + result.skipped + " 个已跳过"
        showToast(msg)
        document.querySelectorAll(".aija-checkbox:checked").forEach(function (cb) { cb.checked = false })
        showBatchButton(extractor)
      } catch (err) {
        showToast(err.message || "采集失败", "error")
      } finally {
        setButtonLoading(false)
      }
    })
  }
})()
