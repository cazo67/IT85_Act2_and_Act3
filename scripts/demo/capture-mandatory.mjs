// Records every mandatory-demo chapter sequentially in ONE invocation against the real app.
// Usage: node capture-mandatory.mjs --run <runDir> [--only 02,03] [--from 05]
import { chromium } from "@playwright/test"
import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Desk, Person, Recorder, Terminal, makeRng, primaryDisplay, sleep } from "./lib-desktop.mjs"
import { Services, API, WEB } from "./services-mandatory.mjs"
import { renderCards, cardPath } from "./cards.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const argv = process.argv.slice(2)
const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null }
const runDir = arg("run")
if (!runDir) throw new Error("--run <runDir> is required")
const scenario = JSON.parse(readFileSync(path.join(here, "scenario.json"), "utf8"))
const S = scenario
const rawDir = path.join(runDir, "raw")
const logDir = path.join(runDir, "logs")
const cardDir = path.join(runDir, "cards")
for (const d of [rawDir, logDir, cardDir]) mkdirSync(d, { recursive: true })
const stateFile = path.join(runDir, "run-state.json")
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : { chapters: {} }
const saveState = () => writeFileSync(stateFile, JSON.stringify(state, null, 2))
const log = (m) => { const line = `${new Date().toISOString()} ${m}`; console.log(line); appendFileSync(path.join(logDir, "capture.log"), line + "\n") }

const allIds = S.chapters.map((c) => c.id)
const only = arg("only")?.split(/[ ,]+/).map((x) => x.padStart(2, "0"))
const from = arg("from")?.padStart(2, "0")
const selected = only ?? (from ? allIds.filter((id) => id >= from) : allIds)

const svc = new Services({ root, runDir })
const fresh = svc.loadOrCreateSecrets()
const requestsLog = path.join(svc.work, "requests.log")
let desk, rec, person, term, browser, context, backdrop
const pages = {}
const TITLES = { admin: "SIMS Demo - Admin", student: "SIMS Demo - Student", instructor: "SIMS Demo - Instructor" }

// ------------------------------------------------------------------ helpers
function expect(cond, message) { if (!cond) throw new Error("Assertion failed: " + message) }
function readRequests() { return existsSync(requestsLog) ? readFileSync(requestsLog, "utf8") : "" }

function attachNetworkLog(page, role) {
  page.on("response", async (response) => {
    const url = response.url()
    if (!url.startsWith(API)) return
    const p = url.slice(API.length)
    const req = response.request()
    let extra = ""
    try {
      if (req.method() === "GET" && response.ok() && /^\/(students|enrollments|grades|course-offerings)(\?|\/\d+\/academic-record|$)|academic-record/.test(p)) {
        const body = await response.json()
        const m = body.meta
        if (m) extra = `  total=${m.total} page=${m.page}/${m.last_page} per_page=${m.per_page}`
        else if (body.data?.terms) extra = `  terms=${body.data.terms.length} (aggregate record)`
      }
    } catch {}
    appendFileSync(requestsLog, `[${role}] ${req.method()} ${p} -> ${response.status()}${extra}\n`)
  })
}

async function launch() {
  browser = await chromium.launch({
    channel: "chrome", headless: false,
    args: ["--window-position=0,0", "--window-size=1920,1080", "--force-device-scale-factor=1", "--disable-infobars", "--no-first-run", "--force-renderer-accessibility", "--disable-features=Translate,PasswordLeakDetection,PasswordManagerOnboarding", "--disable-save-password-bubble"],
  })
  context = await browser.newContext({ viewport: null, colorScheme: "light" })
  await context.addInitScript(() => {
    try { localStorage.setItem("theme", "light") } catch {}
    window.__mouse = { x: -1, y: -1 }
    addEventListener("mousemove", (e) => { window.__mouse = { x: e.clientX, y: e.clientY } }, true)
    const ripple = () => {
      const s = document.createElement("style")
      s.textContent = ".demo-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid rgba(37,99,235,.85);background:rgba(37,99,235,.2);animation:demo-ripple .5s ease-out forwards}@keyframes demo-ripple{to{transform:scale(3.2);opacity:0}}"
      document.head.appendChild(s)
      addEventListener("mousedown", (e) => {
        const r = document.createElement("div"); r.className = "demo-ripple"
        r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"
        document.body.appendChild(r); setTimeout(() => r.remove(), 650)
      }, true)
    }
    if (document.body) ripple(); else addEventListener("DOMContentLoaded", ripple)
  })
}

async function newTab(title) {
  const page = await context.newPage()
  await page.addInitScript((t) => { addEventListener("DOMContentLoaded", () => { setInterval(() => { if (document.title !== t) document.title = t }, 100) }) }, title)
  return page
}

