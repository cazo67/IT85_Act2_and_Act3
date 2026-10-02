# API Integration Map

Base URL: `VITE_API_BASE_URL` (example: `http://127.0.0.1:8000/api/v1`). Protected calls use `Authorization: Bearer <token>`.

| Frontend feature | Method | REST endpoint | Backend permission |
|---|---|---|---|
| Login / logout / profile | POST / POST / GET | `/auth/login`, `/auth/logout`, `/auth/me` | Public login; otherwise authenticated |
| Students | GET / POST | `/students` | Scoped read; ADMIN/STAFF create |
| Student detail | GET / PATCH / DELETE | `/students/{id}` | Scoped read; A/S edit; A delete |
| Programs | GET / POST | `/programs` | All read; A/S create |
| Program detail | GET / PATCH / DELETE | `/programs/{id}` | All read; A/S edit; A delete |
| Courses | GET / POST | `/courses` | All read; A/S create |
| Course detail | GET / PATCH / DELETE | `/courses/{id}` | All read; A/S edit; A delete |
| Academic terms | GET / POST | `/academic-terms` | All read; A/S create |
| Term detail | GET / PATCH / DELETE | `/academic-terms/{id}` | All read; A/S edit; A delete |
| Offerings | GET / POST | `/course-offerings` | Scoped read; A/S create |
| Offering detail | GET / PATCH / DELETE | `/course-offerings/{id}` | Scoped read; A/S edit; A delete |
| Offering roster | GET | `/course-offerings/{id}/students` | A/S or assigned instructor |
| Enrollments | GET / POST | `/enrollments` | Scoped read; A/S create |
| Enrollment detail | GET / PATCH / DELETE | `/enrollments/{id}` | Scoped read; A/S edit/delete |
| Student enrollments | GET | `/students/{id}/enrollments` | Object-scoped |
| Grades | GET / POST | `/grades` | Scoped read; A/S/assigned I create |
| Grade detail | GET / PATCH | `/grades/{id}` | Scoped read; A/S/assigned I edit |
| Student grades | GET | `/students/{id}/grades` | Object-scoped |
| Academic record | GET | `/students/{id}/academic-record` | A/S any, I assigned, Student own |

Success: `{ success, message, data, meta? }`. Error: `{ success: false, message, errors }`. Pagination: `{ page, per_page, total, last_page }`. Deletes return 204 without JSON.
