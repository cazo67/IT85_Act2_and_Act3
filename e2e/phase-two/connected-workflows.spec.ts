import { test, expect } from "../fixtures"
import { API_BASE_URL, apiDelete, apiList, apiPatch, apiToken, login, logout, rowContaining, selectOptionContaining } from "../helpers"

test("Admin provisions and links a student; Instructor creates and edits their class grade; Student sees the result", async ({ page, request }) => {
  test.setTimeout(180_000)
  const suffix = Date.now().toString(36).toUpperCase()
  const email = `e2e_phase2_${suffix.toLowerCase()}@example.com`
  const password = "StudentTest123!"
  const studentNumber = `E2E_P2_${suffix}`
  let accountId: number | undefined
  let studentId: number | undefined
  try {
    await login(page, "admin")
    await page.getByRole("link", { name: "Users", exact: true }).click()
    await page.getByRole("button", { name: "Create account" }).click()
    let dialog = page.getByRole("dialog")
    await dialog.getByLabel("Name").fill(`E2E_TEST_STUDENT_${suffix}`)
    await dialog.getByLabel("Email").fill(email)
    await dialog.getByLabel("Password", { exact: false }).fill(password)
    await dialog.getByRole("button", { name: "Create account" }).click()
    await expect(dialog).not.toBeVisible()
    const accounts = await apiList<{ id: number; email: string }>(request, "/users")
    accountId = accounts.find((item) => item.email === email)!.id
    const accountRow = rowContaining(page, email)
    await expect(accountRow).not.toContainText(password)
    await accountRow.getByRole("link", { name: "Create linked student" }).click()
    dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("combobox", { name: /^Linked student account/ })).toHaveValue(String(accountId))
    await dialog.getByLabel("Student number").fill(studentNumber)
    await dialog.getByLabel("First name").fill("PhaseTwo")
    await dialog.getByLabel("Last name").fill(suffix)
    await dialog.getByRole("combobox", { name: /^Program/ }).selectOption({ index: 1 })
    await dialog.getByLabel("Year level").selectOption("1")
    await dialog.getByRole("button", { name: "Create student" }).click()
    await expect(dialog).not.toBeVisible()
    const students = await apiList<{ id: number; student_number: string }>(request, "/students")
    studentId = students.find((item) => item.student_number === studentNumber)!.id
    await page.goto(`/students/${studentId}`)
    await expect(page.getByRole("heading", { name: "Student workspace" })).toBeVisible()
    await page.getByRole("link", { name: "View academic record" }).click()
    await expect(page).toHaveURL(new RegExp(`student_id=${studentId}`))
    await page.reload()
    await expect(page.getByRole("combobox", { name: "Student", exact: true })).toHaveValue(String(studentId))
    await expect(page.getByRole("heading", { name: `PhaseTwo ${suffix}` })).toBeVisible()
    await page.goto(`/students/${studentId}`)
    await page.getByRole("link", { name: "Enroll in a class" }).click()
    dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("combobox", { name: /^Student/ })).toHaveValue(String(studentId))
    await dialog.getByRole("combobox", { name: /^Course offering/ }).selectOption("1")
    await dialog.getByRole("button", { name: "Create enrollment" }).click()
    await expect(dialog).not.toBeVisible()

    await logout(page)
    await login(page, "instructor")
    await page.getByRole("link", { name: "Open my classes" }).click()
    await rowContaining(page, "A1").getByRole("button", { name: /^View course offering / }).click()
    await page.getByRole("link", { name: "Open class roster" }).click()
    await expect(page.getByRole("heading", { name: "Class roster" })).toBeVisible()
    const rosterRow = rowContaining(page, studentNumber)
    await rosterRow.getByRole("button", { name: "Create grade" }).click()
    dialog = page.getByRole("dialog")
    await expect(dialog).toContainText(studentNumber)
    await expect(dialog).toContainText("IT101")
    await dialog.getByLabel("Midterm grade").fill("85.5")
    await dialog.getByLabel("Final grade").fill("90.25")
    await dialog.getByRole("button", { name: "Create grade" }).click()
    await expect(dialog).not.toBeVisible()
    await expect(rosterRow).toContainText("90.25")
    await rosterRow.getByRole("button", { name: "Edit grade" }).click()
    await dialog.getByLabel("Final grade").fill("93.75")
    await dialog.getByRole("button", { name: "Save changes" }).click()
    await expect(dialog).not.toBeVisible()
    await page.reload()
    await expect(rowContaining(page, studentNumber)).toContainText("93.75")

    await logout(page)
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("heading", { name: /^Welcome,/ })).toBeVisible()
    await page.getByRole("link", { name: "My Grades", exact: true }).click()
    await expect(rowContaining(page, studentNumber)).toContainText("93.75")
    await expect(rowContaining(page, studentNumber)).toContainText("IT101")
    await page.getByRole("link", { name: "Academic Record", exact: true }).click()
    await expect(page.getByRole("cell", { name: "93.75", exact: true })).toBeVisible()
    await page.goto("/students/1")
    await expect(page.getByRole("alert")).toContainText("only their own record")
    await page.goto("/course-offerings/1")
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible()
    await page.goto("/users")
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible()
  } finally {
    // Grades/users have no delete endpoint; fixtures live only in the disposable database.
    if (studentId) await apiPatch(request, "/students", studentId, { status: "INACTIVE" })
    if (accountId) await apiPatch(request, "/users", accountId, { status: "INACTIVE" })
  }
})

