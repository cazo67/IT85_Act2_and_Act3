# Demo implementation plan (mandatory demonstration recording)

Scope: a silent, desktop-recorded demonstration of the Lab 03 React frontend running against the real Lab I FastAPI backend. It supports the faculty demonstration; it does not replace the live technical defense.

## Inspected facts

| Area | Finding |
| --- | --- |
| Stack | React 19, Vite 8, React Router 7, TanStack Query; sibling FastAPI + SQLite backend in `..\lab-02-student-api` (Alembic migrations, `python -m app.seed`). |
| Auth | `POST /auth/login` returns a JWT; the client keeps it in `sessionStorage` (per tab) and sends `Authorization: Bearer`. Roles are enforced by `require_roles` in the backend. |
| Requirements source | Laboratory Activity II PDF: section 24 (20 live tasks), section 25 (acceptance criteria), section 28 (bonuses). |
| Backend validation case | `student.email = "maya.reyes@school"` passes the browser's `type=email` check but is rejected by the backend (`422`, "The part after the @-sign is not valid. It should have a period."). Checked by a preflight API call that creates no record. |
| Deactivation | The Students page uses a native `window.confirm`, then `PATCH status=INACTIVE`. |
| Outage state | Failed list loads show "The backend is unreachable..." with a "Try again" button. |

## Approach

* **Real desktop capture.** `ffmpeg gdigrab` at 30 fps records the 1920x1080 primary display, including the visible Chrome window (tabs, address bar), a real console window and the real OS cursor.
* **Headed Playwright + OS input.** Playwright launches Chrome and holds three pre-authenticated tabs (Admin, Student, Instructor). Clicks, wheel scrolling, dropdown choices and tab switches go through the real mouse and keyboard (`desktop-helper.ps1`). Typing into fields is 80-120 ms per character. Cursor paths are bezier curves with varying speed, occasional overshoot and correction, and seeded (reproducible) randomness. This is automation; it is not manual operation.
* **Isolation.** Each role is a separate tab with its own `sessionStorage`. Before recording, the runner logs each role in, checks the displayed name and badge, and asserts the three tokens differ. A fourth signed-out tab shows the protected-route redirect.
* **Disposable data.** One SQLite database per run is built with the real Alembic migrations and `scripts/demo/seed_demo.py`. Normal databases are never touched. Per-run passwords are random and live only in `<run>/work/secrets.json` (git-ignored, never printed, never typed on screen except as masked dots).
* **State and retries.** A checkpoint (SQLite online backup) is taken after every captured chapter. A failed chapter restores the previous checkpoint (backend stopped first) and retries once.
* **Evidence views.** Request parameters and response metadata come from a real log written by the Playwright network listener (no tokens). The terminal runs real commands at a real prompt (`sls`, `curl.exe`, `gc`, `taskkill`).
* **Outage.** The runner-owned backend process is killed from the terminal, the UI shows its error, the same backend and database are restarted, and "Try again" recovers. A `finally` block restarts the backend if a chapter fails.
* **Cards.** Plain white cards (rendered HTML) only introduce steps or summarise architecture; each architecture card is checked against the real source before rendering.

## Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/demo/run-mandatory.ps1
```

Options: `-RunId <id>` (reuse a run), `-From 08` (resume, restoring the previous checkpoint), `-Only 05,06` (retry), `-ExportOnly`.

The recording uses the real screen: leave the mouse and keyboard alone until it ends.

## Output layout (`demo-output/mandatory/<run-id>/`)

`mp4/` (all MP4s only), `raw/` (MKV intermediates), `cards/`, `frames/`, `logs/`, `work/` (database, logs, request log, secrets), `checkpoints/`, `manifest.json`, `preflight.json`, `run-state.json`, `verification.json`.

## Batch table

See [DEMO_REQUIREMENT_COVERAGE.md](DEMO_REQUIREMENT_COVERAGE.md) for the mapping of every section-24 task and section-25 criterion to chapters and evidence.
