// 智联招聘 (zhaopin.com) extractor
registerExtractor({
  name: "zhilian",
  matchPattern: /zhaopin\.com/,

  detectDetailPage(url) {
    return /\/job_detail\/|\/jobs\/\d+/.test(url)
  },

  detectListPage(url) {
    return /\/search\/|\/zhaopin\//.test(url)
  },

  extractDetail() {
    const title = cleanText(
      document.querySelector('[class*="post-name"]')?.textContent ||
      document.querySelector(".job-name h1")?.textContent ||
      document.querySelector("h1")?.textContent ||
      document.querySelector(".terminalpage-left__top h1")?.textContent ||
      ""
    )

    const company = cleanText(
      document.querySelector(".cname")?.textContent ||
      document.querySelector(".company-name")?.textContent ||
      document.querySelector('[class*="company"]')?.textContent ||
      ""
    )

    const salary = cleanText(
      document.querySelector(".terminalpage-left__salary")?.textContent ||
      document.querySelector('[class*="salary"]')?.textContent ||
      extractSalaryFromText(document.body.innerText) ||
      ""
    )

    const location = (() => {
      const items = document.querySelectorAll(".terminalpage-left__top li, [class*='location']")
      for (const item of items) {
        const t = cleanText(item.textContent)
        if (/北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|西安|天津|长沙|重庆|东莞|佛山|合肥|郑州/.test(t)) return t
      }
      return ""
    })()

    const jdText = cleanText(
      document.querySelector(".terminalpage-content")?.textContent ||
      document.querySelector(".describtion")?.textContent ||
      document.querySelector('[class*="job-detail"]')?.textContent ||
      document.querySelector('[class*="detail-content"]')?.textContent ||
      ""
    )

    return { title, company, location, salaryRange: salary, jdText, url: window.location.href, platform: "zhilian" }
  },

  extractList() {
    const items = document.querySelectorAll(".joblist-box__item, [class*='joblist-item'], [class*='job-item']")
    const jobs = []
    items.forEach((item) => {
      const title = cleanText(item.querySelector('[class*="iteminfo"] a')?.textContent || item.querySelector('[class*="job-name"]')?.textContent || "")
      const company = cleanText(item.querySelector('[class*="compayname"], [class*="company-name"]')?.textContent || item.querySelector('[class*="company"]')?.textContent || "")
      const salary = cleanText(item.querySelector('[class*="salary"]')?.textContent || extractSalaryFromText(item.textContent) || "")
      const link = item.querySelector("a")?.href || ""
      if (title) jobs.push({ title, company, salaryRange: salary, url: link, platform: "zhilian" })
    })
    return jobs
  },

  getInjectAnchor() {
    return document.querySelector(".terminalpage-content, .terminalpage-left, [class*='detail']") || document.body
  },
})