test("Staff assigns an instructor by name while Users and unassigned Instructor rosters remain forbidden", async ({ page, request }) => {
  const section = `E2E_P2_${Date.now().toString(36)}`
  let offeringId: number | undefined
  try {
    await login(page, "staff")
    await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveCount(0)
    const staffToken = await apiToken(request, "staff")
    const directory = await request.get(`${API_BASE_URL}/directories/instructors`, { headers: { Authorization: `Bearer ${staffToken}` } })
    expect(directory.ok()).toBeTruthy()
    for (const item of (await directory.json()).data) expect(Object.keys(item).sort()).toEqual(["id", "name", "role", "status"])
    const denied = await request.get(`${API_BASE_URL}/users`, { headers: { Authorization: `Bearer ${staffToken}` } })
    expect(denied.status()).toBe(403)
    await page.goto("/course-offerings")
    await page.getByRole("button", { name: "Create course offering" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("combobox", { name: /^Course/ }).selectOption({ index: 1 })
    await dialog.getByRole("combobox", { name: /^Academic term/ }).selectOption({ index: 1 })
    await selectOptionContaining(dialog.getByRole("combobox", { name: /^Instructor/ }), "Instructor One")
    await dialog.getByLabel("Section").fill(section)
    await dialog.getByLabel("Schedule").fill("MWF 14:00-15:00")
    await dialog.getByLabel("Room").fill("Lab 2")
    await dialog.getByLabel("Capacity").fill("20")
    await dialog.getByRole("button", { name: "Create course offering" }).click()
    await expect(dialog).not.toBeVisible()
    const offerings = await apiList<{ id: number; section: string }>(request, "/course-offerings")
    offeringId = offerings.find((item) => item.section === section)!.id
    await page.goto("/users")
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible()
    await page.goto("/dashboard")
    await logout(page)
    await login(page, "instructor")
    await page.goto(`/course-offerings/${offeringId}`)
    await expect(page.getByRole("heading", { name: "Class roster" })).toBeVisible()
    await expect(page.getByText("No students enrolled in this class yet.")).toBeVisible()
    // Seeded offering 2 belongs to a different instructor.
    await page.goto("/course-offerings/2")
    await expect(page.getByRole("alert")).toContainText("Not an assigned offering")
  } finally {
    if (!offeringId) {
      const offerings = await apiList<{ id: number; section: string }>(request, "/course-offerings")
      offeringId = offerings.find((item) => item.section === section)?.id
    }
    if (offeringId) await apiDelete(request, "/course-offerings", offeringId)
  }
})
