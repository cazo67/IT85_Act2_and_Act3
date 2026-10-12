// Drives the real app through the 25-second admin flow and records raw footage.
import { chromium } from "@playwright/test"
import { mkdirSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"

const base = process.env.DEMO_FRONTEND_URL
const outDir = process.env.DEMO_RAW_DIR
const email = process.env.DEMO_ADMIN_EMAIL ?? "admin@example.com"
const password = process.env.DEMO_ADMIN_PASSWORD
if (!base || !outDir || !password) throw new Error("DEMO_FRONTEND_URL, DEMO_RAW_DIR and DEMO_ADMIN_PASSWORD are required.")
mkdirSync(outDir, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--force-device-scale-factor=1", "--hide-scrollbars"] })
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
})
await context.addInitScript(() => {
  try { localStorage.setItem("theme", "light") } catch {}
  const install = () => {
    if (document.getElementById("demo-cursor")) return
    const style = document.createElement("style")
    style.textContent = `
      #demo-cursor{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none}
      #demo-cursor svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}
      .demo-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid rgba(37,99,235,.9);background:rgba(37,99,235,.25);animation:demo-ripple .55s ease-out forwards}
      @keyframes demo-ripple{to{transform:scale(3.6);opacity:0}}`
    document.head.appendChild(style)
    const c = document.createElement("div")
    c.id = "demo-cursor"
    c.style.transform = "translate(960px,540px)"
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l14 8-6 1.8L8.6 18z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    document.body.appendChild(c)
    addEventListener("mousemove", (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)` }, true)
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div")
      r.className = "demo-ripple"
      r.style.left = e.clientX + "px"
      r.style.top = e.clientY + "px"
      document.body.appendChild(r)
      setTimeout(() => r.remove(), 700)
    }, true)
  }
  if (document.body) install()
  else addEventListener("DOMContentLoaded", install)
})

const page = await context.newPage()
const videoStarted = Date.now()
let cx = 960
let cy = 540

async function moveTo(x, y, ms = 600) {
  const sx = cx
  const sy = cy
  const start = Date.now()
  for (;;) {
    const t = Math.min(1, (Date.now() - start) / ms)
    const e = ease(t)
    await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e)
    if (t >= 1) break
    await sleep(8)
  }
  cx = x
  cy = y
}
async function moveToLocator(loc, ms = 600) {
  const box = await loc.boundingBox()
  if (!box) throw new Error("Target not visible for cursor movement.")
  await moveTo(box.x + box.width / 2, box.y + box.height / 2, ms)
}
async function clickLocator(loc, ms = 600) {
  await moveToLocator(loc, ms)
  await page.mouse.down()
  await sleep(70)
  await page.mouse.up()
}
async function typeInto(loc, text, delay = 100) {
  await clickLocator(loc, 350)
  await page.keyboard.type(text, { delay })
}

await page.goto(base + "/login")
await page.getByRole("heading", { name: "Welcome back" }).waitFor()
await page.mouse.move(cx, cy)
await sleep(400)

const t0 = Date.now()
const offsetMs = t0 - videoStarted
const slots = []
async function slot(name, endSec, fn) {
  await fn()
  const elapsed = (Date.now() - t0) / 1000
  slots.push({ name, elapsed, budget: endSec })
  if (elapsed > endSec) throw new Error(`Slot "${name}" overran: ${elapsed.toFixed(2)}s > ${endSec}s. Re-record rather than trim.`)
  await sleep((endSec - elapsed) * 1000)
}
const nav = page.getByRole("navigation", { name: "Primary navigation" })

await slot("login", 5, async () => {
  await typeInto(page.getByLabel("Email"), email, 80)
  await typeInto(page.getByLabel("Password"), password, 80)
  await clickLocator(page.getByRole("button", { name: "Sign in" }), 400)
})
await slot("dashboard", 10, async () => {
  await page.getByRole("heading", { name: /^Welcome,/ }).waitFor()
  await page.waitForLoadState("networkidle")
  await moveTo(1200, 520, 900)
})
await slot("students", 15, async () => {
  await clickLocator(nav.getByRole("link", { name: "Students" }), 600)
  await page.getByRole("row").nth(1).waitFor()
  await typeInto(page.getByLabel("Search students"), "2026-00001", 80)
  await page.getByRole("row").filter({ hasText: "2026-00001" }).first().waitFor()
})
await slot("offerings", 20, async () => {
  await clickLocator(nav.getByRole("link", { name: "Course Offerings" }), 800)
  await page.getByRole("row").nth(1).waitFor()
  await page.waitForLoadState("networkidle")
})
await slot("grades", 25, async () => {
  await clickLocator(nav.getByRole("link", { name: "Grades" }), 800)
  await page.getByRole("row").nth(1).waitFor()
  await page.waitForLoadState("networkidle")
})

await sleep(1500)
const video = page.video()
await context.close()
await browser.close()
const finalRaw = path.join(outDir, "raw.webm")
renameSync(await video.path(), finalRaw)
writeFileSync(path.join(outDir, "capture.json"), JSON.stringify({ offsetSeconds: offsetMs / 1000, slots }, null, 2))
console.log(`Captured ${finalRaw}; trim offset ${(offsetMs / 1000).toFixed(2)}s`)
