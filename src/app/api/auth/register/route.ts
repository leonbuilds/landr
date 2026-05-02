import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken, hashPassword } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "邮箱和密码为必填项" } },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "邮箱格式不正确" } },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8 || password.length > 32) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "密码长度应为8-32个字符" } },
        { status: 400 }
      )
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "密码需包含字母和数字" } },
        { status: 400 }
      )
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "该邮箱已注册，请直接登录" } },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { email, passwordHash },
    })

    const token = await signToken(user.id)

    return NextResponse.json({
      data: {
        token,
        user: { id: user.id, email: user.email },
      },
    })
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "服务器错误，请稍后重试" } },
      { status: 500 }
    )
  }
}
