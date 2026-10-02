import { test, expect } from "../fixtures"
import { API_BASE_URL, accounts, login, openResource, rowContaining } from "../helpers"

test.describe("Role-based authorization", () => {
  test("student has read-only catalog UI and backend rejects a direct create", async ({ page }) => {
    await login(page, "student")
    await openResource(page, "/programs", "Programs")

    await expect(page.getByRole("button", { name: "Create program" })).toHaveCount(0)
    const seededProgram = rowContaining(page, "BSIT")
    await expect(seededProgram).toBeVisible()
    await expect(seededProgram.getByRole("button", { name: "View" })).toBeVisible()
    await expect(seededProgram.getByRole("button", { name: "Edit" })).toHaveCount(0)
    await expect(seededProgram.getByRole("button", { name: "Delete" })).toHaveCount(0)

    const status = await page.evaluate(async ({ apiBaseUrl }) => {
      const token = sessionStorage.getItem("sims.access-token")
      const response = await fetch(`${apiBaseUrl}/programs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: "E2E_TEST_FORBIDDEN", name: "Forbidden program", status: "ACTIVE" }),
      })
      return response.status
    }, { apiBaseUrl: API_BASE_URL })
    expect(status).toBe(403)
  })

  test("student cannot read another student's record through a direct URL request", async ({ page }) => {
    await login(page, "student")
    const status = await page.evaluate(async ({ apiBaseUrl }) => {
      const token = sessionStorage.getItem("sims.access-token")
      return fetch(`${apiBaseUrl}/students/2`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => response.status)
    }, { apiBaseUrl: API_BASE_URL })
    expect(status).toBe(403)
  })

  test("staff cannot access the admin-only users endpoint", async ({ request }) => {
    const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, { data: accounts.staff })
    const token = (await loginResponse.json()).data.access_token as string
    const response = await request.get(`${API_BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status()).toBe(403)
  })
})
