import { hashPassword, comparePassword, signToken, verifyToken } from "@/lib/auth"

describe("auth", () => {
  it("hashPassword creates a bcrypt hash", async () => {
    const hash = await hashPassword("test1234")
    expect(hash).toMatch(/^\$2[aby]\$/)
  })

  it("comparePassword returns true for correct password", async () => {
    const hash = await hashPassword("mypassword1")
    const result = await comparePassword("mypassword1", hash)
    expect(result).toBe(true)
  })

  it("comparePassword returns false for wrong password", async () => {
    const hash = await hashPassword("mypassword1")
    const result = await comparePassword("wrongpass", hash)
    expect(result).toBe(false)
  })

  it("signToken and verifyToken roundtrip", async () => {
    const token = await signToken(42)
    const result = await verifyToken(token)
    expect(result).toEqual({ userId: 42 })
  })

  it("verifyToken returns null for invalid token", async () => {
    const result = await verifyToken("invalid.token.here")
    expect(result).toBeNull()
  })
})
