import { test, expect } from "../fixtures"
import {
  apiDelete,
  apiList,
  apiPatch,
  findRowAcrossPages,
  login,
  logout,
  openResource,
  rowContaining,
  selectOptionContaining,
  showOneHundredRows,
} from "../helpers"

type OfferingRecord = { id: number; section: string }
type EnrollmentRecord = { id: number; course_offering_id: number }
type GradeRecord = { id: number; enrollment_id: number; midterm_grade: number; final_grade: number; remarks: string | null }

test("offering and enrollment changes reflect across Admin, Instructor, and Student roles", async ({ page, request }, testInfo) => {
  const suffix = `${Date.now().toString(36)}${testInfo.workerIndex}`.toUpperCase()
  const originalSection = `E2E_${suffix}`
  const updatedSection = `${originalSection}_UPD`
  let offeringId: number | undefined

  try {
    await login(page, "admin")
    await openResource(page, "/course-offerings", "Course Offerings")
    await showOneHundredRows(page)
    await page.getByRole("button", { name: "Create course offering" }).click()

    const offeringDialog = page.getByRole("dialog")
    await offeringDialog.getByLabel("Course").selectOption({ index: 1 })
    await offeringDialog.getByLabel("Academic term").selectOption({ index: 1 })
    await offeringDialog.getByLabel("Instructor user ID").fill("3")
    await offeringDialog.getByLabel("Section").fill(originalSection)
    await offeringDialog.getByLabel("Schedule").fill("E2E_TEST MWF 13:00-14:00")
    await offeringDialog.getByLabel("Room").fill("E2E-LAB")
    await offeringDialog.getByLabel("Capacity").fill("10")
    await offeringDialog.getByRole("button", { name: "Create course offering" }).click()
    await expect(rowContaining(page, originalSection)).toBeVisible()
    await page.reload()
    await showOneHundredRows(page)
    await expect(rowContaining(page, originalSection)).toBeVisible()

    const offerings = await apiList<OfferingRecord>(request, "/course-offerings")
    offeringId = offerings.find((offering) => offering.section === originalSection)?.id
    expect(offeringId).toBeTruthy()

    await logout(page)
    await login(page, "instructor")
    await openResource(page, "/course-offerings", "Course Offerings")
    await expect(rowContaining(page, originalSection)).toBeVisible()

    await logout(page)
    await login(page, "student")
    await openResource(page, "/course-offerings", "Course Offerings")
    await expect(rowContaining(page, originalSection)).toHaveCount(0)

    await logout(page)
    await login(page, "admin")
    await openResource(page, "/course-offerings", "Course Offerings")
    await showOneHundredRows(page)
    await rowContaining(page, originalSection).getByRole("button", { name: "Edit" }).click()
    await page.getByRole("dialog").getByLabel("Section").fill(updatedSection)
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click()
    await expect(rowContaining(page, updatedSection)).toBeVisible()
    await expect(page.getByRole("cell", { name: originalSection, exact: true })).toHaveCount(0)

    await openResource(page, "/enrollments", "Enrollments")
    await page.getByRole("button", { name: "Create enrollment" }).click()
    const enrollmentDialog = page.getByRole("dialog")
    await selectOptionContaining(enrollmentDialog.getByLabel("Student"), "2026-00001")
    await selectOptionContaining(enrollmentDialog.getByLabel("Course offering"), updatedSection)
    await enrollmentDialog.getByRole("button", { name: "Create enrollment" }).click()
    await showOneHundredRows(page)
    await expect(await findRowAcrossPages(page, updatedSection)).toContainText("Demo Student")

    await page.reload()
    await showOneHundredRows(page)
    await expect(await findRowAcrossPages(page, updatedSection)).toBeVisible()

    await logout(page)
    await login(page, "instructor")
    await openResource(page, "/course-offerings", "Course Offerings")
    await expect(rowContaining(page, updatedSection)).toBeVisible()
    await openResource(page, "/enrollments", "Enrollments")
    await showOneHundredRows(page)
    await expect(await findRowAcrossPages(page, updatedSection)).toContainText("Demo Student")

    await logout(page)
    await login(page, "student")
    await openResource(page, "/course-offerings", "Course Offerings")
    await expect(rowContaining(page, updatedSection)).toBeVisible()
    await openResource(page, "/enrollments", "Enrollments")
    await expect(rowContaining(page, updatedSection)).toContainText("ACTIVE")

    await logout(page)
    await login(page, "admin")
    await openResource(page, "/enrollments", "Enrollments")
    await showOneHundredRows(page)
    const enrollmentRow = await findRowAcrossPages(page, updatedSection)
    await enrollmentRow.getByRole("button", { name: "Edit" }).click()
    await page.getByRole("dialog").getByLabel("Status").selectOption("INACTIVE")
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click()
    await expect(await findRowAcrossPages(page, updatedSection)).toContainText("INACTIVE")

    await logout(page)
    await login(page, "student")
    await openResource(page, "/enrollments", "Enrollments")
    await expect(rowContaining(page, updatedSection)).toContainText("INACTIVE")

    await logout(page)
    await login(page, "admin")
    await openResource(page, "/enrollments", "Enrollments")
    await showOneHundredRows(page)
    const rowToDelete = await findRowAcrossPages(page, updatedSection)
    page.once("dialog", (dialog) => dialog.accept())
    await rowToDelete.getByRole("button", { name: "Delete" }).click()
    await expect(rowContaining(page, updatedSection)).toHaveCount(0)

    await logout(page)
    await login(page, "student")
    await openResource(page, "/enrollments", "Enrollments")
    await expect(rowContaining(page, updatedSection)).toHaveCount(0)
    await openResource(page, "/course-offerings", "Course Offerings")
    await expect(rowContaining(page, updatedSection)).toHaveCount(0)

    await logout(page)
    await login(page, "admin")
    await openResource(page, "/course-offerings", "Course Offerings")
    await showOneHundredRows(page)
    page.once("dialog", (dialog) => dialog.accept())
    await rowContaining(page, updatedSection).getByRole("button", { name: "Delete" }).click()
    await expect(rowContaining(page, updatedSection)).toHaveCount(0)

    await logout(page)
    await login(page, "instructor")
    await openResource(page, "/course-offerings", "Course Offerings")
    await expect(rowContaining(page, updatedSection)).toHaveCount(0)
  } finally {
    if (!offeringId) {
      const offerings = await apiList<OfferingRecord>(request, "/course-offerings")
      offeringId = offerings.find((offering) => offering.section === originalSection || offering.section === updatedSection)?.id
    }
    if (offeringId) {
      const enrollments = await apiList<EnrollmentRecord>(request, "/enrollments")
      for (const enrollment of enrollments.filter((item) => item.course_offering_id === offeringId)) {
        await apiDelete(request, "/enrollments", enrollment.id)
      }
      await apiDelete(request, "/course-offerings", offeringId)
    }
  }
})

