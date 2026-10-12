// Desktop-level recording helpers: OS cursor/keys via desktop-helper.ps1, ffmpeg gdigrab capture,
// and a "Person" that drives Playwright pages with human-like, bounded, reproducible timing.
import { spawn, execFileSync } from "node:child_process"
import { appendFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Small deterministic PRNG so timing variation is bounded and reproducible per seed.
export function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Desk {
  constructor() {
    this.proc = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(here, "desktop-helper.ps1")], { stdio: ["pipe", "pipe", "inherit"] })
    this.buffer = ""
    this.pending = []
    this.chain = Promise.resolve()
    this.proc.stdout.on("data", (d) => {
      this.buffer += d
      let i
      while ((i = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, i).replace(/\r$/, "")
        this.buffer = this.buffer.slice(i + 1)
        const next = this.pending.shift()
        if (next) next(line)
      }
    })
  }
  cmd(line) {
    const run = () => new Promise((resolve) => { this.pending.push(resolve); this.proc.stdin.write(line + "\n") })
    const result = this.chain.then(run)
    this.chain = result.catch(() => {})
    return result
  }
  async rect(title) { return parseRect(await this.cmd(`rect ${title}`)) }
  async place(title, x, y, w, h) {
    const reply = await this.cmd(`place ${title}|${x} ${y} ${w} ${h}`)
    const r = parseRect(reply)
    if (!r) throw new Error(`Could not place window "${title}": ${reply}`)
    return r
  }
  close() { try { this.proc.kill() } catch {} }
}

function parseRect(reply) {
  const n = reply.trim().split(/\s+/).map(Number)
  return n.length === 4 && n.every(Number.isFinite) ? { x: n[0], y: n[1], w: n[2], h: n[3] } : null
}

/** One desktop recording: ffmpeg gdigrab of the primary 1920x1080 display, with cursor. */
export class Recorder {
  constructor(display) { this.display = display }
  start(file) {
    this.file = file
    this.proc = spawn("ffmpeg", ["-y", "-v", "error", "-f", "gdigrab", "-framerate", "30", "-draw_mouse", "1", "-offset_x", String(this.display.x), "-offset_y", String(this.display.y), "-video_size", `${this.display.w}x${this.display.h}`, "-i", "desktop", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "14", "-pix_fmt", "yuv420p", file], { stdio: ["pipe", "ignore", "inherit"] })
    this.startedAt = Date.now()
    this.closed = new Promise((r) => this.proc.on("close", r))
    return sleep(900) // let gdigrab produce its first frames before any action
  }
  async stop() {
    await sleep(600)
    this.proc.stdin.write("q")
    await this.closed
    return (Date.now() - this.startedAt) / 1000
  }
}

export function primaryDisplay() {
  const out = execFileSync("powershell", ["-NoProfile", "-Command", "Add-Type -AssemblyName System.Windows.Forms; $s=[Windows.Forms.Screen]::PrimaryScreen; Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware(); [DllImport(\"user32.dll\")] public static extern int GetSystemMetrics(int i);' -Name D -Namespace N; [N.D]::SetProcessDPIAware() | Out-Null; \"$([N.D]::GetSystemMetrics(0)) $([N.D]::GetSystemMetrics(1)) $($s.Bounds.X) $($s.Bounds.Y)\""], { encoding: "utf8" }).trim().split(" ").map(Number)
  return { w: out[0], h: out[1], x: out[2], y: out[3] }
}

/** Drives Playwright pages through the real OS mouse/keyboard with human-like pacing. */
export class Person {
  constructor({ desk, rng, log }) {
    this.desk = desk
    this.rng = rng
    this.log = log
    this.origin = { x: 0, y: 0 }
    this.page = null
  }
  r(a, b) { return a + this.rng() * (b - a) }
  async pause(ms, spread = 0.15) { await sleep(ms * (1 + (this.rng() * 2 - 1) * spread)) }
  /** Reading time: deliberately NOT sped up. */
  read(ms) { return this.pause(ms, 0.1) }

  use(page) { this.page = page }

  /** Learns where the page's top-left sits on the screen by observing a real mouse event. */
  async calibrate() {
    const probe = { x: 760, y: 640 }
    await this.desk.cmd(`glide ${probe.x} ${probe.y} 350`)
    await sleep(160)
    await this.desk.cmd(`glide ${probe.x + 6} ${probe.y + 4} 120`)
    await sleep(160)
    const m = await this.page.evaluate(() => window.__mouse)
    if (!m || m.x < 0) throw new Error("Calibration failed: page did not receive the OS mouse (is the Chrome window in front?)")
    this.origin = { x: probe.x + 6 - m.x, y: probe.y + 4 - m.y }
    return this.origin
  }

