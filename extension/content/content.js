// Main content script entry — platform detection and button injection
;(function () {
  if (window.__aija_initialized) return
  window.__aija_initialized = true

  const url = window.location.href
  const extractor = findExtractor(url)
  if (!extractor) return

  injectStyles()
  const isDetail = extractor.detectDetailPage(url)
  const isList = extractor.detectListPage(url)

  // Wait for anchor element
  const anchor = extractor.getInjectAnchor()
  if (!anchor) return

  const btn = createFloatingButton()

  if (isDetail) {
    // Detail page: click to extract and send
    btn.addEventListener("click", async function () {
      setButtonLoading(true)
      try {
        const job = extractor.extractDetail()
        if (!job.title) {
          showToast("未能提取到岗位信息，请手动复制JD", "error")
          return
        }
        const { importJobs } = await import(chrome.runtime.getURL("utils/api.js"))
        const result = await importJobs([job])
        showToast(`已采集: ${job.title}`)
      } catch (err) {
        showToast(err.message || "采集失败", "error")
      } finally {
        setButtonLoading(false)
      }
    })
  } else if (isList) {
    // List page: inject checkboxes, then batch collect
    const containerSelector = ".job-list-box, [class*='joblist'], [class*='result-list'], body"
    const itemSelector = "[class*='job-card-wrap'], li.job-card-wrapper, [class*='job-card'], [class*='job-search-card'], .joblist-box__item, [class*='item__'], [data-job-id]"

    setTimeout(() => decorateListItems(containerSelector, itemSelector, extractor), 1000)
    observeListChanges(containerSelector, itemSelector, extractor)

    // Listen for checkbox changes
    document.addEventListener("change", function (e) {
      if (e.target.classList.contains("aija-checkbox")) {
        showBatchButton(extractor)
      }
    })

    btn.addEventListener("click", async function () {
      const selected = getSelectedItems()
      if (selected.length === 0) {
        showToast("请先勾选要采集的岗位", "error")
        return
      }
      setButtonLoading(true)
      try {
        const jobs = []
        selected.forEach((el) => {
          // Try to extract from the selected element
          const title = cleanText(
            el.querySelector(".job-name")?.textContent ||
            el.querySelector('[class*="title"]')?.textContent ||
            el.querySelector("h3")?.textContent ||
            ""
          )
          const company = cleanText(
            el.querySelector(".company-name")?.textContent ||
            el.querySelector('[class*="company"]')?.textContent ||
            ""
          )
          const salary = extractSalaryFromText(el.textContent || "")
          const link = el.querySelector("a")?.href || ""
          if (title) {
            jobs.push({
              title,
              company,
              salaryRange: salary,
              url: link,
              platform: extractor.name,
            })
          }
        })

        if (jobs.length === 0) {
          showToast("未提取到岗位信息", "error")
          return
        }

        const { importJobs } = await import(chrome.runtime.getURL("utils/api.js"))
        const result = await importJobs(jobs)
        showToast(`成功采集 ${result.created} 个岗位${result.skipped > 0 ? `，${result.skipped} 个已跳过` : ""}`)

        // Uncheck all
        document.querySelectorAll(".aija-checkbox:checked").forEach((cb) => (cb.checked = false))
        showBatchButton(extractor)
      } catch (err) {
        showToast(err.message || "采集失败", "error")
      } finally {
        setButtonLoading(false)
      }
    })
  }
})()