async function uiLogin(page, email, password) {
  await page.goto(WEB + "/login", { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.getByRole("heading", { name: /^Welcome,/ }).waitFor()
  await page.waitForLoadState("networkidle")
}

const token = (page) => page.evaluate(() => sessionStorage.getItem("sims.access-token"))

async function setupSessions(adminSignedIn) {
  for (const role of ["admin", "student", "instructor"]) { pages[role] = await newTab(TITLES[role]); attachNetworkLog(pages[role], role) }
  for (const p of context.pages()) if (!Object.values(pages).includes(p)) await p.close()
  if (adminSignedIn) await uiLogin(pages.admin, "admin@example.com", svc.secrets.admin)
  else await pages.admin.goto(WEB + "/login")
  await uiLogin(pages.student, "student@example.com", svc.secrets.student)
  await uiLogin(pages.instructor, "instructor@example.com", svc.secrets.instructor)
  // Verify identity and session isolation explicitly (never assume sessionStorage is separate).
  const identities = { student: ["Maya Reyes", "Student"], instructor: ["Daniel Ramos", "Instructor"], ...(adminSignedIn ? { admin: ["Elena Marquez", "Administrator"] } : {}) }
  const tokens = {}
  for (const [role, [name, badge]] of Object.entries(identities)) {
    const page = pages[role]
    await page.goto(WEB + "/dashboard")
    await page.getByRole("heading", { name: `Welcome, ${name}` }).waitFor()
    expect(await page.getByText(badge, { exact: true }).first().isVisible(), `${role} badge ${badge}`)
    tokens[role] = await token(page)
    expect(tokens[role], `${role} has its own token`)
  }
  const values = Object.values(tokens)
  expect(new Set(values).size === values.length, "each role tab holds a different session token")
  if (!adminSignedIn) expect((await token(pages.admin)) === null, "Admin tab starts signed out")
  log(`sessions verified: ${Object.keys(tokens).join(", ")} are distinct${adminSignedIn ? "" : "; admin signed out for chapter 03"}`)
}

async function frontRole(role, urlPath) {
  const page = pages[role]
  if (urlPath) { await page.goto(WEB + urlPath); await page.waitForLoadState("networkidle") }
  await page.bringToFront()
  await desk.cmd("front SIMS Demo")
  await sleep(500)
  person.use(page)
}

async function windowToDesktop() {
  const r = await desk.place("SIMS Demo", 0, 0, 1920, 1080)
  expect(r.x === 0 && r.y === 0 && r.w === 1920 && r.h === 1080, `Chrome visible area is 1920x1080 at 0,0 (got ${JSON.stringify(r)})`)
  return r
}

async function switchTab(role) {
  const rect = (await desk.cmd(`tab SIMS Demo|${TITLES[role]}`)).trim().split(/\s+/).map(Number)
  if (rect.length === 4 && rect.every(Number.isFinite)) {
    const x = rect[0] + rect[2] * person.r(0.3, 0.55), y = rect[1] + rect[3] * person.r(0.4, 0.6)
    await desk.cmd(`glide ${Math.round(x)} ${Math.round(y)}`)
    await sleep(person.r(180, 420))
    await desk.cmd("down"); await sleep(person.r(55, 95)); await desk.cmd("up")
    await sleep(500)
  } else log(`UIA tab lookup failed for ${role}; falling back to bringToFront`)
  if (!(await pages[role].evaluate(() => document.visibilityState === "visible"))) { log(`tab click missed for ${role}; bringToFront`); await pages[role].bringToFront() }
  person.use(pages[role])
  await sleep(500)
}

const nav = (page, name) => page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name, exact: true })
const toast = (page) => page.locator("[data-sonner-toast]").first()
const dialog = (page) => page.getByRole("dialog")
const rowWith = (page, text) => page.getByRole("row").filter({ hasText: text }).first()
const field = (scope, name) => scope.locator(`input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`).first()

async function chooseRef(dlg, name, searchLabel, searchText) {
  await person.typeInto(dlg.getByLabel(`Search ${searchLabel} options`, { exact: true }), searchText)
  const select = dlg.locator(`select[name="${name}"]`)
  await person.click(select)
  await sleep(person.r(350, 600))
  await desk.cmd("keys {DOWN}"); await sleep(person.r(250, 420)); await desk.cmd("keys {ENTER}"); await sleep(person.r(300, 450))
  if (!(await select.inputValue())) { log(`chooseRef fallback for ${name}`); await select.selectOption({ index: 1 }) }
  expect(await select.inputValue(), `${name} has a selection`)
}

async function waitToast(page, pattern) {
  await toast(page).waitFor({ timeout: 15000 })
  const text = await toast(page).innerText()
  if (pattern) expect(pattern.test(text), `toast matches ${pattern} (was "${text}")`)
  return text
}

// ------------------------------------------------------------------ chapter machinery
function makeChapterContext(chapter) {
  const rec_ = state.chapters[chapter.id]
  const c = {
    chapter, evidence: [], segments: [],
    note(task, text) { const e = { task, text, at: new Date().toISOString() }; this.evidence.push(e); log(`[${chapter.id}] evidence${task ? ` (task ${task})` : ""}: ${text}`) },
    async card(card, heading) {
      const n = this.segments.filter((s) => s.type === "card").length + 1
      const file = cardPath(cardDir, chapter.id, n)
      await renderCards([{ card, heading, file }])
      this.segments.push({ type: "card", file, seconds: card.seconds })
    },
    async footage(label, fn) {
      const n = this.segments.filter((s) => s.type === "footage").length + 1
      const file = path.join(rawDir, `${chapter.id}_${String(n).padStart(2, "0")}_${label}.mkv`)
      await rec.start(file)
      let failure = null
      try { await fn() } catch (error) { failure = error }
      await sleep(500)
      const seconds = await rec.stop()
      if (failure) throw failure
      this.segments.push({ type: "footage", file, start: 0.8, end: Math.max(1, seconds - 0.2), recorded: +seconds.toFixed(2) })
      log(`[${chapter.id}] footage "${label}" ${seconds.toFixed(1)}s`)
    },
  }
  return c
}

async function prepare(id) {
  const adminLoggedIn = id !== "02" && id !== "03"
  const map = {
    "01": () => frontRole("admin", "/login"),
    "02": () => frontRole("admin", "/login"),
    "03": () => frontRole("admin", "/login"),
    "04": () => frontRole("admin", "/students"),
    "05": () => frontRole("admin", "/students"),
    "06": () => frontRole("admin", "/students"),
    "07": () => frontRole("admin", "/students"),
    "08": () => frontRole("admin", "/students"),
    "09": () => frontRole("instructor", "/course-offerings"),
    "10": () => frontRole("student", "/academic-record"),
    "11": async () => { await pages.admin.goto(WEB + "/students"); await frontRole("student", "/academic-record") },
    "12": () => frontRole("admin", "/students"),
    "13": () => frontRole("admin", "/dashboard"),
    "14": () => frontRole("admin", "/dashboard"),
    "15": async () => { await pages.student.goto(WEB + "/academic-record"); await frontRole("admin", "/dashboard") },
  }
  void adminLoggedIn
  if (map[id]) await map[id]()
  await windowToDesktop()
  await person.calibrate()
}

