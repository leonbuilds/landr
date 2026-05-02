// LinkedIn extractor
registerExtractor({
  name: "linkedin",
  matchPattern: /linkedin\.com/,

  detectDetailPage(url) {
    return /\/jobs\/view\//.test(url)
  },

  detectListPage(url) {
    return /\/jobs\/search|\/jobs\/collections/.test(url)
  },

  extractDetail() {
    const ld = extractLdJson("JobPosting")
    if (ld) {
      return {
        title: ld.title || "",
        company: ld.hiringOrganization?.name || "",
        location: ld.jobLocation?.[0]?.addressLocality || ld.jobLocation?.address?.addressLocality || "",
        salaryRange: ld.baseSalary?.value ? `${ld.baseSalary.value} ${ld.baseSalary.currency || ""}` : "",
        jdText: ld.description || "",
        url: window.location.href,
        platform: "linkedin",
      }
    }

    const title = cleanText(
      document.querySelector("h1.top-card-layout__title")?.textContent ||
      document.querySelector('[class*="job-title"]')?.textContent ||
      document.querySelector("h1")?.textContent ||
      ""
    )

    const company = cleanText(
      document.querySelector("a.topcard__org-name-link")?.textContent ||
      document.querySelector('[class*="company-name"]')?.textContent ||
      document.querySelector(".topcard__flavor-row .topcard__flavor")?.textContent ||
      ""
    )

    const location = cleanText(
      document.querySelector(".topcard__flavor--bullet")?.textContent ||
      document.querySelector('[class*="location"]')?.textContent ||
      ""
    )

    const salary = cleanText(
      document.querySelector('[class*="salary"]')?.textContent ||
      document.querySelector(".compensation__salary")?.textContent ||
      extractSalaryFromText(document.body.innerText) ||
      ""
    )

    const jdText = cleanText(
      document.querySelector(".description__text")?.textContent ||
      document.querySelector('[class*="job-description"]')?.textContent ||
      document.querySelector(".show-more-less-html__markup")?.textContent ||
      ""
    )

    return { title, company, location, salaryRange: salary, jdText, url: window.location.href, platform: "linkedin" }
  },

  extractList() {
    const items = document.querySelectorAll('[class*="job-search-card"], [data-job-id]')
    const jobs = []
    items.forEach((item) => {
      const title = cleanText(item.querySelector('[class*="job-search-card__title"]')?.textContent || item.querySelector("h3")?.textContent || "")
      const company = cleanText(item.querySelector('[class*="job-search-card__company-name"]')?.textContent || item.querySelector('[class*="company"]')?.textContent || "")
      const location = cleanText(item.querySelector('[class*="job-search-card__location"]')?.textContent || "")
      const link = item.querySelector("a")?.href || ""
      if (title) jobs.push({ title, company, location, url: link, platform: "linkedin" })
    })
    return jobs
  },

  getInjectAnchor() {
    return document.querySelector(".description__text, .jobs-details__main-content, [class*='job-view']") || document.body
  },
})
