import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId, comparePassword, hashPassword } from "@/lib/auth"

export async function PUT(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      )
    }

    const { oldPassword, newPassword } = await req.json()

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "请提供旧密码和新密码" } },
        { status: 400 }
      )
    }

    if (newPassword.length < 8 || newPassword.length > 32) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "新密码长度应为8-32个字符" } },
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

    const valid = await comparePassword(oldPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "当前密码错误" } },
        { status: 401 }
      )
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("Password change error:", error)
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "服务器错误，请稍后重试" } },
      { status: 500 }
    )
  }
}
