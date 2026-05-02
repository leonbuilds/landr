// 拉勾 (lagou.com) extractor
registerExtractor({
  name: "lagou",
  matchPattern: /lagou\.com/,

  detectDetailPage(url) {
    return /\/jobs\/\d+/.test(url)
  },

  detectListPage(url) {
    return /\/wn\/jobs|\/zhaopin/.test(url)
  },

  extractDetail() {
    const title = cleanText(
      document.querySelector(".job-name h1")?.textContent ||
      document.querySelector(".position-name")?.textContent ||
      document.querySelector("h1")?.textContent ||
      ""
    )

    const company = cleanText(
      document.querySelector(".company-name")?.textContent ||
      document.querySelector(".company")?.textContent ||
      ""
    )

    const salary = cleanText(
      document.querySelector(".job_request .salary")?.textContent ||
      document.querySelector('[class*="salary"]')?.textContent ||
      extractSalaryFromText(document.body.innerText) ||
      ""
    )

    const location = (() => {
      const spans = document.querySelectorAll(".job_request span")
      for (const s of spans) {
        const t = cleanText(s.textContent)
        if (/北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|西安|天津|长沙|重庆|东莞|佛山|合肥|郑州/.test(t)) return t
      }
      return ""
    })()

    const jdText = cleanText(
      document.querySelector(".job-detail")?.textContent ||
      document.querySelector('[class*="job_bt"]')?.textContent ||
      document.querySelector('[class*="job-content"]')?.textContent ||
      ""
    )

    return { title, company, location, salaryRange: salary, jdText, url: window.location.href, platform: "lagou" }
  },

  extractList() {
    const items = document.querySelectorAll('[class*="item__"], li.con_list_item, [class*="job-item"]')
    const jobs = []
    items.forEach((item) => {
      const title = cleanText(item.querySelector(".position_link")?.textContent || item.querySelector('[class*="position"]')?.textContent || "")
      const company = cleanText(item.querySelector(".company_name")?.textContent || item.querySelector('[class*="company"]')?.textContent || "")
      const salary = cleanText(item.querySelector(".money")?.textContent || extractSalaryFromText(item.textContent) || "")
      const link = item.querySelector("a")?.href || ""
      if (title) jobs.push({ title, company, salaryRange: salary, url: link, platform: "lagou" })
    })
    return jobs
  },

  getInjectAnchor() {
    return document.querySelector(".job-detail, [class*='job-content'], [class*='detail']") || document.body
  },
})