  async moveToBox(box, ms) {
    const x = this.origin.x + box.x + box.width * this.r(0.3, 0.7)
    const y = this.origin.y + box.y + box.height * this.r(0.35, 0.65)
    await this.desk.cmd(`glide ${Math.round(x)} ${Math.round(y)}${ms ? " " + Math.round(ms) : ""}`)
  }
  async moveTo(locator, ms) {
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    if (!box) throw new Error("Element has no bounding box")
    await this.moveToBox(box, ms)
  }
  async click(locator, { hesitate = this.rng() < 0.4, ms } = {}) {
    await this.moveTo(locator, ms)
    await sleep(hesitate ? this.r(150, 380) : this.r(60, 140))
    await this.desk.cmd("down"); await sleep(this.r(55, 100)); await this.desk.cmd("up")
    await sleep(this.r(90, 200))
  }
  /** Real keyboard input to the focused browser element, 80-120 ms per character. */
  async typeInto(locator, text, { clear = false } = {}) {
    await this.click(locator)
    if (clear) { await this.page.keyboard.press("Control+A"); await this.page.keyboard.press("Backspace") }
    for (const ch of text) {
      await this.page.keyboard.type(ch)
      let d = this.r(80, 120)
      await sleep(d)
    }
    await sleep(this.r(120, 260))
  }
  /** Small wheel steps with pauses, via the real mouse wheel. */
  async scroll(notches, { step = 1, hold = 450 } = {}) {
    const dir = notches < 0 ? -1 : 1
    for (let i = 0; i < Math.abs(notches); i += step) {
      await this.desk.cmd(`wheel ${-dir * step}`)
      await sleep(this.r(hold * 0.7, hold * 1.3))
    }
  }
  /** Chooses an option of a native <select> by opening it with a real click and using real arrow keys. */
  async pick(selectLocator, label) {
    const plan = await selectLocator.evaluate((el, l) => {
      const texts = [...el.options].map((o) => o.textContent.trim())
      const want = l.trim().toLowerCase()
      let idx = texts.findIndex((t) => t.toLowerCase() === want)
      if (idx < 0) idx = texts.findIndex((t) => t.toLowerCase().startsWith(want))
      if (idx < 0) idx = texts.findIndex((t) => t.toLowerCase().includes(want))
      return { idx, cur: el.selectedIndex }
    }, label)
    if (plan.idx < 0) throw new Error(`No option "${label}"`)
    await this.click(selectLocator)
    await sleep(this.r(350, 600))
    const delta = plan.idx - plan.cur
    for (let i = 0; i < Math.abs(delta); i++) { await this.desk.cmd(delta > 0 ? "keys {DOWN}" : "keys {UP}"); await sleep(this.r(120, 260)) }
    await sleep(this.r(200, 400))
    await this.desk.cmd("keys {ENTER}")
    await sleep(this.r(300, 500))
    const got = await selectLocator.evaluate((el) => el.selectedIndex)
    if (got !== plan.idx) {
      this.log(`pick fallback for "${label}" (index ${got}, wanted ${plan.idx})`)
      await selectLocator.selectOption({ index: plan.idx })
      await sleep(300)
    }
  }
}

/** Visible, real interactive PowerShell (conhost) driven with real keystrokes. */
export class Terminal {
  constructor({ desk, root, work, env, rng }) { Object.assign(this, { desk, root, work, env, rng }) }
  async open() {
    const q = (v) => `"${v}"`
    const ps = `$p = Start-Process conhost.exe -ArgumentList 'powershell.exe','-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-File','${q(path.join(here, "term-init.ps1"))}','-Root','${q(this.root)}','-Work','${q(this.work)}' -PassThru; $p.Id`
    const pid = execFileSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8", env: { ...process.env, ...this.env } }).trim()
    this.proc = { pid: Number(pid), kill() {} }
    for (let i = 0; i < 40; i++) {
      await sleep(250)
      if ((await this.desk.cmd("rect SIMS Terminal")) !== "nowindow") break
    }
    await sleep(1200)
    await this.show()
  }
  async show() {
    const r = parseRect(await this.desk.cmd("rawplace SIMS Terminal|0 0 1920 1080")); this.rect = r
    await this.desk.cmd("front SIMS Terminal")
    await sleep(500)
  }
  async run(command, readMs = 2500) {
    await this.desk.cmd("front SIMS Terminal")
    await sleep(250 + this.rng() * 250)
    await this.desk.cmd(`type ${command}`)
    await sleep(350 + this.rng() * 300)
    await this.desk.cmd("keys {ENTER}")
    await sleep(readMs)
  }
  async clear() { await this.desk.cmd("front SIMS Terminal"); await this.desk.cmd("type cls"); await this.desk.cmd("keys {ENTER}"); await sleep(400) }
  close() { try { this.proc.kill() } catch {}; try { execFileSync("taskkill", ["/PID", String(this.proc.pid), "/T", "/F"], { stdio: "ignore" }) } catch {} }
}

export function appendLog(file, line) { mkdirSync(path.dirname(file), { recursive: true }); appendFileSync(file, line + "\n") }
