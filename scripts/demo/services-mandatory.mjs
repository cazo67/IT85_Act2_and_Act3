// Owns the processes and state of one mandatory-demo run: demo database, backend, Vite, checkpoints, API checks.
import { spawn, spawnSync, execFileSync } from "node:child_process"
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs"
import crypto from "node:crypto"
import path from "node:path"
import { sleep } from "./lib-desktop.mjs"

export const API_PORT = 8200
export const WEB_PORT = 3200
export const API = `http://127.0.0.1:${API_PORT}/api/v1`
export const WEB = `http://localhost:${WEB_PORT}`

const randomSecret = (n) => crypto.randomBytes(n).toString("base64url")

export class Services {
  constructor({ root, runDir }) {
    this.root = root
    this.backendRoot = path.resolve(root, "..", "lab-02-student-api")
    this.python = path.join(this.backendRoot, ".venv", "Scripts", "python.exe")
    this.runDir = runDir
    this.work = path.join(runDir, "work")
    this.checkpoints = path.join(runDir, "checkpoints")
    this.db = path.join(this.work, "demo-student-api.db")
    this.secretsFile = path.join(this.work, "secrets.json")
    this.owned = new Map() // name -> child process
  }

  loadOrCreateSecrets() {
    mkdirSync(this.work, { recursive: true })
    if (existsSync(this.secretsFile)) {
      this.secrets = JSON.parse(readFileSync(this.secretsFile, "utf8"))
      return false
    }
    this.secrets = {
      admin: `Ad-${randomSecret(9)}9!`,
      instructor: `In-${randomSecret(9)}9!`,
      student: `St-${randomSecret(9)}9!`,
      authSecret: randomSecret(36),
    }
    writeFileSync(this.secretsFile, JSON.stringify(this.secrets))
    return true
  }

  backendEnv() {
    return {
      ...process.env,
      APP_ENV: "test",
      DATABASE_URL: "sqlite:///" + this.db.replace(/\\/g, "/"),
      AUTH_SECRET: this.secrets.authSecret,
      CORS_ORIGINS: WEB,
      PYTHONDONTWRITEBYTECODE: "1",
      DEMO_ADMIN_PASSWORD: this.secrets.admin,
      DEMO_INSTRUCTOR_PASSWORD: this.secrets.instructor,
      DEMO_STUDENT_PASSWORD: this.secrets.student,
    }
  }

  runPython(args, label) {
    const r = spawnSync(this.python, args, { cwd: this.backendRoot, env: { ...this.backendEnv(), PYTHONPATH: this.backendRoot }, encoding: "utf8" })
    if (r.status !== 0) throw new Error(`${label} failed:\n${r.stdout}\n${r.stderr}`)
    return r.stdout
  }

  /** Builds the disposable database with the real Alembic migrations and the demo seed. Never touches normal DBs. */
  buildDatabase() {
    if (existsSync(this.db)) throw new Error(`Refusing to rebuild existing demo database: ${this.db}`)
    this.runPython(["-m", "alembic", "upgrade", "head"], "migration")
    const out = this.runPython([path.join(this.root, "scripts", "demo", "seed_demo.py")], "demo seed")
    const manifest = JSON.parse(out.trim().split(/\r?\n/).pop())
    this.checkpoint("00-seeded")
    return manifest
  }

  /** Online SQLite backup (safe while the backend is running). */
  checkpoint(name) {
    mkdirSync(this.checkpoints, { recursive: true })
    const dst = path.join(this.checkpoints, `${name}.db`)
    const code = `import sqlite3,sys;s=sqlite3.connect(sys.argv[1]);d=sqlite3.connect(sys.argv[2]);s.backup(d);d.close();s.close()`
    this.runPython(["-c", code, this.db, dst], "checkpoint")
    return dst
  }

  /** Restores a checkpoint. Backend must be stopped first; this method enforces that. */
  async restoreCheckpoint(name) {
    const src = path.join(this.checkpoints, `${name}.db`)
    if (!existsSync(src)) throw new Error(`Missing checkpoint ${name}`)
    await this.stop("backend")
    for (const suffix of ["", "-wal", "-shm", "-journal"]) { try { execFileSync("cmd", ["/c", "del", "/f", "/q", this.db + suffix], { stdio: "ignore" }) } catch {} }
    copyFileSync(src, this.db)
    await this.startBackend()
  }

  spawnOwned(name, command, args, opts) {
    const log = openSync(path.join(this.work, `${name}.log`), "a")
    const child = spawn(command, args, { ...opts, stdio: ["ignore", log, log], windowsHide: true })
    closeSync(log)
    this.owned.set(name, child)
    writeFileSync(path.join(this.work, `${name}.pid`), String(child.pid))
    child.on("exit", () => { if (this.owned.get(name) === child) this.owned.delete(name) })
    return child
  }

  async startBackend() {
    if (this.owned.has("backend")) return
    this.spawnOwned("backend", this.python, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(API_PORT)], { cwd: this.backendRoot, env: this.backendEnv() })
    await this.waitUrl(`http://127.0.0.1:${API_PORT}/health`, "backend")
  }

  async startFrontend() {
    if (this.owned.has("frontend")) return
    const env = { ...process.env }
    delete env.VITE_API_BASE_URL // the frontend must read the committed .env.demo, not an override
    this.spawnOwned("frontend", process.execPath, [path.join(this.root, "node_modules", "vite", "bin", "vite.js"), "--mode", "demo", "--port", String(WEB_PORT), "--strictPort"], { cwd: this.root, env })
    await this.waitUrl(WEB, "frontend")
  }

  async waitUrl(url, name, seconds = 90) {
    const end = Date.now() + seconds * 1000
    while (Date.now() < end) {
      try { const r = await fetch(url); if (r.ok) return } catch {}
      await sleep(400)
    }
    throw new Error(`${name} did not become ready at ${url}`)
  }

  async stop(name) {
    const child = this.owned.get(name)
    if (!child) return
    try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }) } catch {}
    this.owned.delete(name)
    await sleep(600)
  }

  async stopAll() {
    for (const name of [...this.owned.keys()]) await this.stop(name)
  }

  backendAlive() { return this.owned.has("backend") }

  // ---- API helper used for preconditions/assertions only (tokens stay in memory) ----
  async login(role) {
    const email = { admin: "admin@example.com", instructor: "instructor@example.com", student: "student@example.com" }[role]
    const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: this.secrets[role] }) })
    if (!r.ok) throw new Error(`API login failed for ${role}: ${r.status}`)
    return (await r.json()).data.access_token
  }
  async api(role, method, route, body) {
    this.tokens ??= {}
    this.tokens[role] ??= await this.login(role)
    const r = await fetch(`${API}${route}`, { method, headers: { Authorization: `Bearer ${this.tokens[role]}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { status: r.status, body: json }
  }
}
