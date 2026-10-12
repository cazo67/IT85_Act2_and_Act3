// Builds numbered chapter MP4s (cards + real footage) into <run>/mp4, assembles 99_complete_demo.mp4, and verifies everything.
// Usage: node export-mandatory.mjs --run <runDir>
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const runDir = argv[argv.indexOf("--run") + 1]
if (!runDir) throw new Error("--run <runDir> is required")
const scenario = JSON.parse(readFileSync(path.join(here, "scenario.json"), "utf8"))
const state = JSON.parse(readFileSync(path.join(runDir, "run-state.json"), "utf8"))
const mp4Dir = path.join(runDir, "mp4")
const framesDir = path.join(runDir, "frames")
const logsDir = path.join(runDir, "logs")
for (const d of [mp4Dir, framesDir, logsDir]) mkdirSync(d, { recursive: true })

const ffmpeg = (args) => { const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { encoding: "utf8" }); if (r.status !== 0) throw new Error("ffmpeg failed: " + r.stderr) }
const probe = (file) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames:format=duration", "-of", "json", file], { encoding: "utf8" }))

function buildChapter(chapter, record) {
  const out = path.join(mp4Dir, chapter.file)
  const inputs = []
  const filters = []
  record.segments.forEach((seg, i) => {
    if (seg.type === "card") inputs.push("-loop", "1", "-framerate", "30", "-t", String(seg.seconds), "-i", seg.file)
    else inputs.push("-ss", seg.start.toFixed(3), "-t", (seg.end - seg.start).toFixed(3), "-i", seg.file)
    filters.push(`[${i}:v]fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:white,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v${i}]`)
  })
  const n = record.segments.length
  filters.push(`${record.segments.map((_, i) => `[v${i}]`).join("")}concat=n=${n}:v=1:a=0[out]`)
  ffmpeg([...inputs, "-filter_complex", filters.join(";"), "-map", "[out]", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", "30", "-fps_mode", "cfr", "-an", "-movflags", "+faststart", out])
  return out
}

function check(file) {
  const p = probe(file)
  const v = p.streams.find((s) => s.codec_type === "video")
  const duration = Number(p.format.duration)
  const checks = {
    h264: v.codec_name === "h264", yuv420p: v.pix_fmt === "yuv420p", size_1920x1080: v.width === 1920 && v.height === 1080,
    constant_30fps: v.r_frame_rate === "30/1" && v.avg_frame_rate === "30/1", no_audio: !p.streams.some((s) => s.codec_type === "audio"), playable_duration: duration > 1,
  }
  return { file: path.basename(file), duration, checks, ok: Object.values(checks).every(Boolean) }
}

const missing = scenario.chapters.filter((c) => state.chapters[c.id]?.status !== "captured")
if (missing.length) {
  console.error("Cannot assemble: chapters not captured: " + missing.map((c) => c.id).join(", "))
  writeFileSync(path.join(runDir, "verification.json"), JSON.stringify({ complete: false, reason: "chapters not captured", missing: missing.map((c) => ({ id: c.id, status: state.chapters[c.id]?.status ?? "not run", error: state.chapters[c.id]?.error })) }, null, 2))
  process.exit(2)
}

const results = []
for (const chapter of scenario.chapters) {
  const rec = state.chapters[chapter.id]
  const out = buildChapter(chapter, rec)
  const r = check(out)
  results.push({ id: chapter.id, title: chapter.title, tasks: chapter.tasks, ...r, evidence: rec.evidence })
  console.log(`${chapter.file}  ${r.duration.toFixed(1)}s  ${r.ok ? "OK" : "FAIL"}`)
}

// Assemble the full video from the verified chapter MP4s (stream copy; every chapter once, in order).
const listFile = path.join(logsDir, "concat.txt")
writeFileSync(listFile, scenario.chapters.map((c) => `file '${path.join(mp4Dir, c.file).replace(/\\/g, "/")}'`).join("\n"))
const full = path.join(mp4Dir, "99_complete_demo.mp4")
ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", full])
const fullCheck = check(full)
const chapterSum = results.reduce((a, r) => a + r.duration, 0)

// Frames: inside every chapter and on both sides of every chapter boundary / tab or role transition.
let offset = 0
const frames = []
for (const r of results) {
  const picks = [0.4, r.duration / 2, r.duration - 0.4]
  for (const t of picks) {
    const name = `chapter-${r.id}-t${t.toFixed(1)}s.png`
    ffmpeg(["-ss", t.toFixed(3), "-i", path.join(mp4Dir, scenario.chapters.find((c) => c.id === r.id).file), "-frames:v", "1", path.join(framesDir, name)])
    frames.push(name)
  }
  r.startsAt = +offset.toFixed(2)
  offset += r.duration
}
for (const t of [3, 20, 60, 120, 180, 240, 300, 360, 420, 470]) if (t < fullCheck.duration) { ffmpeg(["-ss", String(t), "-i", full, "-frames:v", "1", path.join(framesDir, `full-t${t}s.png`)]); frames.push(`full-t${t}s.png`) }

const mandatoryTasks = Array.from({ length: 20 }, (_, i) => i + 1)
const coverage = mandatoryTasks.map((task) => ({ task, chapters: results.filter((r) => r.tasks.includes(task)).map((r) => r.id), evidence: results.filter((r) => r.tasks.includes(task)).flatMap((r) => r.evidence.filter((e) => e.task === task).map((e) => e.text)) }))
const report = {
  complete: results.every((r) => r.ok) && fullCheck.ok && fullCheck.duration < 480 && coverage.every((c) => c.evidence.length > 0),
  generatedAt: new Date().toISOString(),
  fullVideo: { ...fullCheck, strictlyUnder480s: fullCheck.duration < 480 },
  chapterDurationSum: +chapterSum.toFixed(2),
  fullMatchesChapterSum: Math.abs(chapterSum - fullCheck.duration) < 0.5,
  chapters: results, coverage, frames,
  note: "Automated checks only. A human must still watch the full video: cursor naturalness, readability and secret exposure are reviewed visually.",
}
writeFileSync(path.join(runDir, "verification.json"), JSON.stringify(report, null, 2))
console.log(`99_complete_demo.mp4  ${fullCheck.duration.toFixed(2)}s  (sum of chapters ${chapterSum.toFixed(2)}s)  under480=${fullCheck.duration < 480}  complete=${report.complete}`)
process.exit(report.complete ? 0 : 3)