const chapters = {}

// 01 ---------------------------------------------------------------- introduction (cards only)
chapters["01"] = async (c) => {
  for (const card of c.chapter.cards) await c.card(card)
}

// 02 ---------------------------------------------------------------- connection
chapters["02"] = async (c) => {
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await term.show()
  await term.clear()
  await c.footage("terminal", async () => {
    await term.run("curl.exe -sS $API/health", 2000)
    await term.run("gc $R\\.env.demo", 2000)
    await term.run("gc frontend.log -Tail 7", 2600)
  })
  const health = await (await fetch("http://127.0.0.1:8200/health")).json()
  c.note(1, `backend health success=${health.success}`)
  c.note(2, "frontend API base URL printed from .env.demo; Vite output shown from frontend.log")
  const docsPage = await newTab("SIMS Demo - API Docs")
  await docsPage.goto("http://127.0.0.1:8200/api/docs")
  await docsPage.waitForLoadState("networkidle")
  await docsPage.getByText("Student", { exact: false }).first().waitFor({ timeout: 20000 })
  await desk.cmd("front SIMS Demo")
  await windowToDesktop()
  await c.footage("swagger-and-app", async () => {
    await sleep(2400)
    c.note(1, "Swagger API documentation visible")
    await switchTab("admin")
    await pages.admin.getByRole("heading", { name: "Welcome back" }).waitFor()
    await person.read(1800)
    c.note(2, "frontend served on :3200 shows the login screen (separate app from the API on :8200)")
  })
  await docsPage.close()
}

// 03 ---------------------------------------------------------------- authentication
chapters["03"] = async (c) => {
  const page = pages.admin
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await c.footage("login", async () => {
    await person.typeInto(page.getByLabel("Email"), "admin@example.com")
    await person.typeInto(page.getByLabel("Password"), "Wrong-pass-1")
    await person.click(page.getByRole("button", { name: "Sign in" }))
    await page.getByText("Invalid email or password").waitFor()
    c.note(3, "invalid login rejected: 'Invalid email or password'")
    await person.read(1800)
    await person.typeInto(page.getByLabel("Password"), svc.secrets.admin, { clear: true })
    await person.click(page.getByRole("button", { name: "Sign in" }))
    await page.getByRole("heading", { name: "Welcome, Elena Marquez" }).waitFor()
    expect(await page.getByText("Administrator", { exact: true }).first().isVisible(), "Administrator badge")
    c.note(4, "signed in as Elena Marquez, Administrator")
    await person.read(1600)
    await person.click(nav(page, "Students"))
    await page.getByRole("row").nth(1).waitFor()
    await page.waitForLoadState("networkidle")
    c.note(5, "protected route /students loaded after sign-in")
    await person.read(1300)
    const guest = await newTab("SIMS Demo - Guest")
    await guest.goto(WEB + "/students")
    await guest.getByRole("heading", { name: "Welcome back" }).waitFor()
    expect(guest.url().includes("/login"), "signed-out tab redirected to /login")
    c.note(5, "separate signed-out tab redirected from /students to /login")
    await person.read(1800)
    await switchTab("admin")
    await guest.close()
    await sleep(400)
  })
}

// 04 ---------------------------------------------------------------- search, filters, pagination
chapters["04"] = async (c) => {
  const page = pages.admin
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await c.footage("students", async () => {
    await page.getByRole("row").nth(1).waitFor()
    c.note(6, "Students list loaded from the backend")
    await person.read(1000)
    await person.typeInto(page.getByLabel("Search students"), "Santos")
    await page.waitForURL(/search=Santos/)
    await page.waitForLoadState("networkidle")
    c.note(7, "search=Santos sent to the API")
    await person.read(1500)
    await person.typeInto(page.getByLabel("Search students"), "", { clear: true })
    await page.waitForLoadState("networkidle")
    await person.pick(page.getByLabel("Program filter"), "BSIT")
    await page.waitForURL(/program_id=/)
    await person.pick(page.getByLabel("Year filter"), "Year 2")
    await page.waitForURL(/year_level=2/)
    await page.waitForLoadState("networkidle")
    c.note(8, "two filters (program, year level) sent to the API")
    await person.read(1700)
    await person.pick(page.getByLabel("Program filter"), "All programs")
    await person.pick(page.getByLabel("Year filter"), "All years")
    await page.waitForLoadState("networkidle")
    await person.pick(page.getByLabel("Rows per page"), "10")
    await page.waitForURL(/per_page=10/)
    await page.waitForLoadState("networkidle")
    await person.click(page.getByRole("button", { name: "Next" }))
    await page.waitForURL(/page=2/)
    await page.waitForLoadState("networkidle")
    c.note(8, "pagination: page 2 of the 10-per-page list")
    await person.read(1700)
    c.note(8, "program and year filters cleared before pagination")
  })
  const reqs = readRequests()
  expect(/\[admin\] GET \/students\?[^\n]*search=Santos/.test(reqs), "request log has the search query")
  expect(/\[admin\] GET \/students\?[^\n]*program_id=\d+[^\n]*year_level=2|\[admin\] GET \/students\?[^\n]*year_level=2[^\n]*program_id=\d+/.test(reqs), "request log has both filters")
  expect(/\[admin\] GET \/students\?[^\n]*page=2[^\n]*total=\d+/.test(reqs), "request log has page 2 with response metadata")
  await term.show()
  await term.clear()
  await c.footage("evidence", async () => {
    await term.run('sls "GET /students\\?" requests.log | select -Last 7', 4800)
  })
  await desk.cmd("front SIMS Demo")
}

