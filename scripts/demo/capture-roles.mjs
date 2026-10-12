// Records three isolated role clips (Admin, Student, Instructor) against the real app.
import { chromium } from "@playwright/test"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { openRecordedSession, signIn } from "./lib.mjs"

const base = process.env.DEMO_FRONTEND_URL
const rawDir = process.env.DEMO_RAW_DIR
const accounts = {
  admin: { email: process.env.DEMO_ADMIN_EMAIL ?? "admin@example.com", password: process.env.DEMO_ADMIN_PASSWORD },
  student: { email: process.env.DEMO_STUDENT_EMAIL ?? "student@example.com", password: process.env.DEMO_STUDENT_PASSWORD },
  instructor: { email: process.env.DEMO_INSTRUCTOR_EMAIL ?? "instructor@example.com", password: process.env.DEMO_INSTRUCTOR_PASSWORD },
}
if (!base || !rawDir || Object.values(accounts).some((a) => !a.password)) {
  throw new Error("DEMO_FRONTEND_URL, DEMO_RAW_DIR and the three DEMO_*_PASSWORD variables are required.")
}

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--force-device-scale-factor=1", "--hide-scrollbars"] })
const clips = []

async function openLogin(session) {
  await session.page.goto(base + "/login")
  await session.page.getByRole("heading", { name: "Welcome back" }).waitFor()
  await session.page.mouse.move(960, 540)
}
const nav = (session) => session.page.getByRole("navigation", { name: "Primary navigation" })

// ---- Admin: 10 s (login and dashboard are part of the clip) ----
{
  const s = await openRecordedSession(browser, path.join(rawDir, "admin"))
  await openLogin(s)
  const offset = s.start()
  await s.slot("login+dashboard", 6.5, async () => {
    await signIn(s, accounts.admin.email, accounts.admin.password)
    await s.moveTo(1200, 520, 500)
  })
  await s.slot("students", 10, async () => {
    await s.click(nav(s).getByRole("link", { name: "Students" }), 600)
    await s.page.getByRole("row").nth(1).waitFor()
    await s.page.waitForLoadState("networkidle")
  })
  clips.push({ role: "admin", duration: 10, offset, ...(await s.finish("admin.webm")) })
}

// ---- Student: 7 s (sign-in happens before the timed part and is trimmed) ----
{
  const s = await openRecordedSession(browser, path.join(rawDir, "student"))
  await openLogin(s)
  await signIn(s, accounts.student.email, accounts.student.password)
  await s.moveTo(1100, 560, 300)
  const offset = s.start()
  await s.slot("academic-record", 4.5, async () => {
    await s.click(nav(s).getByRole("link", { name: "Academic Record" }), 900)
    await s.page.getByRole("heading", { name: "Academic Record" }).waitFor()
    await s.page.getByText("IT101", { exact: false }).first().waitFor()
    await s.page.waitForLoadState("networkidle")
  })
  await s.slot("hold", 7, async () => {})
  clips.push({ role: "student", duration: 7, offset, ...(await s.finish("student.webm")) })
}

// ---- Instructor: 8 s ----
{
  const s = await openRecordedSession(browser, path.join(rawDir, "instructor"))
  await openLogin(s)
  await signIn(s, accounts.instructor.email, accounts.instructor.password)
  await s.moveTo(1100, 560, 300)
  const offset = s.start()
  await s.slot("class-roster", 5, async () => {
    await s.click(nav(s).getByRole("link", { name: "My Classes" }), 800)
    const row = s.page.getByRole("row").filter({ hasText: "IT101" }).first()
    await row.waitFor()
    await s.click(row.getByRole("button", { name: /^View/ }), 700)
    await s.click(s.page.getByRole("link", { name: "Open class roster" }), 600)
    await s.page.getByRole("heading", { name: "Class roster" }).waitFor()
    await s.page.getByText("2026-00001").first().waitFor()
    await s.page.waitForLoadState("networkidle")
  })
  await s.slot("hold", 8, async () => {})
  clips.push({ role: "instructor", duration: 8, offset, ...(await s.finish("instructor.webm")) })
}

await browser.close()
writeFileSync(path.join(rawDir, "capture.json"), JSON.stringify({ clips }, null, 2))
console.log("Captured clips: " + clips.map((c) => `${c.role}(offset ${c.offset.toFixed(2)}s)`).join(", "))
