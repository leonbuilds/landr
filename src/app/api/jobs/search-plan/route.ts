// POST /api/jobs/search-plan
// 输入：{ prompt?: string, resumeId?: number }
// 用 LLM 把自然语言/简历摘要解析为 Boss 搜索参数 + 预览 URL
// 仅返回解析结果，不创建任务（让用户先确认）
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { callLLM, parseJsonFromLLM, SEARCH_PLAN_PROMPT } from "@/lib/ai"
import { decrypt } from "@/lib/crypto"
import { buildBossSearchUrl, type SearchPlan } from "@/lib/boss-search"

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  try {
    const { prompt, resumeId } = await req.json()
    let input = (prompt || "").trim()

    if (!input && resumeId) {
      const r = await prisma.resume.findUnique({ where: { id: Number(resumeId) } })
      if (!r || r.userId !== userId) {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "简历不存在" } }, { status: 404 })
      }
      // 取简历前 2000 字给 LLM 做意向推断
      input = `（基于简历自动推断意向）\n${(r.rawText || "").slice(0, 2000)}`
    }

    if (!input) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "请提供 prompt 或 resumeId" } }, { status: 400 })
    }

    const settings = await prisma.setting.findMany({ where: { userId } })
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))
    const provider = map.default_model || "deepseek"
    const apiKeyEnc = map[`api_key_${provider}`]
    if (!apiKeyEnc) {
      return NextResponse.json({ error: { code: "NO_API_KEY", message: "请先在设置中配置 API Key" } }, { status: 400 })
    }
    const apiKey = decrypt(apiKeyEnc)

    const llmRaw = await callLLM(SEARCH_PLAN_PROMPT.replace("{{INPUT}}", input), apiKey, provider)
    const plan = parseJsonFromLLM<SearchPlan>(llmRaw)

    // sane defaults
    plan.query = plan.query || "前端开发"
    plan.city = plan.city || "全国"
    plan.salaryMin = Number(plan.salaryMin) || 0
    plan.salaryMax = Number(plan.salaryMax) || 0

    const previewUrl = buildBossSearchUrl(plan, 1)

    return NextResponse.json({ data: { plan, previewUrl } })
  } catch (e) {
    console.error("search-plan error:", e)
    return NextResponse.json({ error: { code: "LLM_ERROR", message: "解析失败，请改写一句话或检查 API Key" } }, { status: 502 })
  }
}
