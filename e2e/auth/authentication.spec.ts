import { test, expect } from "../fixtures"
import { API_BASE_URL, accounts, login } from "../helpers"

test.describe("Authentication and session lifecycle", () => {
  test("invalid credentials are rejected with useful feedback", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(accounts.admin.email)
    await page.getByLabel("Password").fill("WrongPass123!")
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page.getByRole("alert")).toContainText(/invalid email or password/i)
    await expect(page).toHaveURL(/\/login$/)
  })

  test("valid login persists across refresh and logout revokes the token", async ({ page, request }) => {
    await login(page, "admin")
    const token = await page.evaluate(() => sessionStorage.getItem("sims.access-token"))
    expect(token).toBeTruthy()

    await page.reload()
    await expect(page.getByRole("heading", { name: "Welcome, Demo Administrator" })).toBeVisible()

    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()

    const revoked = await request.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(revoked.status()).toBe(401)

    await page.goto("/students")
    await expect(page).toHaveURL(/\/login$/)
  })
})
