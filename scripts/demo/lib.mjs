// Shared recording helpers: visible cursor, click ripple, eased movement, natural typing.
import { mkdirSync, renameSync } from "node:fs"
import path from "node:path"

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

function overlayScript() {
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
}

/** Opens an isolated 1920x1080 recorded context and returns a driver for it. */
export async function openRecordedSession(browser, rawDir) {
  mkdirSync(rawDir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
  })
  await context.addInitScript(overlayScript)
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
  async function click(loc, ms = 600) {
    await moveToLocator(loc, ms)
    await page.mouse.down()
    await sleep(70)
    await page.mouse.up()
  }
  async function type(loc, text, delay = 80, moveMs = 300) {
    await click(loc, moveMs)
    await page.keyboard.type(text, { delay })
  }

  let t0 = 0
  const slots = []
  return {
    page, moveTo, click, type,
    /** Starts the timed part of the clip; earlier footage is trimmed away. */
    start() {
      t0 = Date.now()
      return (t0 - videoStarted) / 1000
    },
    /** Runs fn, fails if it overruns endSec, then holds until endSec. */
    async slot(name, endSec, fn) {
      await fn()
      const elapsed = (Date.now() - t0) / 1000
      slots.push({ name, elapsed: +elapsed.toFixed(3), budget: endSec })
      if (elapsed > endSec) throw new Error(`Slot "${name}" overran: ${elapsed.toFixed(2)}s > ${endSec}s. Re-record rather than trim.`)
      await sleep((endSec - elapsed) * 1000)
    },
    async finish(fileName) {
      await sleep(1500)
      const video = page.video()
      await context.close()
      const target = path.join(rawDir, fileName)
      renameSync(await video.path(), target)
      return { file: fileName, slots }
    },
  }
}

export async function signIn(session, email, password) {
  const { page } = session
  await page.getByRole("heading", { name: "Welcome back" }).waitFor()
  await session.type(page.getByLabel("Email"), email)
  await session.type(page.getByLabel("Password"), password)
  await session.click(page.getByRole("button", { name: "Sign in" }), 350)
  await page.getByRole("heading", { name: /^Welcome,/ }).waitFor()
  await page.waitForLoadState("networkidle")
}