// 05 ---------------------------------------------------------------- create / validate / edit
chapters["05"] = async (c) => {
  const page = pages.admin
  const ms = S.mainStudent
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await c.footage("create-validate", async () => {
    await person.click(page.getByRole("button", { name: "Create student" }))
    const dlg = dialog(page)
    await dlg.getByRole("heading", { name: "Create student" }).waitFor()
    await person.typeInto(field(dlg, "student_number"), ms.student_number)
    await person.typeInto(field(dlg, "first_name"), ms.first_name)
    await person.typeInto(field(dlg, "last_name"), ms.last_name)
    await person.typeInto(field(dlg, "email"), S.invalidEmail)
    await chooseRef(dlg, "program_id", "program", ms.program)
    await person.pick(field(dlg, "year_level"), ms.year_level)
    await chooseRef(dlg, "user_id", "linked student account", "Maya")
    await person.read(500)
    await person.click(dlg.getByRole("button", { name: "Create student" }))
    await expect_(async () => (await field(dlg, "email").getAttribute("aria-invalid")) === "true", "backend validation marks Email invalid")
    c.note(10, `backend 422 for email "${S.invalidEmail}" displayed on the Email field`)
    await person.read(2400)
    await person.click(field(dlg, "email"))
    await page.keyboard.press("End")
    for (const ch of ".ph") { await page.keyboard.type(ch); await sleep(person.r(80, 120)) }
    await sleep(250)
    await person.click(dlg.getByRole("button", { name: "Create student" }))
    await waitToast(page, /creat/i)
    await dlg.waitFor({ state: "hidden" })
    c.note(9, "student 2026-00150 created through the frontend (toast confirmed)")
    await person.read(700)
    await person.typeInto(page.getByLabel("Search students"), ms.student_number)
    await page.waitForURL(/search=2026-00150/)
    await rowWith(page, ms.student_number).waitFor()
    await person.click(page.getByRole("button", { name: new RegExp(`^View student ${ms.student_number}`) }))
    const view = dialog(page)
    await view.getByText("Maya Reyes").first().waitFor()
    c.note(9, "fresh read in the details dialog shows the new record with linked account Maya Reyes")
    await person.read(2200)
    await person.click(view.getByRole("button", { name: "Close" }).first())
    await person.click(page.getByRole("button", { name: new RegExp(`^Edit student ${ms.student_number}`) }))
    const edit = dialog(page)
    await edit.getByRole("heading", { name: "Edit student" }).waitFor()
    await field(edit, "contact_number").waitFor()
    await person.typeInto(field(edit, "contact_number"), "09171234567", { clear: true })
    await person.click(edit.getByRole("button", { name: "Save changes" }))
    await waitToast(page, /updat|sav/i)
    await edit.waitFor({ state: "hidden" })
    await person.click(page.getByRole("button", { name: new RegExp(`^View student ${ms.student_number}`) }))
    const view2 = dialog(page)
    await view2.getByText("09171234567").waitFor()
    c.note(11, "edited contact number persisted (fresh read shows 09171234567)")
    await person.read(1800)
    await person.click(view2.getByRole("button", { name: "Close" }).first())
  })
  const r = await svc.api("admin", "GET", "/students?search=2026-00150")
  expect(r.body?.data?.[0]?.user_id, "API confirms the student is linked to an account")
  c.note(9, "API confirmation: student exists and user_id is set")
}

async function expect_(fn, message, timeout = 10000) {
  const end = Date.now() + timeout
  while (Date.now() < end) { if (await fn()) return; await sleep(150) }
  throw new Error("Assertion failed: " + message)
}

// 06 ---------------------------------------------------------------- course, term, offering
chapters["06"] = async (c) => {
  const page = pages.admin
  const nc = S.newCourse, nt = S.newTerm, no = S.newOffering
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await c.footage("setup", async () => {
    await person.click(nav(page, "Programs")); await page.getByRole("row").nth(1).waitFor(); await person.read(900)
    await person.click(nav(page, "Courses")); await page.getByRole("row").nth(1).waitFor(); await person.read(800)
    await person.click(page.getByRole("button", { name: "Create course" }))
    let dlg = dialog(page)
    await person.typeInto(field(dlg, "course_code"), nc.course_code)
    await person.typeInto(field(dlg, "course_title"), nc.course_title)
    await person.typeInto(field(dlg, "units"), nc.units, { clear: true })
    await person.click(dlg.getByRole("button", { name: "Create course" }))
    await waitToast(page); await dlg.waitFor({ state: "hidden" })
    await rowWith(page, nc.course_code).waitFor()
    c.note(13, "course IT210 created and visible in the Courses list")
    await person.read(1000)
    await person.click(nav(page, "Academic Terms")); await page.getByRole("row").nth(1).waitFor()
    await person.click(page.getByRole("button", { name: "Create academic term" }))
    dlg = dialog(page)
    await person.typeInto(field(dlg, "academic_year"), nt.academic_year)
    await person.typeInto(field(dlg, "semester"), nt.semester)
    await field(dlg, "start_date").fill(nt.start_date)
    await field(dlg, "end_date").fill(nt.end_date)
    await person.read(500)
    await person.click(dlg.getByRole("button", { name: "Create academic term" }))
    await waitToast(page); await dlg.waitFor({ state: "hidden" })
    await rowWith(page, nt.semester).waitFor()
    c.note(14, "academic term 2026-2027 Second Semester created")
    await person.read(900)
    await person.click(nav(page, "Course Offerings")); await page.getByRole("row").nth(1).waitFor()
    await person.click(page.getByRole("button", { name: "Create course offering" }))
    dlg = dialog(page)
    await chooseRef(dlg, "course_id", "course", nc.course_code)
    await chooseRef(dlg, "academic_term_id", "academic term", "Second")
    await chooseRef(dlg, "instructor_id", "instructor", "Daniel")
    await person.typeInto(field(dlg, "section"), no.section)
    await person.typeInto(field(dlg, "schedule"), no.schedule)
    await person.typeInto(field(dlg, "room"), no.room)
    await person.typeInto(field(dlg, "capacity"), no.capacity, { clear: true })
    await person.click(dlg.getByRole("button", { name: "Create course offering" }))
    await waitToast(page); await dlg.waitFor({ state: "hidden" })
    const row = rowWith(page, no.section)
    await row.waitFor()
    expect((await row.innerText()).includes(no.schedule) && (await row.innerText()).includes(no.capacity), "offering row shows schedule and capacity")
    c.note(14, "offering WD-A saved with schedule, room and capacity visible in the table")
    await person.read(2500)
  })
  const off = await svc.api("admin", "GET", "/course-offerings?per_page=100")
  const mine = off.body.data.find((o) => o.section === no.section)
  expect(mine && mine.room === no.room && mine.capacity === 35, "API confirms offering WD-A details")
}

