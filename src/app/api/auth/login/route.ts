import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken, comparePassword } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "邮箱和密码为必填项" } },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "该邮箱未注册" } },
        { status: 401 }
      )
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "密码错误" } },
        { status: 401 }
      )
    }

    const token = await signToken(user.id)

    return NextResponse.json({
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name },
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "服务器错误，请稍后重试" } },
      { status: 500 }
    )
  }
}
