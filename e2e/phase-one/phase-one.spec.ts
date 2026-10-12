import { test, expect } from "../fixtures"
import { API_BASE_URL, accounts, apiDelete, apiList, apiPatch, login, rowContaining } from "../helpers"

test("grade selector includes authorized enrollments beyond the first 100", async ({ page }) => {
  await login(page, "admin")
  await page.getByRole("link", { name: "Grades", exact: true }).click()
  await page.getByRole("button", { name: "Create grade" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("option", { name: /^Enrollment #101 —/ })).toBeAttached()
  await dialog.getByLabel("Search enrollment options").fill("Enrollment #101")
  await dialog.getByRole("combobox", { name: /Enrollment/ }).selectOption("101")
  await expect(dialog.getByRole("combobox", { name: /Enrollment/ })).toHaveValue("101")
  await dialog.getByRole("button", { name: "Cancel" }).click()
})

test("a resource save refreshes previously cached dashboard totals immediately", async ({ page, request }) => {
  const code = `E2E_TEST_P1_${Date.now().toString(36)}`
  try {
    await login(page, "admin")
    const summary = page.locator("main").getByText("Programs", { exact: true }).locator("..").getByRole("heading")
    await expect(summary).toHaveText(/^\d+$/)
    const before = Number(await summary.textContent())
    await page.getByRole("link", { name: "Programs", exact: true }).click()
    await page.getByRole("button", { name: "Create program" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Program code").fill(code)
    await dialog.getByLabel("Program name").fill("Phase one cache regression")
    await dialog.getByRole("button", { name: "Create program" }).click()
    await expect(dialog).not.toBeVisible()
    await page.getByRole("link", { name: "Dashboard", exact: true }).click()
    await expect(summary).toHaveText(String(before + 1))
  } finally {
    const records = await apiList<{ id: number; code: string }>(request, "/programs")
    const created = records.find((item) => item.code === code)
    if (created) await apiDelete(request, "/programs", created.id)
  }
})

test("a student refresh retrieves an instructor change while both sessions remain open", async ({ page, browser, request }) => {
  const grades = await apiList<{ id: number; enrollment_id: number; final_grade: number; remarks: string | null }>(request, "/grades")
  const original = grades.find((item) => item.enrollment_id === 1)!
  expect(original).toBeTruthy()
  const studentContext = await browser.newContext({ baseURL: "http://localhost:3100" })
  const studentPage = await studentContext.newPage()
  try {
    await login(page, "instructor")
    await page.getByRole("link", { name: "My Grades", exact: true }).click()
    await expect(rowContaining(page, "Enrollment #1")).toBeVisible()
    await login(studentPage, "student")
    await studentPage.getByRole("link", { name: "Academic Record", exact: true }).click()
    await expect(studentPage.getByRole("heading", { name: "Demo Student" })).toBeVisible()
    const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, { data: accounts.instructor })
    const token = (await loginResponse.json()).data.access_token
    const response = await request.patch(`${API_BASE_URL}/grades/${original.id}`, { headers: { Authorization: `Bearer ${token}` }, data: { final_grade: 92.15, remarks: null } })
    expect(response.ok()).toBeTruthy()
    await studentPage.getByRole("button", { name: "Refresh", exact: true }).click()
    await expect(studentPage.getByRole("cell", { name: "92.15", exact: true })).toBeVisible()
    await expect(studentPage.getByRole("cell", { name: "No remarks", exact: true })).toBeVisible()
    await expect(studentPage.getByRole("heading", { name: "Academic Record", exact: true })).toBeVisible()
  } finally {
    await studentContext.close()
    await apiPatch(request, "/grades", original.id, { final_grade: original.final_grade, remarks: original.remarks })
  }
})