// 07 ---------------------------------------------------------------- enrollment
chapters["07"] = async (c) => {
  const page = pages.admin
  const ms = S.mainStudent
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await c.footage("enroll", async () => {
    await person.typeInto(page.getByLabel("Search students"), ms.student_number)
    await page.waitForURL(/search=2026-00150/)
    await rowWith(page, ms.student_number).waitFor()
    await person.click(page.getByRole("button", { name: new RegExp(`^View student ${ms.student_number}`) }))
    await person.click(dialog(page).getByRole("link", { name: "Open student workspace" }))
    await page.getByRole("heading", { name: "Student workspace" }).waitFor()
    await person.read(800)
    await person.click(page.getByRole("link", { name: "Enroll in a class" }))
    const dlg = dialog(page)
    await dlg.getByRole("heading", { name: "Create enrollment" }).waitFor()
    await chooseRef(dlg, "course_offering_id", "course offering", S.newOffering.section)
    await person.read(700)
    await person.click(dlg.getByRole("button", { name: "Create enrollment" }))
    await waitToast(page, /enroll|creat/i)
    await dlg.waitFor({ state: "hidden" })
    c.note(15, "enrollment created through the frontend (toast confirmed)")
    await person.read(500)
    await person.click(nav(page, "Students"))
    await person.typeInto(page.getByLabel("Search students"), ms.student_number, { clear: true })
    await rowWith(page, ms.student_number).waitFor()
    await person.click(page.getByRole("button", { name: new RegExp(`^View student ${ms.student_number}`) }))
    await person.click(dialog(page).getByRole("link", { name: "Open student workspace" }))
    const wsRow = page.getByRole("row").filter({ hasText: "IT210" }).first()
    await wsRow.waitFor()
    const text = await wsRow.innerText()
    expect(/WD-A/.test(text) && /ACTIVE/.test(text) && /Not graded/.test(text), `workspace row shows WD-A, ACTIVE, Not graded (was "${text}")`)
    c.note(15, "fresh read: IT210 / WD-A, ACTIVE, Not graded")
    await person.read(2600)
  })
}

// 08 ---------------------------------------------------------------- instructor grading
chapters["08"] = async (c) => {
  const ms = S.mainStudent, g = S.grade
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await c.footage("grade", async () => {
    await switchTab("instructor")
    const page = pages.instructor
    await page.getByRole("heading", { name: "Welcome, Daniel Ramos" }).waitFor()
    c.note(16, "Instructor tab: Daniel Ramos, Instructor badge")
    await person.read(1300)
    await person.click(nav(page, "My Classes"))
    const classRow = rowWith(page, "WD-A")
    await classRow.waitFor()
    await person.read(1200)
    await person.click(page.getByRole("button", { name: /^View course offering WD-A/ }))
    await person.click(dialog(page).getByRole("link", { name: "Open class roster" }))
    await page.getByRole("heading", { name: "Class roster" }).waitFor()
    const row = rowWith(page, ms.student_number)
    await row.waitFor()
    await person.read(1000)
    await person.click(page.getByRole("button", { name: new RegExp(`^Create grade for ${ms.student_number}`) }))
    const dlg = dialog(page)
    await person.typeInto(dlg.getByLabel("Midterm grade"), g.midterm, { clear: true })
    await person.typeInto(dlg.getByLabel("Final grade"), g.final, { clear: true })
    await person.typeInto(dlg.getByLabel("Remarks"), g.remarks)
    await person.click(dlg.getByRole("button", { name: "Create grade" }))
    await waitToast(page)
    await dlg.waitFor({ state: "hidden" })
    await expect_(async () => /85\.5/.test(await row.innerText()) && /90\.25/.test(await row.innerText()), "roster shows 85.5 / 90.25")
    c.note(16, "grade created: midterm 85.5, final 90.25")
    await person.read(1300)
    await person.click(page.getByRole("button", { name: new RegExp(`^Edit grade for ${ms.student_number}`) }))
    await person.typeInto(dlg.getByLabel("Final grade"), g.correctedFinal, { clear: true })
    await person.click(dlg.getByRole("button", { name: "Save changes" }))
    await waitToast(page)
    await dlg.waitFor({ state: "hidden" })
    await expect_(async () => /93\.75/.test(await row.innerText()), "roster shows corrected final 93.75")
    c.note(16, "final mark corrected to 93.75")
    await person.read(1000)
    await desk.cmd("keys {F5}")
    await page.getByRole("heading", { name: "Class roster" }).waitFor()
    const row2 = rowWith(page, ms.student_number)
    await expect_(async () => /93\.75/.test(await row2.innerText().catch(() => "")), "after reload the corrected 93.75 persists")
    c.note(16, "after reload the corrected final 93.75 persists")
    await person.read(2400)
  })
}

