import { test, expect } from "../fixtures"
import {
  cleanupByField,
  login,
  logout,
  openResource,
  rowContaining,
} from "../helpers"

async function searchStudent(page: Parameters<typeof login>[0], studentNumber: string) {
  await page.getByLabel("Search students").fill(studentNumber)
  await expect(page).toHaveURL(new RegExp(`search=${studentNumber}`), { timeout: 10_000 })
}

test("student CRUD persists, reflects to Staff, and remains scoped away from another Student", async ({ page, request }, testInfo) => {
  const suffix = `${Date.now().toString().slice(-8)}${testInfo.workerIndex}`
  const studentNumber = `E2E_TEST_${suffix}`

  try {
    await login(page, "admin")
    await openResource(page, "/students", "Students")
    await page.getByRole("button", { name: "Create student" }).click()

    const createDialog = page.getByRole("dialog")
    await createDialog.getByLabel("Student number").fill(studentNumber)
    await createDialog.getByLabel("First name").fill("E2E Test")
    await createDialog.getByLabel("Last name").fill("Student")
    await createDialog.getByLabel("Email").fill(`${studentNumber.toLowerCase()}@example.com`)
    await createDialog.getByLabel("Program").selectOption({ index: 1 })
    await createDialog.getByLabel("Year level").selectOption("1")
    await createDialog.getByRole("button", { name: "Create student" }).click()
    await expect(page.getByText("Student created successfully.")).toBeVisible()

    await searchStudent(page, studentNumber)
    await expect(rowContaining(page, studentNumber)).toContainText("E2E Test Student")
    await page.reload()
    await expect(rowContaining(page, studentNumber)).toBeVisible()

    await page.getByRole("button", { name: "Create student" }).click()
    const duplicateDialog = page.getByRole("dialog")
    await duplicateDialog.getByLabel("Student number").fill(studentNumber)
    await duplicateDialog.getByLabel("First name").fill("Duplicate")
    await duplicateDialog.getByLabel("Last name").fill("Rejected")
    await duplicateDialog.getByLabel("Program").selectOption({ index: 1 })
    await duplicateDialog.getByLabel("Year level").selectOption("1")
    await duplicateDialog.getByRole("button", { name: "Create student" }).click()
    await expect(duplicateDialog.getByText(/student number or linked user already exists/i)).toBeVisible()
    await duplicateDialog.getByRole("button", { name: "Cancel" }).click()

    await logout(page)
    await login(page, "staff")
    await openResource(page, "/students", "Students")
    await searchStudent(page, studentNumber)
    const staffRow = rowContaining(page, studentNumber)
    await expect(staffRow).toBeVisible()
    await expect(staffRow.getByRole("button", { name: "Delete" })).toHaveCount(0)
    await staffRow.getByRole("button", { name: "Edit" }).click()
    await page.getByRole("dialog").getByLabel("Last name").fill("Student Updated")
    await page.getByRole("dialog").getByLabel("Year level").selectOption("2")
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click()
    await expect(rowContaining(page, studentNumber)).toContainText("Student Updated")

    page.once("dialog", (dialog) => dialog.accept())
    await rowContaining(page, studentNumber).getByRole("button", { name: "Deactivate" }).click()
    await expect(rowContaining(page, studentNumber)).toContainText("INACTIVE")
    await page.reload()
    await expect(rowContaining(page, studentNumber)).toContainText("INACTIVE")

    await logout(page)
    await login(page, "student")
    await openResource(page, "/students", "Students")
    await searchStudent(page, studentNumber)
    await expect(rowContaining(page, studentNumber)).toHaveCount(0)

    await logout(page)
    await login(page, "admin")
    await openResource(page, "/students", "Students")
    await searchStudent(page, studentNumber)
    const adminRow = rowContaining(page, studentNumber)
    await expect(adminRow).toContainText("Student Updated")
    await expect(adminRow).toContainText("INACTIVE")

    page.once("dialog", (dialog) => dialog.accept())
    await adminRow.getByRole("button", { name: "Delete" }).click()
    await expect(rowContaining(page, studentNumber)).toHaveCount(0)
    await page.reload()
    await expect(rowContaining(page, studentNumber)).toHaveCount(0)

    await logout(page)
    await login(page, "staff")
    await openResource(page, "/students", "Students")
    await searchStudent(page, studentNumber)
    await expect(rowContaining(page, studentNumber)).toHaveCount(0)
  } finally {
    await cleanupByField(request, "/students", "student_number", studentNumber)
  }
})
