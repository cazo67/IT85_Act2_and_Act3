# Playwright QA Matrix

The suite exercises the real Lab 03 UI against the real Lab 02 application code on an isolated, freshly migrated and seeded SQLite database. It does not use the normal Lab 02 database.

| Feature | Acting role | CRUD covered | Other role checked | Expected reflection |
|---|---|---|---|---|
| Authentication/session | All seeded roles | Login, refresh, logout | N/A | Valid sessions survive refresh; revoked sessions cannot be reused |
| Programs | Admin | Create, read, update, delete | Student | Public catalog changes appear after login/refresh and disappear after deletion |
| Courses | Admin | Create, read, update, delete | Student | Public catalog changes appear after login/refresh and disappear after deletion |
| Academic terms | Admin | Create, read, update, delete | Student | Public term changes appear after login/refresh and disappear after deletion |
| Students | Admin and Staff | Create, read, update, deactivate, delete | Staff and Student | Staff sees authorized changes; an unlinked student cannot see another student record |
| Course offerings | Admin | Create, read, update, delete | Assigned Instructor and Student | Instructor sees assigned offering; Student sees it only after enrollment |
| Enrollments | Admin | Create, read, update, delete | Instructor and Student | Assigned Instructor and enrolled Student see status changes and final deletion |
| Grades | Instructor | Read and update | Student | Updated grade persists and appears in Student Grades and Academic Record |
| Role enforcement | Student, Staff, Instructor | Unauthorized create/update attempts | N/A | UI hides unavailable actions and backend returns 403 |

## Intentional exclusions

- User management has backend endpoints but no Lab 03 page, so it is checked only as a permission boundary and not treated as UI CRUD.
- Grades have no delete endpoint or UI delete action; deletion is therefore not a supported lifecycle step.
- Visual animation and minor styling are outside this major-workflow suite.
- All generated records use an `E2E_TEST_` prefix. The database is disposable, and tests also clean up their records when practical.
