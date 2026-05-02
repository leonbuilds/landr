import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"
import type { ImportJobsRequest } from "@/types"

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    },
  })
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key")
  if (!apiKey) {
    return corsResponse({ error: { code: "UNAUTHORIZED", message: "Missing X-API-Key header" } }, 401)
  }

  // Resolve userId from API key
  const userId = await resolveApiKey(apiKey)
  if (!userId) {
    return corsResponse({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401)
  }

  try {
    const body: ImportJobsRequest = await req.json()
    if (!body.jobs?.length) {
      return corsResponse({ error: { code: "BAD_REQUEST", message: "jobs array is required" } }, 400)
    }

    // Dedup: collect existing URLs for this user
    const existingUrls = new Set(
      (
        await prisma.job.findMany({
          where: { userId, url: { not: null } },
          select: { url: true },
        })
      ).map((j) => j.url as string)
    )

    let created = 0
    let skipped = 0

    for (const job of body.jobs) {
      if (!job.title) continue

      // Skip duplicates by URL
      if (job.url && existingUrls.has(job.url)) {
        skipped++
        continue
      }

      await prisma.job.create({
        data: {
          userId,
          title: job.title,
          company: job.company || "",
          platform: job.platform || "scraped",
          jdText: job.jdText || "",
          location: job.location || "",
          salaryRange: job.salaryRange || "",
          url: job.url || null,
        },
      })
      if (job.url) existingUrls.add(job.url)
      created++
    }

    return corsResponse({
      data: { created, skipped, total: body.jobs.length },
    })
  } catch {
    return corsResponse({ error: { code: "SERVER_ERROR", message: "导入失败" } }, 500)
  }
}

async function resolveApiKey(key: string): Promise<number | null> {
  try {
    // Find the setting where the decrypted value matches the provided key
    const allKeySettings = await prisma.setting.findMany({
      where: { key: "extension_api_key" },
    })
    for (const s of allKeySettings) {
      if (!s.value) continue
      const decrypted = decrypt(s.value)
      if (decrypted === key) return s.userId
    }
    return null
  } catch {
    return null
  }
}

function corsResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    },
  })
}
