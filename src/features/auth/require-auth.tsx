import { Navigate, useLocation } from "react-router-dom"

import { AppShell } from "@/components/layout/app-shell"
import { useAuth } from "./auth-context"

export function RequireAuth() {
  const { user, isChecking } = useAuth()
  const location = useLocation()
  if (isChecking) return <main className="grid min-h-svh place-items-center"><p className="text-sm text-muted-foreground">Checking your session…</p></main>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <AppShell />
}
