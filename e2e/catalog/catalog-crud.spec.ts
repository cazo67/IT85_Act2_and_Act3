import type { Page } from "@playwright/test"

import { test, expect } from "../fixtures"
import {
  cleanupByField,
  login,
  logout,
  openResource,
  rowContaining,
  showOneHundredRows,
} from "../helpers"

type CatalogCase = {
  heading: string
  path: string
  apiPath: string
  singular: string
  identityField: string
  identity: (suffix: string) => string
  originalVisible: (suffix: string) => string
  updatedVisible: (suffix: string) => string
  fillCreate: (page: Page, suffix: string) => Promise<void>
  fillUpdate: (page: Page, suffix: string) => Promise<void>
}

const cases: CatalogCase[] = [
  {
    heading: "Programs",
    path: "/programs",
    apiPath: "/programs",
    singular: "program",
    identityField: "code",
    identity: (suffix) => `E2E_${suffix}`,
    originalVisible: (suffix) => `E2E Test Program ${suffix}`,
    updatedVisible: (suffix) => `E2E Test Program ${suffix} Updated`,
    fillCreate: async (page, suffix) => {
      const dialog = page.getByRole("dialog")
      await dialog.getByLabel("Program code").fill(`E2E_${suffix}`)
      await dialog.getByLabel("Program name").fill(`E2E Test Program ${suffix}`)
      await dialog.getByLabel("Description").fill("E2E_TEST program created through the UI")
    },
    fillUpdate: async (page, suffix) => {
      await page.getByRole("dialog").getByLabel("Program name").fill(`E2E Test Program ${suffix} Updated`)
    },
  },
  {
    heading: "Courses",
    path: "/courses",
    apiPath: "/courses",
    singular: "course",
    identityField: "course_code",
    identity: (suffix) => `E2E_${suffix}`,
    originalVisible: (suffix) => `E2E Test Course ${suffix}`,
    updatedVisible: (suffix) => `E2E Test Course ${suffix} Updated`,
    fillCreate: async (page, suffix) => {
      const dialog = page.getByRole("dialog")
      await dialog.getByLabel("Course code").fill(`E2E_${suffix}`)
      await dialog.getByLabel("Course title").fill(`E2E Test Course ${suffix}`)
      await dialog.getByLabel("Description").fill("E2E_TEST course created through the UI")
      await dialog.getByLabel("Units").fill("3")
    },
    fillUpdate: async (page, suffix) => {
      await page.getByRole("dialog").getByLabel("Course title").fill(`E2E Test Course ${suffix} Updated`)
    },
  },
  {
    heading: "Academic Terms",
    path: "/academic-terms",
    apiPath: "/academic-terms",
    singular: "academic term",
    identityField: "academic_year",
    identity: (suffix) => `E2E-${suffix}`,
    originalVisible: (suffix) => `E2E Semester ${suffix}`,
    updatedVisible: (suffix) => `E2E Semester ${suffix} Updated`,
    fillCreate: async (page, suffix) => {
      const dialog = page.getByRole("dialog")
      await dialog.getByLabel("Academic year").fill(`E2E-${suffix}`)
      await dialog.getByLabel("Semester").fill(`E2E Semester ${suffix}`)
      await dialog.getByLabel("Start date").fill("2030-01-01")
      await dialog.getByLabel("End date").fill("2030-05-31")
    },
    fillUpdate: async (page, suffix) => {
      await page.getByRole("dialog").getByLabel("Semester").fill(`E2E Semester ${suffix} Updated`)
    },
  },
]

for (const catalog of cases) {
  test(`${catalog.heading}: admin CRUD persists and reflects to a read-only student`, async ({ page, request }, testInfo) => {
    const suffix = `${Date.now().toString(36)}${testInfo.workerIndex}`.toUpperCase()
    const identity = catalog.identity(suffix)

    try {
      await login(page, "admin")
      await openResource(page, catalog.path, catalog.heading)
      await showOneHundredRows(page)

      await page.getByRole("button", { name: `Create ${catalog.singular}` }).click()
      await catalog.fillCreate(page, suffix)
      await page.getByRole("dialog").getByRole("button", { name: `Create ${catalog.singular}` }).click()
      await expect(page.getByText(new RegExp(`${catalog.singular} created successfully`, "i"))).toBeVisible()
      await expect(rowContaining(page, identity)).toContainText(catalog.originalVisible(suffix))

      await page.reload()
      await showOneHundredRows(page)
      await expect(rowContaining(page, identity)).toContainText(catalog.originalVisible(suffix))

      await logout(page)
      await login(page, "student")
      await openResource(page, catalog.path, catalog.heading)
      await showOneHundredRows(page)
      const studentRow = rowContaining(page, identity)
      await expect(studentRow).toContainText(catalog.originalVisible(suffix))
      await expect(studentRow.getByRole("button", { name: "Edit" })).toHaveCount(0)

      await logout(page)
      await login(page, "admin")
      await openResource(page, catalog.path, catalog.heading)
      await showOneHundredRows(page)
      await rowContaining(page, identity).getByRole("button", { name: "Edit" }).click()
      await catalog.fillUpdate(page, suffix)
      await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click()
      await expect(rowContaining(page, identity)).toContainText(catalog.updatedVisible(suffix))

      await page.reload()
      await showOneHundredRows(page)
      await expect(rowContaining(page, identity)).toContainText(catalog.updatedVisible(suffix))

      await logout(page)
      await login(page, "student")
      await openResource(page, catalog.path, catalog.heading)
      await showOneHundredRows(page)
      await expect(rowContaining(page, identity)).toContainText(catalog.updatedVisible(suffix))

      await logout(page)
      await login(page, "admin")
      await openResource(page, catalog.path, catalog.heading)
      await showOneHundredRows(page)
      page.once("dialog", (dialog) => dialog.accept())
      await rowContaining(page, identity).getByRole("button", { name: "Delete" }).click()
      await expect(rowContaining(page, identity)).toHaveCount(0)

      await logout(page)
      await login(page, "student")
      await openResource(page, catalog.path, catalog.heading)
      await showOneHundredRows(page)
      await expect(rowContaining(page, identity)).toHaveCount(0)
    } finally {
      await cleanupByField(request, catalog.apiPath, catalog.identityField, identity)
    }
  })
}
