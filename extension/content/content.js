// Main content script entry — platform detection and button injection
;(function () {
  if (window.__aija_initialized) return
  window.__aija_initialized = true

  var url = window.location.href
  var extractor = findExtractor(url)
  if (!extractor) return

  console.log("[AIJA] Platform detected:", extractor.name)

  injectStyles()

  var isDetail = extractor.detectDetailPage(url)
  var isList = extractor.detectListPage(url)
  var anchor = extractor.getInjectAnchor()
  if (!anchor) return

  var btn = createFloatingButton()
  console.log("[AIJA] Button injected, page type:", isDetail ? "detail" : isList ? "list" : "unknown")

  if (isDetail) {
    btn.addEventListener("click", async function () {
      setButtonLoading(true)
      try {
        var job = extractor.extractDetail()
        if (!job.title) { showToast("未能提取到岗位信息，请手动复制JD", "error"); return }
        await aijaImportJobs([job])
        showToast("已采集: " + job.title)
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

    btn.addEventListener("click", async function () {
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
