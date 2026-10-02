import type { APIRequestContext, Locator, Page } from "@playwright/test"
import { expect } from "./fixtures"

export const API_BASE_URL = "http://127.0.0.1:8100/api/v1"

export const accounts = {
  admin: { email: "admin@example.com", password: "AdminPass123!" },
  staff: { email: "staff@example.com", password: "StaffPass123!" },
  instructor: { email: "instructor@example.com", password: "InstructorPass123!" },
  student: { email: "student@example.com", password: "StudentPass123!" },
} as const

export type AccountRole = keyof typeof accounts

export async function login(page: Page, role: AccountRole) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(accounts[role].email)
  await page.getByLabel("Password").fill(accounts[role].password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("heading", { name: /^Welcome,/ })).toBeVisible()
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
}

export async function openResource(page: Page, path: string, heading: string) {
  await page.goto(path)
  await expect(page.getByRole("heading", { name: heading })).toBeVisible()
}

export async function showOneHundredRows(page: Page) {
  const rows = page.getByLabel("Rows per page")
  await expect(rows).toBeVisible()
  if ((await rows.inputValue()) !== "100") {
    await rows.selectOption("100")
    await expect(page).toHaveURL(/per_page=100/)
  }
  await expect(page.getByText(/total.*Page \d+ of \d+/i)).toBeVisible()
}

export function rowContaining(page: Page, text: string): Locator {
  return page.getByRole("row").filter({ hasText: text }).first()
}

export async function findRowAcrossPages(page: Page, text: string, maximumPages = 5): Promise<Locator> {
  for (let pageNumber = 1; pageNumber <= maximumPages; pageNumber += 1) {
    const row = rowContaining(page, text)
    if (await row.count()) return row
    const next = page.getByRole("button", { name: "Next" })
    if (await next.isDisabled()) break
    const currentPage = Number(new URL(page.url()).searchParams.get("page") ?? "1")
    await next.click()
    await expect(page).toHaveURL(new RegExp(`page=${currentPage + 1}`))
    await expect(page.getByText(new RegExp(`Page ${currentPage + 1} of`))).toBeVisible()
  }
  const missing = rowContaining(page, text)
  await expect(missing, `Expected a table row containing ${text}`).toBeVisible()
  return missing
}

export async function apiToken(request: APIRequestContext, role: AccountRole = "admin") {
  const response = await request.post(`${API_BASE_URL}/auth/login`, { data: accounts[role] })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.access_token as string
}

export async function apiList<T>(request: APIRequestContext, path: string, role: AccountRole = "admin") {
  const token = await apiToken(request, role)
  const records: T[] = []
  let page = 1
  while (true) {
    const response = await request.get(`${API_BASE_URL}${path}${path.includes("?") ? "&" : "?"}page=${page}&per_page=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    records.push(...((body.data ?? []) as T[]))
    const lastPage = Number(body.meta?.last_page ?? 1)
    if (page >= lastPage) break
    page += 1
  }
  return records
}

export async function apiDelete(request: APIRequestContext, path: string, id: number) {
  const token = await apiToken(request)
  return request.delete(`${API_BASE_URL}${path}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function apiPatch(request: APIRequestContext, path: string, id: number, data: Record<string, unknown>) {
  const token = await apiToken(request)
  return request.patch(`${API_BASE_URL}${path}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
}

export async function cleanupByField(
  request: APIRequestContext,
  path: string,
  field: string,
  value: string | number,
) {
  const records = await apiList<Array<Record<string, unknown>>[number]>(request, path)
  for (const record of records) {
    if (record[field] === value) await apiDelete(request, path, Number(record.id))
  }
}

export async function selectOptionContaining(select: Locator, text: string) {
  const option = select.locator("option").filter({ hasText: text }).first()
  const value = await option.getAttribute("value")
  expect(value, `Expected an option containing ${text}`).toBeTruthy()
  await select.selectOption(value!)
}
