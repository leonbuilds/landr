import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { parsePdf, parseDocx, structureResumeText } from "@/lib/resume-parser"

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const resumes = await prisma.resume.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, userId: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json({ data: resumes })
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  try {
    const contentType = req.headers.get("content-type") || ""

    let rawText = ""
    let filePath = ""
    let name = ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      const textField = formData.get("text") as string | null

      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = file.name.split(".").pop()?.toLowerCase()
        if (ext === "pdf") {
          rawText = await parsePdf(buffer)
        } else if (ext === "docx" || ext === "doc") {
          rawText = await parseDocx(buffer)
        } else {
          return NextResponse.json({ error: { code: "BAD_REQUEST", message: "仅支持PDF、Word格式或纯文本" } }, { status: 400 })
        }
        filePath = file.name
        name = file.name.replace(/\.[^/.]+$/, "")
      } else if (textField) {
        rawText = textField
        name = "手动粘贴简历"
      } else {
        return NextResponse.json({ error: { code: "BAD_REQUEST", message: "请上传文件或粘贴文本" } }, { status: 400 })
      }
    } else {
      const body = await req.json()
      rawText = body.rawText || ""
      name = body.name || "未命名简历"
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "无法解析该文件，请检查文件是否损坏或内容为空" } }, { status: 400 })
    }

    const parsedJson = JSON.stringify(structureResumeText(rawText))

    const resume = await prisma.resume.create({
      data: { userId, name, rawText, parsedJson, filePath: filePath || null },
    })

    return NextResponse.json({ data: resume }, { status: 201 })
  } catch (error) {
    console.error("Resume create error:", error)
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: "服务器错误" } }, { status: 500 })
  }
}
