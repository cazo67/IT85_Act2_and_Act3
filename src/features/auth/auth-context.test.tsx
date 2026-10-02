import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { AuthProvider } from "./auth-context"
import { RequireAuth } from "./require-auth"

describe("protected routes", () => {
  it("redirects an unauthenticated visitor to login", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/students"]}>
            <Routes>
              <Route path="/login" element={<p>Login required</p>} />
              <Route element={<RequireAuth />}><Route path="/students" element={<p>Protected students</p>} /></Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    )
    expect(await screen.findByText("Login required")).toBeInTheDocument()
    expect(screen.queryByText("Protected students")).not.toBeInTheDocument()
  })
})
