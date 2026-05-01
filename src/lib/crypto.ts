import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-cbc"
const KEY = Buffer.from(
  process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "hex"
)

export function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

export function decrypt(encryptedText: string): string {
  const [ivHex, dataHex] = encryptedText.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return "****"
  return key.slice(0, 4) + "****" + key.slice(-4)
}
