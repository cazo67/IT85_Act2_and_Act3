# Lab 03: under-four-minute system demonstration

> **Recorded video (separate from this live script).** A silent, automated desktop recording of the mandatory demonstration is produced by one command:
>
> ```powershell
> powershell -NoProfile -ExecutionPolicy Bypass -File scripts/demo/run-mandatory.ps1
> ```
>
> It builds a disposable demo database, runs 15 chapters in order (about 7 min 44 s), and writes numbered MP4s plus `99_complete_demo.mp4` to `demo-output/mandatory/<run-id>/mp4/`. See [DEMO_IMPLEMENTATION_PLAN.md](DEMO_IMPLEMENTATION_PLAN.md) and [DEMO_REQUIREMENT_COVERAGE.md](DEMO_REQUIREMENT_COVERAGE.md). The video does not replace the live defense; the live script below is still the one to present.

**Target: 3 minutes 40 seconds, with 20 seconds spare.**

Demonstrate one connected story: **registrar enrolls a student -> assigned instructor records a grade -> student sees the same result.** This gives stronger end-to-end evidence than quickly opening every module.

Read the quoted lines aloud while doing the numbered actions. Preparation is outside the presentation timer.

## Prepare before presenting

1. Start both servers using the [README instructions](../README.md#run-the-frontend-and-backend). Lab 03 is the React frontend; Lab 02 runs the API and database. Open `http://localhost:3000`.
2. Have working **Admin, Instructor, and Student** accounts ready. Use your existing demo credentials; keep passwords out of this file and off the projected screen.
3. As Admin, confirm the Student account is linked to the student record you will demonstrate. In **Students -> target row -> Edit**, check **Linked student account**. An unlinked account cannot display that student's academic record.
4. Prepare one new course offering in **Course Offerings -> Create course offering**:

   | Field | Preparation value |
   | --- | --- |
   | Course | An existing active course; note its code |
   | Academic term | An existing active term |
   | Instructor | The instructor whose account you will use |
   | Section | A distinctive unused name, such as `DEMO-OCT11-A` |
   | Schedule | `MWF 10:00-11:00` |
   | Room | `Demo Lab` |
   | Capacity | `10` |
   | Status | `ACTIVE` |

5. Leave the chosen student **not enrolled in this new offering**. You will create that enrollment live. The new enrollment should have no grade yet.
6. Write down these cues on a private note: student number, student name, course code, section, and the three account emails. Use the same student and section throughout.
7. Rehearse the navigation once with a separate practice offering. For another rehearsal or presentation, use a fresh section so enrollment creation does not hit a duplicate and the grade action still says **Create grade**.
8. Finish preparation signed out at the login screen. Close unrelated tabs and keep the browser at a readable size.

The existing seed-based tests use names such as Demo Student and Instructor One, but your database may differ. Select the actual linked student and assigned instructor in your running system; do not assume database IDs.

## Live script and navigation

### 0:00-0:25 | Sign in and establish the purpose

**Do:** Enter the Admin account's **Email** and **Password**, then click **Sign in**. Briefly point to the dashboard and Administrator badge.

**Say:**

> "This is our Student Information Management System. Lab 03 provides the interface, connected to the Lab 02 API and database. I'll demonstrate one complete workflow: student enrollment, instructor grading, and the student's academic record."

**Expected:** Dashboard loads with your account name, role badge, and record totals rather than loading placeholders or errors.

**What it demonstrates:** Successful authentication and retrieval of role-appropriate API data. Dashboard totals alone do not demonstrate every module's write operations.

### 0:25-1:15 | Enroll the student as Admin

**Do:**

1. Sidebar **Students** -> search the chosen student number.
2. On that row, click **View** -> **Open student workspace**.
3. Click **Enroll in a class**.
4. Confirm **Student** is already selected. Choose your prepared section under **Course offering** and keep **Status = ACTIVE**. If you leave the optional enrollment date blank, use the system's default.
5. Click **Create enrollment**. Wait for the dialog to close and the success feedback.
6. Open **Students -> View -> Open student workspace** again for that same student. Point to the new course and section with `ACTIVE` and `Not graded`.

**Say:**

> "I find the student's record and enroll them in this prepared class. The student is already selected from the workspace. This connects the student to a course offering, which contains the course, academic term, instructor, and class details. The enrollment is active, and no grade has been entered yet."

**Expected:** The new course/section appears under its academic term, with an active enrollment and no grade.

**What it demonstrates:** Student lookup, contextual form defaults, enrollment creation, and reading the saved enrollment through the student workspace. Existing catalog and class data participate in the relationship; their creation was prepared beforehand.

### 1:15-2:25 | Record and correct the grade as Instructor

**Do:**

1. Click **Sign out**; sign in as the assigned Instructor.
2. Sidebar **My Classes** -> prepared section's **View** -> **Open class roster**.
3. Find your student's row; use **Search roster** if needed. Point to the student's number and active enrollment.
4. Click that student's **Create grade**. Confirm the dialog identifies the correct student, course, section, and enrollment.
5. Enter **Midterm grade = 85.5**, **Final grade = 90.25**, **Remarks = Demo result**. Click **Create grade**.
6. Click **Edit grade** on the same row. Change **Final grade** to **93.75**, then click **Save changes**.
7. Reload the browser page. Point to the final grade still showing `93.75`.

**Say:**

> "The assigned instructor can now see the student in the class roster. Grade entry is tied to this student's enrollment. I save a grade, correct the final mark, and reload. The corrected value remains, showing that the change survives a fresh read from the backend."

**Expected:** The student appears in the instructor's class roster. After saving, `85.5` and `93.75` remain visible after reload.

**What it demonstrates:** Cross-role visibility of the new enrollment, class-to-student relationships, contextual grade creation, grade editing, and persistence after reload.

### 2:25-3:15 | Verify the same result as Student

**Do:**

1. **Sign out**; sign in as the linked Student.
2. Sidebar **My Grades**. Locate the matching course/section and point to `85.5`, `93.75`, and `Demo result`.
3. Sidebar **Academic Record**. Point to the student's name, the academic term, and the same course with the same marks.
4. Point out that the Student has no grade **Edit** or **Create** controls.

**Say:**

> "Using the student's own account, the same saved marks appear in My Grades and in the term-grouped academic record. This completes the workflow from enrollment to grading to student viewing. The student can review the result without grade-editing controls."

**Expected:** Both views show the saved marks for the same course and student. Academic Record selects the linked student's record automatically.

**What it demonstrates:** The saved result is available to a separate authorized account and to the academic-record view. The absence of editing controls demonstrates the Student interface restriction.

### 3:15-3:40 | Show a permission boundary and close

**Do:** While still signed in as Student, enter `http://localhost:3000/users` in the address bar. After showing the result, use **Return to dashboard**.

**Say:**

> "A student also cannot open account administration through a direct URL. In this demo, we created an enrollment, recorded and corrected a grade, verified persistence after reload, and retrieved the same result through the student's account. That is our complete connected workflow."

**Expected:** **Access denied** appears instead of the Users page.

**What it demonstrates:** A protected frontend route. Backend permission enforcement is covered separately by API permission tests; this screen alone does not prove every backend authorization rule.

## Quick cue card

| Time | Role | Navigation / action | Visible checkpoint |
| --- | --- | --- | --- |
| 0:00 | Admin | Sign in -> Dashboard | Administrator badge and loaded totals |
| 0:25 | Admin | Students -> search -> View -> Open student workspace -> Enroll in a class | Correct student preselected |
| Before 1:15 | Admin | Create enrollment -> reopen student workspace | Prepared section, ACTIVE, Not graded |
| 1:15 | Instructor | Sign in -> My Classes -> View -> Open class roster | Same student in roster |
| Before 2:25 | Instructor | Create grade -> Edit grade -> reload | Midterm 85.5, final 93.75 |
| 2:25 | Student | Sign in -> My Grades -> Academic Record | Same marks, correct student and term |
| 3:15 | Student | Open `/users` directly | Access denied |
| 3:40 | End | Finish | 20 seconds spare |

## How one workflow covers several features

| Live action | Supporting features exercised | Scope of the evidence |
| --- | --- | --- |
| Sign in with three roles | Authentication, session transitions, role-aware navigation | Successful sign-in and role changes |
| Find student and enroll | Student search, workspace navigation, prefilled student, offering selection, enrollment save | One successful enrollment and subsequent read |
| Use the prepared offering | Course, term, instructor assignment, schedule, room, capacity data | Their saved relationships are used; catalog CRUD and capacity rejection are not demonstrated |
| Open instructor roster | Instructor class access, enrollment-to-student lookup | The assigned instructor can see the new enrollment |
| Create/edit grade and reload | Grade form context, create/update API calls, refreshed data | The saved correction survives reload |
| View student results | Account-to-student linking, grades, term-grouped academic history | A separate Student account retrieves the same saved result |
| Student opens `/users` | Protected navigation and role restriction | Frontend route access is denied |

Use this phrasing if asked why you did not open every screen:

> "Rather than repeat similar forms for every module, I demonstrated a connected transaction that uses the student, course, term, offering, enrollment, and grade relationships across three roles. Separate tests cover additional cases."

## If you are running out of time

- Skip the **Edit grade** correction. Create the grade with final `93.75` immediately, then reload. Say "recorded a grade" instead of "recorded and corrected a grade" in the closing line.
- Keep the reload and the Student Academic Record check: they are the clearest persistence and cross-role checkpoints.
- If needed, show **Academic Record** directly after Student sign-in and skip **My Grades**.
- Keep account creation, catalog CRUD, duplicate/capacity errors, deletion, theme switching, mobile layouts, and network recovery for questions after the timed demo.

## If something differs during rehearsal

| Symptom | Check before presenting |
| --- | --- |
| Duplicate enrollment rejected | Use a fresh prepared offering; the student is already enrolled in the selected one |
| Student absent from instructor roster | Confirm the offering's assigned instructor and the selected student's enrollment; use Refresh or reload |
| Button says Edit grade already | That enrollment already has a grade; use a fresh offering for the create-then-edit script |
| Student sees no linked record | Have Admin verify the account link in the student editor |
| Student sees old values | Confirm the save completed and reload the Student view; verify the course and section match |
| Backend error or loading never completes | Check both terminals and the API base URL using the README; resolve before starting the timer |
| Row is hard to find | Clear old filters, use student search, or adjust pagination; keep the demo class easy to identify |

## Evidence and limits

This guide was composed from the current routes, navigation labels, workspace components, forms, and cross-role E2E scenarios. It was not executed against your normal database while writing this document. Rehearse with your actual accounts before presenting; the expected outputs above are checkpoints to confirm.

The repository's [Phase 3 follow-up validation](PHASE_3_FOLLOW_UP_VALIDATION.md) records an earlier successful isolated run of 24 E2E scenarios, 57 frontend tests, and 21 backend tests. Those are recorded results, not a new test run for this guide. Relevant scenarios are in [connected workflows](../e2e/phase-two/connected-workflows.spec.ts), [cross-role academic workflows](../e2e/cross-role/academic-workflows.spec.ts), and [role permissions](../e2e/permissions/role-permissions.spec.ts).

Do not claim this short demo proves all validation failures, all CRUD operations, all security rules, or every accessibility/device scenario. It demonstrates one complete successful academic workflow with persistence and a visible permission boundary. The current workflow does not include grade publication/approval, GPA calculation, or report export.
