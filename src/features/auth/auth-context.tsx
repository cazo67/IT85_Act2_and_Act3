/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { authService } from "@/services/api/services"
import { onUnauthorized, tokenStore } from "@/services/api/client"
import type { User } from "@/types/domain"

type AuthState = {
  user: User | null
  isChecking: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [isChecking, setChecking] = React.useState(Boolean(tokenStore.get()))
  const queryClient = useQueryClient()

  const clearSession = React.useCallback(() => {
    tokenStore.clear()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  React.useEffect(() => {
    onUnauthorized(clearSession)
    return () => onUnauthorized(null)
  }, [clearSession])

  React.useEffect(() => {
    const sessionToken = tokenStore.get()
    if (!sessionToken) {
      return
    }
    const controller = new AbortController()
    let active = true
    authService
      .me(controller.signal)
      .then((response) => {
        if (active && tokenStore.get() === sessionToken) setUser(response.data)
      })
      .catch(() => {
        if (
          active &&
          !controller.signal.aborted &&
          tokenStore.get() === sessionToken
        )
          clearSession()
      })
      .finally(() => {
        if (active) setChecking(false)
      })
    // Unmount/Strict Mode cleanup cancels this check; cancellation is not logout.
    return () => {
      active = false
      controller.abort()
    }
  }, [clearSession])

  const login = React.useCallback(async (email: string, password: string) => {
    const response = await authService.login(email, password)
    tokenStore.set(response.data.access_token)
    setUser(response.data.user)
    return response.data.user
  }, [])

  const logout = React.useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = React.useMemo(
    () => ({ user, isChecking, login, logout }),
    [user, isChecking, login, logout]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
