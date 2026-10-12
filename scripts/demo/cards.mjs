// Renders plain white explanatory cards (dark text) to 1920x1080 PNGs. Cards introduce steps; they never replace evidence.
import { chromium } from "@playwright/test"
import path from "node:path"

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")

function html(card, heading) {
  const [first, ...rest] = card.lines
  const big = card.style === "title"
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;width:1920px;height:1080px;background:#fff;color:#111827;font-family:"Segoe UI",Arial,sans-serif}
    .w{height:1080px;display:flex;flex-direction:column;justify-content:center;padding:0 200px;box-sizing:border-box}
    .k{font-size:30px;color:#4b5563;margin-bottom:26px;letter-spacing:.04em}
    h1{margin:0 0 34px;font-size:${big ? 76 : 62}px;line-height:1.15;font-weight:600}
    p{margin:0 0 20px;font-size:${big ? 44 : 38}px;line-height:1.35;color:#1f2937}
  </style><div class="w">${heading ? `<div class="k">${esc(heading)}</div>` : ""}<h1>${esc(first)}</h1>${rest.map((l) => `<p>${esc(l)}</p>`).join("")}</div>`
}

export async function renderCards(jobs) {
  // jobs: [{ card, heading, file }]
  const browser = await chromium.launch({ channel: "chrome", headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
    for (const job of jobs) {
      await page.setContent(html(job.card, job.heading))
      await page.screenshot({ path: job.file })
    }
  } finally { await browser.close() }
}

export const cardPath = (dir, id, n) => path.join(dir, `card-${id}-${n}.png`)
