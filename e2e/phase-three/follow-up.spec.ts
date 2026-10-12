import { test, expect } from "../fixtures"
import { API_BASE_URL, login } from "../helpers"
import { textContrast } from "./contrast-support"

test("Back and Forward retain a cancelled draft and leave only after explicit discard", async ({
  page,
}) => {
  await login(page, "admin")
  await page.getByRole("link", { name: "Programs", exact: true }).click()
  await page.getByRole("link", { name: "Students", exact: true }).click()
  await page
    .getByRole("button", { name: "Create student", exact: true })
    .click()
  const editor = page.getByRole("dialog", {
    name: "Create student",
    exact: true,
  })
  await editor
    .getByLabel("First name", { exact: false })
    .fill("Keep this draft")
  await page.evaluate(() => history.back())
  const prompt = page.getByRole("dialog", {
    name: "Discard unsaved changes?",
    exact: true,
  })
  await expect(prompt).toBeVisible()
  await expect(
    prompt.getByRole("button", { name: "Keep editing" })
  ).toBeFocused()
  await prompt.getByRole("button", { name: "Keep editing" }).click()
  await expect(page).toHaveURL(/\/students$/)
  await expect(editor.getByLabel("First name", { exact: false })).toHaveValue(
    "Keep this draft"
  )
  await page.evaluate(() => history.back())
  await prompt.getByRole("button", { name: "Discard and leave" }).click()
  await expect(page).toHaveURL(/\/programs$/)
  await expect(editor).not.toBeVisible()
  await page
    .getByRole("button", { name: "Create program", exact: true })
    .click()
  const programEditor = page.getByRole("dialog", {
    name: "Create program",
    exact: true,
  })
  await programEditor.getByLabel(/code/i).fill("Forward draft")
  await page.evaluate(() => history.forward())
  await prompt.getByRole("button", { name: "Keep editing" }).click()
  await expect(page).toHaveURL(/\/programs$/)
  await expect(programEditor.getByLabel(/code/i)).toHaveValue("Forward draft")
  await page.evaluate(() => history.forward())
  await prompt.getByRole("button", { name: "Discard and leave" }).click()
  await expect(page).toHaveURL(/\/students$/)
  await expect(page.getByRole("dialog")).not.toBeVisible()
  // Same-route query navigation must not bypass protection either.
  await page.getByRole("textbox", { name: "Search students" }).fill("Student")
  await expect(page).toHaveURL(/search=Student/)
  await page
    .getByRole("button", { name: "Create student", exact: true })
    .click()
  await editor.getByLabel("First name", { exact: false }).fill("Query draft")
  await page.evaluate(() => history.back())
  await prompt.getByRole("button", { name: "Keep editing" }).click()
  await expect(editor.getByLabel("First name", { exact: false })).toHaveValue(
    "Query draft"
  )
  page.once("dialog", (dialog) => dialog.accept())
  await editor.getByRole("button", { name: "Cancel" }).click()
})

test("pending saves block history navigation and failed saves retain the draft", async ({
  page,
}) => {
  await login(page, "admin")
  await page.getByRole("link", { name: "Programs", exact: true }).click()
  await page
    .getByRole("button", { name: "Create program", exact: true })
    .click()
  const editor = page.getByRole("dialog", {
    name: "Create program",
    exact: true,
  })
  await editor.getByLabel(/code/i).fill("PENDING_TEST")
  await editor.getByLabel(/name/i).fill("Pending draft")
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`${API_BASE_URL}/programs`, async (route) => {
    if (route.request().method() !== "POST") return route.continue()
    await gate
    return route.fulfill({
      status: 503,
      json: { success: false, message: "Please retry this save." },
    })
  })
  await editor
    .getByRole("button", { name: "Create program", exact: true })
    .click()
  await expect(editor.getByRole("button", { name: /Saving/ })).toBeDisabled()
  await page.evaluate(() => history.back())
  await expect(page).toHaveURL(/\/programs$/)
  await expect(editor).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Discard and leave" })
  ).toHaveCount(0)
  release()
  await expect(editor.getByText("Please retry this save.")).toBeVisible()
  await expect(editor.getByLabel(/name/i)).toHaveValue("Pending draft")
  page.once("dialog", (dialog) => dialog.accept())
  await editor.getByRole("button", { name: "Cancel" }).click()
})

