import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { callLLM, PARSE_JD_PROMPT, parseJsonFromLLM } from "@/lib/ai"
import { decrypt } from "@/lib/crypto"
import type { ParsedJD } from "@/types"

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const jobs = await prisma.job.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ data: jobs })
}

// DELETE /api/jobs?scope=all|untouched
//   all (默认): 清空当前用户所有岗位; 已生成的 Application 会因 onDelete: SetNull
//               保留, 但 jobId 变 null (失去关联, 仍可在看板看见)
//   untouched: 只删没有对应 Application 的岗位 (即从未匹配过的)
export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const scope = (new URL(req.url).searchParams.get("scope") || "all") as "all" | "untouched"

  if (scope === "untouched") {
    // 找出所有「没有任何 Application 关联」的 job
    const orphanJobs = await prisma.job.findMany({
      where: { userId, applications: { none: {} } },
      select: { id: true },
    })
    const ids = orphanJobs.map((j) => j.id)
    if (ids.length === 0) return NextResponse.json({ data: { deleted: 0 } })
    const r = await prisma.job.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ data: { deleted: r.count } })
  }

  // scope=all
  const r = await prisma.job.deleteMany({ where: { userId } })
  return NextResponse.json({ data: { deleted: r.count } })
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  try {
    const body = await req.json()
    const {
      title,
      jdText,
      parseWithAI,
      url: bodyUrl,
      company: bodyCompany,
      location: bodyLocation,
      salaryRange: bodySalaryRange,
      platform: bodyPlatform,
    } = body

    if (!jdText?.trim()) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "请输入JD内容" } }, { status: 400 })
    }

    let parsedJson = ""
    let company = bodyCompany || ""
    let finalTitle = title || "未命名岗位"

    if (parseWithAI) {
      const settings = await prisma.setting.findMany({ where: { userId } })
      const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
      const modelKey = settingMap.default_model || "deepseek"
      const apiKeyEncrypted = settingMap[`api_key_${modelKey}`]

      if (apiKeyEncrypted) {
        try {
          const apiKey = decrypt(apiKeyEncrypted)
          const prompt = PARSE_JD_PROMPT.replace("{{JD}}", jdText)
          const response = await callLLM(prompt, apiKey, modelKey)
          const parsed = parseJsonFromLLM<ParsedJD>(response)
          finalTitle = parsed.title || finalTitle
          company = parsed.company || ""
          parsedJson = JSON.stringify(parsed)
        } catch {
          // AI parse failed, save with manual data only
        }
      }
    }

    const job = await prisma.job.create({
      data: {
        userId,
        title: finalTitle,
        company: company || null,
        platform: bodyPlatform || "manual",
        jdText,
        parsedJson: parsedJson || null,
        url: bodyUrl || null,
        location: bodyLocation || null,
        salaryRange: bodySalaryRange || null,
      },
    })

    return NextResponse.json({ data: job }, { status: 201 })
  } catch (error) {
    console.error("Job create error:", error)
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: "服务器错误" } }, { status: 500 })
  }
}
