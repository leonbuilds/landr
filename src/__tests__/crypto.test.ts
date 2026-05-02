import { encrypt, decrypt, maskApiKey } from "@/lib/crypto"

describe("crypto", () => {
  it("encrypt and decrypt roundtrip", () => {
    const original = "sk-test-key-12345678"
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(decrypt(encrypted)).toBe(original)
  })

  it("encrypt produces different output for same input (different IV)", () => {
    const a = encrypt("test-key")
    const b = encrypt("test-key")
    expect(a).not.toBe(b)
    // Both should decrypt to same value
    expect(decrypt(a)).toBe("test-key")
    expect(decrypt(b)).toBe("test-key")
  })

  it("maskApiKey masks middle of long key", () => {
    const masked = maskApiKey("sk-1234567890abcdef")
    expect(masked).toBe("sk-1****cdef")
  })

  it("maskApiKey returns **** for short key", () => {
    const masked = maskApiKey("short")
    expect(masked).toBe("****")
  })

  it("maskApiKey returns **** for empty key", () => {
    const masked = maskApiKey("")
    expect(masked).toBe("****")
  })
})
