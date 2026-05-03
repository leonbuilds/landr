// BOSS直聘 (zhipin.com) extractor
registerExtractor({
  name: "boss",
  matchPattern: /zhipin\.com/,

  detectDetailPage(url) {
    return /job_detail/.test(url)
  },

  detectListPage(url) {
    return /web\/geek|web\/job|search/.test(url)
  },

  extractDetail() {
    const ld = extractLdJson("JobPosting")
    if (ld) {
      return {
        title: ld.title || "",
        company: ld.hiringOrganization?.name || ld.industry || "",
        location: ld.jobLocation?.[0]?.addressLocality || ld.jobLocation?.address?.addressLocality || "",
        salaryRange: "",
        jdText: ld.description || "",
        url: window.location.href,
        platform: "boss",
      }
    }

    const title = cleanText(
      document.querySelector(".name h1")?.textContent ||
      document.querySelector('[class*="job-name"]')?.textContent ||
      document.querySelector("h1")?.textContent ||
      extractMeta("og:title") ||
      ""
    )

    const company = cleanText(
      document.querySelector(".company-info .name")?.textContent ||
      document.querySelector('[class*="company-name"]')?.textContent ||
      ""
    )

    const salary = cleanText(
      document.querySelector(".name .badge")?.textContent ||
      document.querySelector('[class*="salary"]')?.textContent ||
      extractSalaryFromText(document.body.innerText) ||
      ""
    )

    const location = cleanText(
      document.querySelector('[class*="location"]')?.textContent ||
      document.querySelector(".job-location")?.textContent ||
      ""
    )

    const jdText = cleanText(
      document.querySelector(".job-sec .text")?.textContent ||
      document.querySelector(".job-detail .text")?.textContent ||
      document.querySelector('[class*="job-detail"]')?.textContent ||
      document.querySelector('[class*="detail-content"]')?.textContent ||
      ""
    )

    return { title, company, location, salaryRange: salary, jdText, url: window.location.href, platform: "boss" }
  },

  extractList() {
    const items = document.querySelectorAll('[class*="job-card-wrap"], li.job-card-wrapper, [class*="job-card"]')
    const jobs = []
    items.forEach((item) => {
      const title = cleanText(
        item.querySelector(".job-name")?.textContent ||
        item.querySelector('[class*="job-title"]')?.textContent ||
        ""
      )
      const company = cleanText(
        item.querySelector(".company-name")?.textContent ||
        item.querySelector('[class*="company"]')?.textContent ||
        ""
      )
      const salary = cleanText(
        item.querySelector(".salary, .red")?.textContent ||
        extractSalaryFromText(item.textContent) ||
        ""
      )
      const link = item.querySelector("a")?.href || ""

      // 列表片段：经验/学历 + 福利 tags + 一行简介，作为 jdText 摘要兜底，
      // 等详情页二次抓取后会被完整 JD 覆盖。
      const tagTexts = []
      item.querySelectorAll('.tag-list li, .info-desc, .job-area, .job-area-wrapper, [class*="tag"]').forEach((el) => {
        const t = cleanText(el.textContent || "")
        if (t && t.length < 40 && !tagTexts.includes(t)) tagTexts.push(t)
      })
      const snippet = tagTexts.slice(0, 12).join(" · ")

      const location = cleanText(
        item.querySelector('.job-area, .job-area-wrapper')?.textContent ||
        item.querySelector('[class*="location"]')?.textContent ||
        ""
      )

      if (title) jobs.push({
        title,
        company,
        salaryRange: salary,
        url: link,
        platform: "boss",
        location,
        jdText: snippet,
      })
    })
    return jobs
  },

  getInjectAnchor() {
    return document.querySelector(".job-sec, .job-detail, [class*='detail']") || document.body
  },
})