// 09 ---------------------------------------------------------------- student result
chapters["09"] = async (c) => {
  const ms = S.mainStudent
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await c.footage("student-views", async () => {
    await switchTab("student")
    const page = pages.student
    await page.getByRole("heading", { name: "Welcome, Maya Reyes" }).waitFor()
    c.note(17, "Student tab: Maya Reyes, Student badge")
    await person.read(1200)
    await person.click(nav(page, "My Enrollments"))
    await rowWith(page, "IT210").waitFor()
    await person.read(1500)
    await person.click(nav(page, "My Grades"))
    const gradeRow = page.getByRole("row").filter({ hasText: "93.75" }).first()
    await gradeRow.waitFor()
    expect(/85\.5/.test(await gradeRow.innerText()), "My Grades row shows 85.5 and 93.75")
    expect((await page.getByRole("button", { name: /^(Create|Edit) grade/ }).count()) === 0, "no grade create/edit controls for Student")
    c.note(17, "My Grades shows IT210 85.5 / 93.75 and no create/edit controls")
    await person.read(1800)
    await person.click(nav(page, "Academic Record"))
    await page.getByText("IT210").first().waitFor()
    await page.getByText("93.75").first().waitFor()
    expect(await page.getByText(ms.student_number).first().isVisible(), "record header shows the student number")
    c.note(17, "Academic Record shows IT210 / WD-A with 85.5 and 93.75")
    await person.read(2400)
  })
  const reqs = readRequests()
  expect(/\[student\] GET \/students\/\d+\/academic-record -> 200/.test(reqs), "request log has the student's aggregate academic-record request")
  c.note(17, "aggregate endpoint GET /students/{id}/academic-record logged for the Student")
  await term.show()
  await term.clear()
  await c.footage("evidence", async () => {
    await term.run('sls academic-record requests.log | select -Last 2', 3500)
  })
  await desk.cmd("front SIMS Demo")
}

// 10 ---------------------------------------------------------------- authorization
chapters["10"] = async (c) => {
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await c.footage("access-denied", async () => {
    const page = pages.student
    await desk.cmd("keys ^l"); await sleep(600)
    await desk.cmd(`type ${WEB}/users`)
    await sleep(500); await desk.cmd("keys {ENTER}")
    await page.getByRole("heading", { name: "Access denied" }).waitFor()
    c.note(18, "Student opening /users sees the Access denied page")
    await person.read(2200)
  })
  await term.show()
  await term.clear()
  await c.footage("backend-403", async () => {
    await term.run("& $R\\scripts\\demo\\show-403.ps1", 4800)
  })
  await desk.cmd("front SIMS Demo")
  const r = await svc.api("student", "GET", "/users")
  expect(r.status === 403, `backend returns 403 for Student on /users (was ${r.status})`)
  c.note(18, `backend HTTP ${r.status} confirmed by an independent API check; body: ${JSON.stringify(r.body)}`)
}

// 11 ---------------------------------------------------------------- deactivate with confirmation
chapters["11"] = async (c) => {
  const ms = S.mainStudent
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await c.footage("deactivate", async () => {
    await switchTab("admin")
    const page = pages.admin
    await person.typeInto(page.getByLabel("Search students"), ms.student_number, { clear: true })
    await page.waitForURL(/search=2026-00150/)
    await rowWith(page, ms.student_number).waitFor()
    let confirmText = ""
    page.once("dialog", async (d) => { confirmText = d.message(); await sleep(3200); await d.accept() })
    await person.click(page.getByRole("button", { name: new RegExp(`^Deactivate student ${ms.student_number}`) }))
    await expect_(async () => confirmText !== "", "browser confirmation appeared")
    c.note(12, `confirmation shown: "${confirmText}"`)
    await waitToast(page)
    await expect_(async () => /INACTIVE/.test(await rowWith(page, ms.student_number).innerText()), "row shows INACTIVE")
    await person.read(1000)
    await desk.cmd("keys {F5}")
    await rowWith(page, ms.student_number).waitFor()
    await expect_(async () => /INACTIVE/.test(await rowWith(page, ms.student_number).innerText().catch(() => "")), "after reload the student is still INACTIVE")
    c.note(12, "after reload the student remains INACTIVE (fresh read); records for enrollment and grade are untouched")
    await person.read(2000)
  })
  const r = await svc.api("admin", "GET", "/students?search=2026-00150")
  expect(r.body.data[0].status === "INACTIVE", "API confirms INACTIVE")
}

// 12 ---------------------------------------------------------------- outage and recovery
chapters["12"] = async (c) => {
  const page = pages.admin
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await term.show(); await term.clear()
  let restarted = false
  try {
    await c.footage("stop-backend", async () => {
      await term.run("taskkill /PID (gc backend.pid) /T /F", 1800)
      await sleep(800)
      await term.run("curl.exe -sS -m 3 $API/health", 2600)
    })
    svc.owned.delete("backend")
    await desk.cmd("front SIMS Demo")
    await windowToDesktop()
    await c.footage("ui-error-and-recovery", async () => {
      await person.click(page.getByRole("button", { name: "Refresh" }))
      await page.getByText("The backend is unreachable").first().waitFor({ timeout: 20000 })
      c.note(19, "controlled network-error state: 'The backend is unreachable...'")
      await person.read(2200)
      await svc.startBackend(); restarted = true
      c.note(19, "demo backend restarted against the same database")
      await person.read(500)
      await person.click(page.getByRole("button", { name: "Try again" }))
      await page.getByRole("row").nth(1).waitFor()
      c.note(19, "Try again reloads the students table after the backend returns")
      for (let i = 0; i < 3; i++) {
        const retry = page.getByRole("button", { name: /^Retry .* options$/ }).first()
        if (!(await retry.count())) break
        await person.click(retry)
        await sleep(900)
      }
      await person.read(1800)
    })
  } finally {
    if (!svc.backendAlive()) { await svc.startBackend(); log("backend restored after chapter 12 (cleanup)") }
  }
}

