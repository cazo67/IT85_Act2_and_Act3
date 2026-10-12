// Natural screen-recording demo: ONE visible Chrome window, three pre-signed-in tabs
// (Admin / Student / Instructor), real OS cursor, recorded at a true 30 fps by ffmpeg gdigrab.
import { chromium } from "@playwright/test"
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const base = process.env.DEMO_FRONTEND_URL
const outDir = process.env.DEMO_RAW_DIR
const accounts = [
  { key: "Admin", email: "admin@example.com", password: process.env.DEMO_ADMIN_PASSWORD },
  { key: "Student", email: "student@example.com", password: process.env.DEMO_STUDENT_PASSWORD },
  { key: "Instructor", email: "instructor@example.com", password: process.env.DEMO_INSTRUCTOR_PASSWORD },
]
if (!base || !outDir || accounts.some((a) => !a.password)) throw new Error("DEMO_FRONTEND_URL, DEMO_RAW_DIR and three DEMO_*_PASSWORD variables are required.")
mkdirSync(outDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rand = (a, b) => a + Math.random() * (b - a)

// ---- real-cursor helper ----
const mouse = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(path.dirname(fileURLToPath(import.meta.url)), "mouse.ps1")], { stdio: ["pipe", "pipe", "inherit"] })
let waiting = null
let buffer = ""
mouse.stdout.on("data", (d) => {
  buffer += d
  let i
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i).trim()
    buffer = buffer.slice(i + 1)
    if (waiting && line) { const w = waiting; waiting = null; w(line) }
  }
})
const send = (cmd) => new Promise((resolve) => { waiting = resolve; mouse.stdin.write(cmd + "\n") })

const WIN = { x: -8, y: 0, w: 1936, h: 1088 } // Windows adds an invisible 8px frame; this makes the visible area exactly 1920x1080
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: [`--window-position=${WIN.x},${WIN.y}`, `--window-size=${WIN.w},${WIN.h}`, "--force-device-scale-factor=1", "--disable-infobars", "--no-first-run", "--disable-features=Translate,PasswordLeakDetection", "--hide-scrollbars"],
})
const context = await browser.newContext({ viewport: null, colorScheme: "light" })
await context.addInitScript(() => {
  try { localStorage.setItem("theme", "light") } catch {}
  window.__mouse = { x: -1, y: -1 }
  addEventListener("mousemove", (e) => { window.__mouse = { x: e.clientX, y: e.clientY } }, true)
  const ripple = () => {
    const s = document.createElement("style")
    s.textContent = `.demo-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid rgba(37,99,235,.9);background:rgba(37,99,235,.25);animation:demo-ripple .55s ease-out forwards}@keyframes demo-ripple{to{transform:scale(3.6);opacity:0}}`
    document.head.appendChild(s)
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div"); r.className = "demo-ripple"
      r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"
      document.body.appendChild(r); setTimeout(() => r.remove(), 700)
    }, true)
  }
  if (document.body) ripple(); else addEventListener("DOMContentLoaded", ripple)
})

// ---- three tabs, each signed in separately (sessionStorage is per tab) ----
const pages = []
for (const acct of accounts) {
  const page = await context.newPage()
  await page.goto(base + "/login")
  await page.getByLabel("Email").fill(acct.email)
  await page.getByLabel("Password").fill(acct.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.getByRole("heading", { name: /^Welcome,/ }).waitFor()
  await page.waitForLoadState("networkidle")
  await page.evaluate((t) => { document.title = t }, `SIMS Demo - ${acct.key}`)
  pages.push(page)
}
for (const p of context.pages()) if (!pages.includes(p)) await p.close() // drop the initial blank tab
await pages[0].bringToFront()
await sleep(500)
await send(`place SIMS ${WIN.x} ${WIN.y} ${WIN.w} ${WIN.h}`)
await sleep(800)

// ---- calibrate: where does a screen point land inside the page? ----
await send("glide 700 600 300")
await sleep(250)
const m = await pages[0].evaluate(() => window.__mouse)
const origin = { x: 700 - m.x, y: 600 - m.y }
console.log("page origin on screen:", origin)

// ---- helpers: human-like clicks ----
let current = pages[0]
async function clickAt(sx, sy, ms) {
  await send(`glide ${Math.round(sx)} ${Math.round(sy)} ${Math.round(ms)}`)
  await sleep(rand(120, 260))
  await send("down"); await sleep(rand(55, 95)); await send("up")
}
async function clickEl(loc, ms = rand(750, 1000)) {
  const box = await loc.boundingBox()
  if (!box) throw new Error("Element not visible")
  await clickAt(origin.x + box.x + box.width / 2 + rand(-box.width * 0.18, box.width * 0.18), origin.y + box.y + box.height / 2 + rand(-3, 3), ms)
}
async function switchTab(i) {
  const tabCenterX = 14 + 238 * i + 120 // approximate Chrome tab geometry; verified in frames
  await clickAt(tabCenterX, 18, rand(800, 1000))
  await pages[i].bringToFront() // guarantees the switch even if the click missed
  current = pages[i]
  await sleep(450)
}
const nav = () => current.getByRole("navigation", { name: "Primary navigation" })

// ---- start true screen recording ----
const rec = spawn("ffmpeg", ["-y", "-v", "error", "-f", "gdigrab", "-framerate", "30", "-draw_mouse", "1", "-offset_x", "0", "-offset_y", "0", "-video_size", "1920x1080", "-i", "desktop", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "14", "-pix_fmt", "yuv420p", path.join(outDir, "screen.mkv")], { stdio: ["pipe", "ignore", "inherit"] })
await sleep(1200)
const stamps = {}
try {
  stamps.admin = 1.2
  await sleep(1600)                                                       // Admin dashboard
  await clickEl(nav().getByRole("link", { name: "Students" }))
  await current.getByRole("row").nth(1).waitFor(); await sleep(2200)      // Admin: students

  await switchTab(1); stamps.student = 1
  await sleep(1300)                                                       // Student dashboard
  await clickEl(nav().getByRole("link", { name: "Academic Record" }))
  await current.getByText("IT101").first().waitFor(); await sleep(3000)   // Student: record

  await switchTab(2); stamps.instructor = 1
  await sleep(1300)                                                       // Instructor dashboard
  await clickEl(nav().getByRole("link", { name: "My Classes" }))
  const row = current.getByRole("row").filter({ hasText: "IT101" }).first()
  await row.waitFor()
  await clickEl(row.getByRole("button", { name: /^View/ }), rand(650, 850))
  await clickEl(current.getByRole("link", { name: "Open class roster" }), rand(600, 800))
  await current.getByText("2026-00001").first().waitFor(); await sleep(3200) // Instructor: roster
} finally {
  rec.stdin.write("q")
  await new Promise((r) => rec.on("close", r))
  mouse.kill()
  await browser.close()
}
console.log("Recorded", path.join(outDir, "screen.mkv"))