test("Instructor grade update persists and reflects to the Student grade list and academic record", async ({ page, request }) => {
  const grades = await apiList<GradeRecord>(request, "/grades")
  const original = grades.find((grade) => grade.enrollment_id === 1)
  expect(original).toBeTruthy()

  try {
    await login(page, "instructor")
    await openResource(page, "/grades", "Grades")
    await showOneHundredRows(page)
    const instructorRow = rowContaining(page, "Enrollment #1")
    await expect(instructorRow).toBeVisible()
    await instructorRow.getByRole("button", { name: "Edit" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Midterm grade").fill("88.25")
    await dialog.getByLabel("Final grade").fill("91.75")
    await dialog.getByLabel("Remarks").fill("E2E_TEST_UPDATED")
    await dialog.getByRole("button", { name: "Save changes" }).click()
    await expect(rowContaining(page, "Enrollment #1")).toContainText("88.25")
    await expect(rowContaining(page, "Enrollment #1")).toContainText("91.75")

    await page.reload()
    await showOneHundredRows(page)
    await expect(rowContaining(page, "Enrollment #1")).toContainText("E2E_TEST_UPDATED")

    await logout(page)
    await login(page, "student")
    await openResource(page, "/grades", "Grades")
    const studentGrade = rowContaining(page, "Enrollment #1")
    await expect(studentGrade).toContainText("88.25")
    await expect(studentGrade).toContainText("91.75")
    await expect(studentGrade).toContainText("E2E_TEST_UPDATED")
    await expect(studentGrade.getByRole("button", { name: "Edit" })).toHaveCount(0)

    await openResource(page, "/academic-record", "Academic Record")
    await expect(page.getByText("88.25", { exact: true })).toBeVisible()
    await expect(page.getByText("91.75", { exact: true })).toBeVisible()
    await expect(page.getByText("E2E_TEST_UPDATED", { exact: true })).toBeVisible()
  } finally {
    if (original) {
      await apiPatch(request, "/grades", original.id, {
        midterm_grade: original.midterm_grade,
        final_grade: original.final_grade,
        remarks: original.remarks,
      })
    }
  }
})