// 13 ---------------------------------------------------------------- responsive + architecture
function findLine(file, regex) {
  const lines = readFileSync(path.join(root, file), "utf8").split(/\r?\n/)
  const i = lines.findIndex((l) => regex.test(l))
  expect(i >= 0, `${file} contains ${regex}`)
  return i + 1
}
function verifyCard(card) {
  for (const v of card.verify ?? []) expect(new RegExp(v.regex).test(readFileSync(path.resolve(root, v.file), "utf8")), `${v.file} matches ${v.regex}`)
}
chapters["13"] = async (c) => {
  const page = pages.admin
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  const desktopOrigin = { ...person.origin }
  backdrop = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(here, "backdrop.ps1")], { stdio: "ignore", windowsHide: true })
  await sleep(1500)
  try {
    await desk.place("SIMS Demo", 690, 40, 540, 1000)
    await person.calibrate()
    await c.footage("responsive", async () => {
      await sleep(600)
      c.note(20, "narrow viewport: 540px wide window inside the 1920x1080 recording")
      await person.click(page.getByRole("button", { name: "Open navigation" }))
      await person.read(700)
      await person.click(dialog(page).getByRole("link", { name: "Students", exact: true }))
      await page.getByRole("row").nth(1).waitFor()
      await person.read(800)
      await person.scroll(2, { hold: 450 })
      c.note(20, "mobile: navigation drawer, Students table scrolled")
      await person.scroll(-2, { hold: 450 })
      await sleep(700)
      await person.click(page.getByRole("button", { name: "Create student" }))
      await dialog(page).getByRole("heading", { name: "Create student" }).waitFor()
      await person.read(1000)
      await person.scroll(2, { hold: 450 })
      c.note(20, "mobile: Create student form usable")
      await person.click(dialog(page).getByRole("button", { name: "Cancel" }))
      await person.read(500)
      // restore the desktop view on camera
      try { backdrop.kill() } catch {}
      try { spawnSync("taskkill", ["/PID", String(backdrop.pid), "/T", "/F"], { stdio: "ignore" }) } catch {}
      await windowToDesktop()
      person.origin = desktopOrigin
      await sleep(500)
      await person.click(nav(page, "Dashboard"))
      await person.read(900)
      c.note(20, "desktop layout restored")
    })
  } finally {
    try { backdrop.kill() } catch {}
    try { spawnSync("taskkill", ["/PID", String(backdrop.pid), "/T", "/F"], { stdio: "ignore" }) } catch {}
    await windowToDesktop()
    person.origin = desktopOrigin
  }
  // architecture: every card is verified against the real files first
  const cards = S.architectureCards
  cards.forEach(verifyCard)
  const router = findLine("src/app/router.tsx", /export const router = createBrowserRouter/)
  const apiReq = findLine("src/services/api/client.ts", /export async function apiRequest/)
  const tokenKey = findLine("src/services/api/client.ts", /const TOKEN_KEY/)
  const req = findLine("../lab-02-student-api/app/dependencies.py", /def require_roles/)
  const inval = findLine("src/services/api/query-support.ts", /export function invalidateResource/)
  await c.card(cards[0]); await term.show(); await term.clear()
  await c.footage("source-routing", async () => { await term.run(`v src\\app\\router.tsx ${router} ${router + 10}`, 3000); await term.run(`v src\\services\\api\\client.ts ${apiReq} ${apiReq + 8}`, 3200) })
  await c.card(cards[1]); await term.clear()
  await c.footage("source-auth", async () => { await term.run(`v ..\\lab-02-student-api\\app\\dependencies.py ${req} ${req + 12}`, 3200) })
  await c.card(cards[2])
  await c.card(cards[3]); await term.clear()
  await c.footage("ai-log", async () => { await term.run("gc $R\\docs\\AI_DEVELOPMENT_LOG.md -TotalCount 7", 5000) })
  await desk.cmd("front SIMS Demo")
}

// 14 ---------------------------------------------------------------- bonuses
chapters["14"] = async (c) => {
  const page = pages.admin
  await c.card({ seconds: 2.0, lines: [c.chapter.title, c.chapter.why], style: "story" }, `Chapter ${c.chapter.id}`)
  await c.footage("bonuses", async () => {
    await person.click(page.getByRole("button", { name: "Change color theme" }))
    await expect_(async () => (await page.evaluate(() => document.documentElement.classList.contains("dark"))), "dark theme applied")
    c.note(null, "bonus: dark theme applied")
    await person.read(1100)
    await person.click(page.getByRole("button", { name: "Change color theme" }))
    await expect_(async () => !(await page.evaluate(() => document.documentElement.classList.contains("dark"))), "light theme restored")
    await person.read(700)
    await person.click(nav(page, "Students"))
    await page.getByRole("row").nth(1).waitFor()
    const first = page.getByRole("row").nth(1)
    const label = await first.getByRole("button", { name: /^Edit student/ }).getAttribute("aria-label")
    const before = (await first.innerText()).split("\t")
    await person.click(first.getByRole("button", { name: /^Edit student/ }))
    const dlg = dialog(page)
    await field(dlg, "year_level").waitFor()
    const current = await field(dlg, "year_level").inputValue()
    const next = current === "3" ? "Year 2" : "Year 3"
    await person.pick(field(dlg, "year_level"), next)
    await person.click(dlg.getByRole("button", { name: "Save changes" }))
    await waitToast(page)
    await dlg.waitFor({ state: "hidden" })
    await expect_(async () => (await page.getByRole("row").nth(1).innerText()) !== before.join("\t"), "list row updated without manual refresh")
    c.note(null, `bonus: query invalidation - ${label} year level updated and the list refreshed on its own`)
    await person.read(1600)
  })
  await term.show(); await term.clear()
  await c.footage("a11y", async () => {
    await term.run("gc a11y-tests.log -Tail 9", 3000)
  })
  await desk.cmd("front SIMS Demo")
}

// 15 ---------------------------------------------------------------- closing
chapters["15"] = async (c) => {
  await c.footage("final-result", async () => {
    await switchTab("student")
    await pages.student.getByText("93.75").first().waitFor()
    await person.read(1800)
  })
  await c.card(c.chapter.cards[0])
}

