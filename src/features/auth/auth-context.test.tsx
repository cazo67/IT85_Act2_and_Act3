import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { StrictMode } from "react"

import { AuthProvider, useAuth } from "./auth-context"
import { RequireAuth } from "./require-auth"
import { tokenStore } from "@/services/api/client"

afterEach(cleanup)

function SessionStatus() {
  const { user, isChecking } = useAuth()
  return <p>{isChecking ? "Checking" : (user?.name ?? "Signed out")}</p>
}

describe("account-check recovery", () => {
  it("ignores a cancelled Strict Mode check and restores the current session", async () => {
    tokenStore.set("current-session")
    let requests = 0
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
      requests++
      if (requests === 1)
        return new Promise<Response>((_resolve, reject) =>
          options?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Cancelled", "AbortError")),
            { once: true }
          )
        )
      return new Response(
        JSON.stringify({
          success: true,
          data: { id: 1, name: "Current student", role: "STUDENT" },
        })
      )
    })
    render(
      <StrictMode>
        <QueryClientProvider client={new QueryClient()}>
          <AuthProvider>
            <SessionStatus />
          </AuthProvider>
        </QueryClientProvider>
      </StrictMode>
    )
    expect(await screen.findByText("Current student")).toBeVisible()
    expect(tokenStore.get()).toBe("current-session")
  })
  it("does not clear a replacement session after an obsolete check fails", async () => {
    tokenStore.set("old-session")
    let reject: (error: Error) => void = () => {}
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((_resolve, fail) => {
          reject = fail
        })
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <SessionStatus />
        </AuthProvider>
      </QueryClientProvider>
    )
    tokenStore.set("replacement-session")
    await act(async () => {
      reject(new TypeError("interrupted"))
    })
    await waitFor(() =>
      expect(screen.queryByText("Checking")).not.toBeInTheDocument()
    )
    expect(tokenStore.get()).toBe("replacement-session")
  })
})

describe("protected routes", () => {
  it("redirects an unauthenticated visitor to login", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/students"]}>
            <Routes>
              <Route path="/login" element={<p>Login required</p>} />
              <Route element={<RequireAuth />}>
                <Route path="/students" element={<p>Protected students</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    )
    expect(await screen.findByText("Login required")).toBeInTheDocument()
    expect(screen.queryByText("Protected students")).not.toBeInTheDocument()
  })
})
