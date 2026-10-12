import { test, expect } from "../fixtures"
import { API_BASE_URL, login, rowContaining } from "../helpers"

test("keyboard mobile navigation contains focus, closes with Escape and restores its trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, "admin")
  const trigger = page.getByRole("button", { name: "Open navigation" })
  await trigger.focus()
  await page.keyboard.press("Enter")
  const drawer = page.getByRole("dialog", { name: "Navigation", exact: true })
  await expect(drawer).toBeVisible()
  await expect(
    drawer.getByRole("button", { name: "Close navigation" })
  ).toBeFocused()
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab")
    expect(
      await drawer.evaluate((element) =>
        element.contains(document.activeElement)
      )
    ).toBe(true)
  }
  await page.keyboard.press("Shift+Tab")
  expect(
    await drawer.evaluate((element) => element.contains(document.activeElement))
  ).toBe(true)
  await page.keyboard.press("Escape")
  await expect(drawer).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.press("Enter")
  await drawer.getByRole("link", { name: "Students", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Students", exact: true })
  ).toBeVisible()
  await expect(drawer).not.toBeVisible()
  await page.getByRole("link", { name: "Skip to content" }).focus()
  await page.keyboard.press("Enter")
  await expect(page.locator("#main-content")).toBeFocused()
})

test("student search survives Back/Forward, cancels pending navigation edits and validates numeric pages", async ({
  page,
}) => {
  await login(page, "admin")
  await page.goto(
    "/students?page=NaN&per_page=1.5&program_id=bad&year_level=wrong"
  )
  await expect(page.getByLabel("Rows per page")).toHaveValue("20")
  await expect(page.getByText(/Page 1 of/)).toBeVisible()
  const search = page.getByRole("textbox", { name: "Search students" })
  await search.fill("Student1")
  await expect(page).toHaveURL(/search=Student1/)
  await search.fill("Student2")
  await expect(page).toHaveURL(/search=Student2/)
  await page.goBack()
  await expect(search).toHaveValue("Student1")
  // Wait for a visible data response, then ensure the old debounce did not rewrite history.
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true })
  ).toBeEnabled()
  await expect(page).toHaveURL(/search=Student1/)
  await page.goForward()
  await expect(search).toHaveValue("Student2")
  await search.fill("Pending draft")
  await page.getByRole("link", { name: "Programs", exact: true }).click()
  await expect(page).toHaveURL(/\/programs$/)
  await page.getByRole("link", { name: "Students", exact: true }).click()
  await expect(search).toHaveValue("")
  await expect(page).toHaveURL(/\/students$/)
})

test("draft discard, error association, retry and pending save preserve the intended form", async ({
  page,
}) => {
  await login(page, "admin")
  await page.goto("/programs")
  await page
    .getByRole("button", { name: "Create program", exact: true })
    .click()
  const dialog = page.getByRole("dialog", {
    name: "Create program",
    exact: true,
  })
  await dialog.getByLabel(/code/i).fill("PHASE3_DRAFT")
  await dialog.getByLabel(/name/i).fill("Preserved name")
  page.once("dialog", async (prompt) => {
    expect(prompt.message()).toContain("Discard unsaved changes")
    await prompt.dismiss()
  })
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog.getByLabel(/name/i)).toHaveValue("Preserved name")
  let attempts = 0
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`${API_BASE_URL}/programs`, async (route) => {
    if (route.request().method() !== "POST") return route.continue()
    attempts++
    if (attempts === 1)
      return route.fulfill({
        status: 422,
        json: {
          success: false,
          message: "Code needs attention.",
          errors: { code: ["This code is already in use."] },
        },
      })
    await gate
    return route.fulfill({
      status: 503,
      json: { success: false, message: "Temporary save failure. Retry." },
    })
  })
  await dialog
    .getByRole("button", { name: "Create program", exact: true })
    .click()
  const code = dialog.getByLabel(/code/i)
  await expect(code).toBeFocused()
  await expect(code).toHaveAttribute("aria-invalid", "true")
  await expect(code).toHaveAccessibleDescription("This code is already in use.")
  await expect(dialog.getByLabel(/name/i)).toHaveValue("Preserved name")
  await dialog
    .getByRole("button", { name: "Create program", exact: true })
    .click()
  await expect(dialog.getByRole("button", { name: /Saving/ })).toBeDisabled()
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()
  expect(attempts).toBe(2)
  release()
  await expect(dialog.getByText("Temporary save failure. Retry.")).toBeVisible()
  await expect(dialog.getByLabel(/name/i)).toHaveValue("Preserved name")
  page.once("dialog", async (prompt) => {
    await prompt.accept()
  })
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).not.toBeVisible()
  await page.unroute(`${API_BASE_URL}/programs`)
  const row = rowContaining(page, "BSIT")
  page.once("dialog", async (prompt) => {
    expect(prompt.message()).toContain("BSIT")
    await prompt.dismiss()
  })
  await row.getByRole("button", { name: /^Delete program/ }).click()
  await expect(row).toBeVisible()
})

test("essential actions and internal table scrolling remain reachable at responsive widths and 200-percent scale", async ({
  page,
}) => {
  await login(page, "admin")
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/students")
    await expect(
      page.getByRole("button", { name: "Create student", exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("region", { name: "Students table" })
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true)
    const table = page.getByRole("region", { name: "Students table" })
    await table.focus()
    await expect(table).toBeFocused()
    await page.keyboard.press("ArrowRight")
    await expect
      .poll(() =>
        table.evaluate(
          (element) =>
            element.scrollLeft > 0 || element.scrollWidth <= element.clientWidth
        )
      )
      .toBe(true)
    await page
      .getByRole("button", { name: "Create student", exact: true })
      .click()
    const dialog = page.getByRole("dialog", {
      name: "Create student",
      exact: true,
    })
    await expect(dialog).toBeVisible()
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1
      )
    ).toBe(true)
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await page.goto("/course-offerings/1")
    await expect(
      page.getByRole("heading", { name: "Class roster" })
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true)
    await page.goto("/academic-record?student_id=1")
    await expect(
      page
        .getByRole("columnheader", { name: "Enrollment", exact: true })
        .first()
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true)
  }
  // CSS zoom checks magnified content; it is not a claim of native browser zoom/manual acceptance.
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2"
  })
  expect(
    await page.evaluate(
      () =>
        document.documentElement.getBoundingClientRect().width <= innerWidth + 1
    )
  ).toBe(true)
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true })
  ).toBeVisible()
  await page.evaluate(() => {
    document.documentElement.style.zoom = ""
  })
  // A 720px CSS viewport additionally checks reflow for a 1440px display at 200% zoom.
  await page.setViewportSize({ width: 720, height: 450 })
  await page.getByRole("button", { name: "Open navigation" }).click()
  await expect(
    page.getByRole("dialog", { name: "Navigation", exact: true })
  ).toBeVisible()
  await page.keyboard.press("Escape")
})