// ------------------------------------------------------------------ run
async function preflight() {
  const out = { startedAt: new Date().toISOString(), checks: [] }
  const check = (name, ok, detail) => { out.checks.push({ name, ok, detail }); log(`preflight ${ok ? "PASS" : "FAIL"}: ${name}${detail ? " - " + detail : ""}`); if (!ok) throw new Error(`Preflight failed: ${name}`) }
  const health = await fetch("http://127.0.0.1:8200/health").then((r) => r.json())
  check("backend health", health.success === true, `env=${health.data.environment}`)
  for (const role of ["admin", "instructor", "student"]) { const t = await svc.login(role).catch(() => null); check(`login ${role}`, Boolean(t)) }
  const students = await svc.api("admin", "GET", "/students?per_page=10")
  if (!state.chapters["05"]?.status) check("42 seeded students with several pages", students.body.meta.total === 42 && students.body.meta.last_page >= 4, `total=${students.body.meta.total}`)
  const forbidden = await svc.api("student", "GET", "/users")
  check("Student receives HTTP 403 on /users", forbidden.status === 403, JSON.stringify(forbidden.body))
  const invalid = await svc.api("admin", "POST", "/students", { student_number: "2026-09999", first_name: "Preflight", last_name: "Probe", email: S.invalidEmail, program_id: 1, year_level: 1 })
  check(`backend rejects email "${S.invalidEmail}" with 422 (no record created)`, invalid.status === 422, `status=${invalid.status}`)
  const probe = await svc.api("admin", "GET", "/students?search=2026-09999")
  check("validation probe created nothing", probe.body.meta.total === 0)
  const feweb = await fetch(WEB).then((r) => r.status)
  check("frontend reachable", feweb === 200)
  const a11y = spawnSync("cmd", ["/c", "npx", "vitest", "run", "src/components/ui/accessibility.test.tsx"], { cwd: root, encoding: "utf8" })
  writeFileSync(path.join(svc.work, "a11y-tests.log"), (a11y.stdout + a11y.stderr).replace(/\x1b\[[0-9;]*m/g, ""))
  check("component accessibility tests pass", a11y.status === 0)
  writeFileSync(path.join(runDir, "preflight.json"), JSON.stringify(out, null, 2))
}

let exitCode = 0
try {
  const display = primaryDisplay()
  if (display.w !== 1920 || display.h !== 1080 || display.x !== 0 || display.y !== 0) throw new Error(`Primary display must be 1920x1080 at 0,0 (found ${JSON.stringify(display)})`)
  log(`display verified ${display.w}x${display.h}`)
  if (fresh) {
    const manifest = svc.buildDatabase()
    writeFileSync(path.join(runDir, "manifest.json"), JSON.stringify({ ...manifest, scenario: { mainStudent: S.mainStudent, newCourse: S.newCourse, newTerm: S.newTerm, newOffering: S.newOffering, grade: S.grade } }, null, 2))
    log("demo database built and checkpoint 00-seeded saved")
  } else {
    const firstIdx = allIds.indexOf(selected[0])
    const prev = firstIdx > 0 ? allIds[firstIdx - 1] : null
    const cp = prev && existsSync(path.join(svc.checkpoints, `after-${prev}.db`)) ? `after-${prev}` : "00-seeded"
    log(`resume: restoring checkpoint ${cp} with the backend stopped`)
    await svc.restoreCheckpoint(cp)
  }
  if (fresh || !svc.backendAlive()) await svc.startBackend()
  await svc.startFrontend()
  writeFileSync(requestsLog, "")
  await preflight()

  desk = new Desk()
  rec = new Recorder(display)
  person = new Person({ desk, rng: makeRng(20261012), log })
  await launch()
  await setupSessions(!selected.includes("03"))
  await sleep(500)
  await desk.place("SIMS Demo", 0, 0, 1920, 1080)
  term = new Terminal({ desk, root, work: svc.work, env: { DEMO_STUDENT_PASSWORD: svc.secrets.student }, rng: person.rng })
  await term.open()
  await desk.cmd("front SIMS Demo")

  for (const id of selected) {
    const chapter = S.chapters.find((x) => x.id === id)
    let ok = false
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      log(`=== chapter ${id} "${chapter.title}" attempt ${attempt} (tasks ${chapter.tasks.join(",") || "-"}) ===`)
      const c = makeChapterContext(chapter)
      try {
        person.rng = makeRng(20261012 + Number(id) * 31 + attempt)
        await desk.cmd(`seed ${Number(id) * 7919 + attempt}`)
        await prepare(id)
        await chapters[id](c)
        state.chapters[id] = { status: "captured", segments: c.segments, evidence: c.evidence, capturedAt: new Date().toISOString(), attempt }
        saveState()
        svc.checkpoint(`after-${id}`)
        ok = true
      } catch (error) {
        log(`chapter ${id} FAILED: ${error.message}`)
        try { if (rec?.proc && !rec.proc.killed) await rec.stop() } catch {}
        try { const pg = Object.values(pages).find(Boolean); if (pg) await pg.screenshot({ path: path.join(logDir, `fail-${id}-attempt${attempt}.png`) }) } catch {}
        state.chapters[id] = { status: "failed", error: error.message, attempt, evidence: c.evidence }
        saveState()
        if (backdrop) { try { backdrop.kill() } catch {} }
        const prevIdx = allIds.indexOf(id) - 1
        const cp = prevIdx >= 0 && existsSync(path.join(svc.checkpoints, `after-${allIds[prevIdx]}.db`)) ? `after-${allIds[prevIdx]}` : "00-seeded"
        if (attempt < 2) { log(`restoring ${cp} (backend stopped first) and retrying`); await svc.restoreCheckpoint(cp); await sleep(500) }
      }
    }
    if (!ok) { exitCode = 1; log(`stopping: chapter ${id} could not be captured; later chapters depend on its state`); break }
  }
} catch (error) {
  exitCode = 1
  log(`FATAL: ${error.stack ?? error.message}`)
} finally {
  try { if (backdrop) backdrop.kill() } catch {}
  try { if (svc && !svc.backendAlive() && svc.owned.size >= 0 && existsSync(svc.db)) { /* restored below if needed */ } } catch {}
  try { term?.close() } catch {}
  try { await browser?.close() } catch {}
  try { desk?.close() } catch {}
  await svc.stopAll()
  saveState()
}
process.exit(exitCode)
