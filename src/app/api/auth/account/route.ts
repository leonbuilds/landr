import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId, comparePassword } from "@/lib/auth"

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      )
    }

    const { password } = await req.json()
    if (!password) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "请输入密码确认身份" } },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "用户不存在" } },
        { status: 404 }
      )
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "密码错误" } },
        { status: 401 }
      )
    }

    // Cascade delete will remove all user data
    await prisma.user.delete({ where: { id: userId } })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("Account deletion error:", error)
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "服务器错误，请稍后重试" } },
      { status: 500 }
    )
  }
}