test("named light and dark default-state text pairs have readable contrast", async ({
  page,
}, testInfo) => {
  await login(page, "admin")
  const measurements: Array<{
    theme: string
    sample: string
    ratio: number
    foreground: number[]
    background: number[]
  }> = []
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      localStorage.setItem("theme", theme)
    }, theme)
    await page.reload()
    await expect(page.locator("html")).toHaveClass(new RegExp(theme))
    for (const [sample, locator] of [
      [
        "active navigation",
        page.locator('aside a[aria-current="page"]').first(),
      ],
      [
        "muted description",
        page.locator("main .text-muted-foreground").first(),
      ],
      [
        "primary task button",
        page.locator('main [data-variant="default"]').first(),
      ],
      ["role badge", page.locator("header span.rounded-full").first()],
    ] as const) {
      await expect(locator).toBeVisible()
      measurements.push({ theme, sample, ...(await textContrast(locator)) })
    }
    await page.getByRole("link", { name: "Students", exact: true }).click()
    const search = page.getByRole("textbox", { name: "Search students" })
    measurements.push({
      theme,
      sample: "search placeholder",
      ...(await textContrast(search, true)),
    })
    const danger = page
      .locator('main button[data-variant="destructive"]')
      .first()
    await expect(danger).toBeVisible()
    measurements.push({
      theme,
      sample: "delete action",
      ...(await textContrast(danger)),
    })
    const status = page.locator("main tbody span.rounded-full").first()
    measurements.push({
      theme,
      sample: "active status badge",
      ...(await textContrast(status)),
    })
    await page
      .getByRole("button", { name: "Create student", exact: true })
      .click()
    const editor = page.getByRole("dialog", {
      name: "Create student",
      exact: true,
    })
    measurements.push({
      theme,
      sample: "dialog description",
      ...(await textContrast(
        editor.locator('[id][class*="text-muted-foreground"]').first()
      )),
    })
    measurements.push({
      theme,
      sample: "required field marker",
      ...(await textContrast(
        editor.locator("label .text-destructive").first()
      )),
    })
    await editor.getByRole("button", { name: "Cancel" }).click()
    await page
      .getByRole("link", { name: "Academic Record", exact: true })
      .click()
    await page
      .getByRole("combobox", { name: "Student", exact: true })
      .selectOption("1")
    const year = page
      .locator("main span.bg-muted.text-muted-foreground")
      .first()
    await expect(year).toBeVisible()
    measurements.push({
      theme,
      sample: "muted year badge",
      ...(await textContrast(year)),
    })
    await page.getByRole("link", { name: "Dashboard", exact: true }).click()
  }
  await testInfo.attach("rendered-text-contrast", {
    body: JSON.stringify(measurements, null, 2),
    contentType: "application/json",
  })
  expect(measurements.filter((sample) => sample.ratio < 4.5)).toEqual([])
})

test("Chrome accessibility tree exposes form labels, required state and associated errors", async ({
  page,
}) => {
  await login(page, "admin")
  await page.getByRole("link", { name: "Programs", exact: true }).click()
  await page
    .getByRole("button", { name: "Create program", exact: true })
    .click()
  const editor = page.getByRole("dialog", {
    name: "Create program",
    exact: true,
  })
  await editor.getByLabel(/code/i).fill("AX_TEST")
  await editor.getByLabel(/name/i).fill("AX draft")
  await page.route(`${API_BASE_URL}/programs`, async (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 422,
          json: {
            success: false,
            message: "Validation failed.",
            errors: { code: ["Choose a different code."] },
          },
        })
      : route.continue()
  )
  await editor
    .getByRole("button", { name: "Create program", exact: true })
    .click()
  await expect(editor.getByLabel(/code/i)).toHaveAccessibleDescription(
    "Choose a different code."
  )
  const cdp = await page.context().newCDPSession(page)
  const tree = await cdp.send("Accessibility.getFullAXTree")
  const input = tree.nodes.find(
    (node) =>
      node.role?.value === "textbox" &&
      String(node.name?.value).startsWith("Program code")
  )
  expect(input?.description?.value).toBe("Choose a different code.")
  expect(
    input?.properties?.some(
      (property) =>
        property.name === "required" && property.value.value === true
    )
  ).toBe(true)
  expect(
    input?.properties?.some(
      (property) =>
        property.name === "invalid" && property.value.value === "true"
    )
  ).toBe(true)
  expect(
    tree.nodes.some(
      (node) =>
        node.role?.value === "dialog" && node.name?.value === "Create program"
    )
  ).toBe(true)
  await cdp.detach()
  page.once("dialog", (dialog) => dialog.accept())
  await editor.getByRole("button", { name: "Cancel" }).click()
})
