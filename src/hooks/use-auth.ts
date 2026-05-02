"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

interface AuthUser {
  id: number
  email: string
  name?: string | null
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export function useAuth() {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  })

   
  useEffect(() => {
    const token = localStorage.getItem("token")
    const userStr = localStorage.getItem("user")
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AuthUser
        setState({ user, token, isAuthenticated: true, isLoading: false })
      } catch {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        setState({ user: null, token: null, isAuthenticated: false, isLoading: false })
      }
    } else {
      setState((s) => ({ ...s, isLoading: false }))
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error?.message || "登录失败")
      }
      const { token, user } = json.data
      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))
      setState({ user, token, isAuthenticated: true, isLoading: false })
      router.push("/resumes")
      return user
    },
    [router]
  )

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error?.message || "注册失败")
      }
      const { token, user } = json.data
      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))
      setState({ user, token, isAuthenticated: true, isLoading: false })
      router.push("/resumes")
      return user
    },
    [router]
  )

  const logout = useCallback(() => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false })
    router.push("/login")
  }, [router])

  const getHeaders = useCallback((): Record<string, string> => {
    if (!state.token) return { "Content-Type": "application/json" }
    return { Authorization: `Bearer ${state.token}`, "Content-Type": "application/json" }
  }, [state.token])

  return { ...state, login, register, logout, getHeaders }
}
