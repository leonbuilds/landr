import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { callLLM, parseJsonFromLLM } from "@/lib/ai"
import { decrypt } from "@/lib/crypto"

const SCRAPE_PROMPT = `你是一位招聘数据提取专家。以下是一个招聘网站页面的内容片段。请从中提取所有岗位信息。返回纯JSON格式（不要markdown代码块）。

页面内容片段：
{{CONTENT}}

返回格式：
{
  "jobs": [
    {
      "title": "岗位名称",
      "company": "公司名称",
      "location": "工作地点",
      "salaryRange": "薪资范围",
      "jdText": "岗位描述摘要"
    }
  ]
}`

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  try {
    const { url, htmlContent } = await req.json()

    if (!htmlContent && url) {
      // If only URL provided, attempt to fetch
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AIJobAgent/1.0)" },
          signal: AbortSignal.timeout(10000),
        })
        const html = await res.text()
        // Strip HTML tags for LLM processing
        const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 15000)

        const settings = await prisma.setting.findMany({ where: { userId } })
        const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
        const modelKey = settingMap.default_model || "deepseek"
        const apiKeyEncrypted = settingMap[`api_key_${modelKey}`]

        if (!apiKeyEncrypted) {
          return NextResponse.json({ error: { code: "NO_API_KEY", message: "请先配置API Key" } }, { status: 400 })
        }

        const apiKey = decrypt(apiKeyEncrypted)
        const prompt = SCRAPE_PROMPT.replace("{{CONTENT}}", text)
        const response = await callLLM(prompt, apiKey, modelKey)
        const result = parseJsonFromLLM<{ jobs: { title: string; company: string; location: string; salaryRange: string; jdText: string }[] }>(response)

        // Save extracted jobs
        const created = []
        for (const j of result.jobs) {
          const job = await prisma.job.create({
            data: {
              userId,
              title: j.title || "未命名岗位",
              company: j.company || "",
              platform: "scraped",
              jdText: j.jdText || "",
              location: j.location || "",
              salaryRange: j.salaryRange || "",
              url,
            },
          })
          created.push(job)
        }

        return NextResponse.json({ data: { jobs: created, count: created.length } })
      } catch (e) {
        return NextResponse.json({
          error: { code: "SCRAPE_FAILED", message: "页面抓取失败，请检查URL或直接粘贴页面内容" }
        }, { status: 422 })
      }
    }

    // If htmlContent provided, process it directly
    if (htmlContent) {
      const text = htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 15000)

      const settings = await prisma.setting.findMany({ where: { userId } })
      const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
      const modelKey = settingMap.default_model || "deepseek"
      const apiKeyEncrypted = settingMap[`api_key_${modelKey}`]

      if (!apiKeyEncrypted) {
        return NextResponse.json({ error: { code: "NO_API_KEY" } }, { status: 400 })
      }

      const apiKey = decrypt(apiKeyEncrypted)
      const prompt = SCRAPE_PROMPT.replace("{{CONTENT}}", text)
      const response = await callLLM(prompt, apiKey, modelKey)
      const result = parseJsonFromLLM<{ jobs: any[] }>(response)

      const created = []
      for (const j of result.jobs) {
        const job = await prisma.job.create({
          data: {
            userId,
            title: j.title || "未命名岗位",
            company: j.company || "",
            platform: "scraped",
            jdText: j.jdText || "",
            location: j.location || "",
            salaryRange: j.salaryRange || "",
          },
        })
        created.push(job)
      }

      return NextResponse.json({ data: { jobs: created, count: created.length } })
    }

    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "请提供URL或页面内容" } }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: "服务器错误" } }, { status: 500 })
  }
}
