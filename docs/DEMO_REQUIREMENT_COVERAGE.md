# Demo requirement coverage

Run documented here: `demo-output/mandatory/final-2/` (full video `mp4/99_complete_demo.mp4`, 464.13 s). Machine results are in that run's `verification.json`. Status words: **captured** = footage exists and the script's own assertions passed; **verified** = additionally checked by ffprobe and by a person viewing extracted frames. Only a subset of frames was viewed (see "Review limits").

## Section 24: mandatory live demonstration tasks

| # | Task | Chapter | Recorded evidence | Status |
| - | --- | --- | --- | --- |
| 1 | Start or verify the Lab I API | 02 | Terminal: `curl.exe -sS $API/health` returns the real health JSON; Swagger page `/api/docs` in a browser tab | captured; frames viewed |
| 2 | Start frontend, show API base URL | 02 | Terminal: `gc $R\.env.demo` (`VITE_API_BASE_URL=http://127.0.0.1:8200/api/v1`) and `gc frontend.log -Tail 7` (Vite output); frontend login screen on :3200 | captured; frames viewed |
| 3 | Invalid login error | 03 | Wrong password typed (masked), backend message "Invalid email or password" held on screen | captured; frame viewed |
| 4 | Login, show user/role | 03 | Admin sign-in, "Welcome, Elena Marquez" and Administrator badge | captured |
| 5 | Protected route | 03 | `/students` after sign-in; a separate signed-out tab opened on `/students` is redirected to `/login` | captured |
| 6 | Load Students | 04 | Student list from the backend (42 seeded students) | captured |
| 7 | Search via query parameter | 04 | Search "Santos"; terminal `sls "GET /students\?" requests.log` shows the real request lines | captured |
| 8 | Filters and pagination | 04 | Program + Year filters, then page 2 at 10 per page, with `total/page/last_page` metadata in the request log; filters cleared before pagination | captured |
| 9 | Create student, show backend record | 05 | Main student 2026-00150 created through the UI and linked to the Maya Reyes account; details dialog (fresh GET) shows the linked account; the script also confirms `user_id` through the API | captured |
| 10 | Backend validation error | 05 | Email `maya.reyes@school` passes the browser check but the backend returns 422; the field error "The part after the @-sign is not valid. It should have a period." is shown, then corrected | captured; frame viewed |
| 11 | Edit a student | 05 | Contact number edited; reopened details dialog shows the new value | captured |
| 12 | Deactivate with confirmation | 11 | Native confirm "Deactivate student 2026-00150 (#43)?"; row shows INACTIVE and still does after F5 | captured; frame viewed |
| 13 | Programs/Courses | 06 | Programs and Courses lists; new course IT210 Web Development created and visible | captured |
| 14 | Academic term and offering | 06 | Term 2026-2027 Second Semester created; offering WD-A created (course, term, instructor Daniel Ramos, schedule, room, capacity 35) and read back | captured; frame viewed |
| 15 | Enroll a student | 07 | Enrollment created from the student's workspace; reopened workspace shows IT210 / WD-A, ACTIVE, Not graded | captured |
| 16 | Encode/update a grade | 08 | Instructor tab: roster for WD-A, grade created 85.5 / 90.25, final corrected to 93.75, F5 reload keeps 93.75 | captured; frame viewed |
| 17 | Academic record (aggregate endpoint) | 09 | Student tab: My Enrollments, My Grades (no create/edit controls), Academic Record; terminal shows `GET /students/{id}/academic-record -> 200` from the Student session | captured |
| 18 | Restricted role / 403 | 10 | Student opens `/users` and sees Access denied; terminal runs `show-403.ps1` (real login as Student, request to `/users`, prints HTTP 403 and the body; token never printed) | captured |
| 19 | Backend outage | 12 | `taskkill` of the runner-owned backend, `curl` fails to connect, UI shows "The backend is unreachable", same backend restarted on the same DB, "Try again" recovers | captured; frame viewed |
| 20 | Responsive + architecture + AI workflow | 13 | 540 px wide window (drawer navigation, table, create form), desktop restored; cards for routing/API service, authentication, data refresh and AI workflow (each checked against the source before rendering); source views of `router.tsx`, `apiRequest` and `require_roles`; AI Development Log excerpt | captured; frames viewed |

## Section 25: minimum acceptance criteria

Implementation evidence is separate from what the video shows. The video does not prove the unit tests or build.

| Criterion | Implementation evidence | Shown in the video |
| --- | --- | --- |
| Frontend starts without critical errors | Vite starts under `--mode demo` | Chapter 02 shows Vite output; no console audit was recorded |
| Frontend and backend are separate apps | Separate repositories, ports 3200 / 8200, CORS | Chapter 02 |
| Real Lab I API used | All data comes from the demo database through the API | Throughout; request log excerpts |
| Authentication and protected navigation | `RequireAuth`, JWT in sessionStorage | Chapter 03 |
| Role-aware UI | Sidebar labels ("My Classes"), hidden controls | Chapters 08-10 |
| Student CRUD with real data | Resource pages and service layer | Chapters 05, 11 (no hard delete shown) |
| Programs, courses, terms, offerings, enrollments, grades, academic record represented | Routes in `router.tsx` | Chapters 06-09 (Enrollments list only for Student) |
| Search, filtering, pagination | Query parameters on `/students` | Chapter 04 |
| Backend validation messages displayed | Field errors from 422 | Chapter 05 |
| Loading, empty, network, unauthorized, forbidden, not-found states | Implemented in pages/`ErrorPage` | Network and forbidden only (chapters 10, 12); loading, empty, 401 redirect and 404 are not recorded as such |
| Desktop and narrow viewport | Responsive layout | Chapter 13 |
| No direct DB access / no secrets in client | Code review only | Not demonstrable on video |
| Documentation and test evidence | `docs/`, tests | The AI log is shown; test output only for the accessibility component tests (chapter 14) |

## Bonuses actually shown (chapter 14)

* Dark/light theme switch.
* Query invalidation: a student's year level is edited and the list row updates without a manual reload.
* Component accessibility tests: `accessibility.test.tsx` (9 tests) output from the preflight run, shown from `a11y-tests.log`. These are limited component tests, not an accessibility audit.

## Known limitations and unverified items

* The pipeline passed its own assertions; I did not play the entire final video. Cursor naturalness, pacing and absence of any exposed secret were checked only through the extracted frames listed below.
* Chapters 02, 04, 05, 06, 12 and 13 are longer than the proposed per-chapter budgets; the whole video is still under 480 s (464.13 s).
* Chapter 13 shows no source view for token storage or for query invalidation (cards only); the claims were verified against the source files by regex, not by on-screen code.
* The terminal window is drawn slightly offset (its frame shows a strip of Chrome behind it).
* The terminal is a real PowerShell, but the commands are typed by automation. The command output is genuine.
* Request evidence is a log written by the Playwright network listener, not DevTools.
* Test and lint suites other than the accessibility test were not run for this recording.
* The recording supports the faculty demonstration; it does not replace the live technical defense or requested modifications.

## Review limits

Frames viewed by a person (me) in `final-2`: chapter 03 (invalid login), 05 (backend validation), 06 (offering), 08 (roster), 11 (confirmation), 12 (outage), 13 (narrow layout, source view), and chapter 02/12 terminal frames from earlier rehearsal runs. The remaining extracted frames were produced but not individually inspected.
