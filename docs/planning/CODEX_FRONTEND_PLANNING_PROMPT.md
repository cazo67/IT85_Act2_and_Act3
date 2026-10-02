# CODEX_FRONTEND_PLANNING_PROMPT.md

> **Historical document:** This prompt describes the earlier nested
> `frontend/` and duplicate `backend/` layout. The current Laboratory 3 project
> is a frontend-only application at the repository root; Laboratory 2 is the
> separate backend.

> Purpose: Give this file to Codex inside the current Laboratory 3 frontend project.
>
> Important: This is a planning prompt only. Codex must inspect the real project first and then produce a detailed implementation plan. It must not implement the frontend yet.

# ROLE

Act as a senior frontend engineer and UI/UX-focused technical planner.

You are working inside an existing Laboratory 3 frontend project for a Student Information Management System.

The frontend must integrate with the already-existing REST API from Laboratory 2.

The project was initialized using:

```bash
npx shadcn@latest init --preset b2D0xPXaU --base radix --template vite --pointer
```

Treat the existing shadcn setup, theme, generated configuration, and installed components as the design-system foundation. Do not replace the shadcn setup unless the current project is clearly broken.

# PRIMARY TASK

Inspect the current project thoroughly and create one implementation plan named:

```text
FRONTEND_IMPLEMENTATION_PLAN.md
```

Do not implement features yet.

The plan must be based on the actual current project, not assumptions.

Before writing the plan, inspect:

- current folder/file structure;
- package.json;
- current dependencies;
- Vite configuration;
- TypeScript configuration;
- Tailwind/shadcn configuration;
- components.json;
- existing src files;
- routing setup, if any;
- current pages/components;
- existing API utilities;
- environment files;
- existing styles/theme;
- Git status;
- README or project notes;
- any OpenAPI/Swagger/Postman/API documentation present;
- any existing authentication code;
- any existing tests.

If the Laboratory 2 backend is present in a sibling folder or monorepo, inspect only what is necessary to understand the API contract. Do not modify the backend while planning Laboratory 3.

# PROJECT GOAL

The final Laboratory 3 project must be a pure frontend application that communicates with the existing Student Information Management REST API.

The frontend must not:

- create a replacement backend;
- connect directly to the database;
- use hardcoded/static data for core system functions;
- duplicate backend authorization rules;
- embed backend secrets;
- bypass the existing REST API.

The backend remains authoritative for authentication, authorization, validation, business rules, and database records.

The frontend is responsible for usable presentation, navigation, forms, API consumption, loading/error feedback, responsive behavior, role-aware interface behavior, and accessible interaction.

# DESIGN OBJECTIVE

The interface must be user-centric, clean, professional, responsive, and easy to navigate.

Use shadcn/ui components as the main component system.

Do not create custom UI primitives when an appropriate shadcn component already exists.

Prefer shadcn components such as:

- Sidebar
- Button
- Card
- Input
- Textarea
- Select
- Combobox
- Command
- Table / Data Table patterns
- Dialog
- AlertDialog
- Drawer
- Sheet
- Dropdown Menu
- Tabs
- Badge
- Avatar
- Breadcrumb
- Pagination
- Skeleton
- Alert
- Tooltip
- Popover
- Calendar / Date Picker
- Form
- Sonner / toast
- Separator
- Scroll Area

Use Lucide icons consistently where icons improve recognition.

Avoid unnecessary gradients, glass effects, excessive animation, too many colors, duplicated navigation, hidden critical actions, and long unstructured forms.

Prioritize:
1. clarity;
2. hierarchy;
3. predictable navigation;
4. readable tables;
5. efficient forms;
6. meaningful feedback;
7. responsive layouts;
8. accessibility;
9. consistency.

# USER-CENTRIC NAVIGATION

The plan must propose navigation that works on desktop and mobile.

Preferred desktop direction:
- persistent left sidebar;
- compact top header;
- page title + breadcrumb;
- clear content spacing;
- primary page action near the title;
- search/filters close to the related table.

Preferred mobile direction:
- sidebar becomes a Sheet/drawer;
- critical actions remain reachable;
- tables adapt using horizontal scrolling, condensed columns, or mobile cards where appropriate;
- filters can collapse into a Sheet/Popover;
- dialogs/forms remain usable on narrow screens.

Do not simply shrink the desktop UI.

The plan must explain how navigation changes by role.

# REQUIRED USER ROLES

Expected roles:
- Administrator
- Registrar / Staff
- Instructor
- Student

Do not invent permissions that the backend does not grant.

Expected role-aware UX:

Administrator:
- authorized system-management functions.

Registrar / Staff:
- student, program, course, academic-term, course-offering, enrollment, and other permitted academic management functions.

Instructor:
- assigned course offerings, enrolled students, and authorized grade workflows.

Student:
- own profile;
- own enrollments;
- own grades;
- own academic record.

Important: hiding a menu item or button is only a UX feature. The backend remains the security boundary. The plan must include handling for backend 401 and 403 responses.

# REQUIRED FRONTEND MODULES

The plan must account for:
1. Authentication
2. Dashboard
3. Students
4. Programs
5. Courses
6. Academic Terms
7. Course Offerings
8. Enrollments
9. Grades
10. Academic Record
11. Profile / Account

Do not assume all roles see all modules.

# REQUIRED FUNCTIONALITY

Authentication:
- login;
- logout;
- current-user request;
- authenticated state;
- protected routes;
- expired/invalid sessions;
- 401 handling;
- 403 handling;
- role-aware navigation.

Students:
- list;
- search;
- at least two supported filters;
- sorting when supported;
- backend pagination;
- view details;
- create;
- edit;
- delete/deactivate;
- confirmation before destructive actions;
- backend validation messages.

Programs:
- list;
- authorized create/edit/delete/deactivate;
- loading/error/empty states.

Courses:
- list;
- code;
- title;
- units;
- status;
- authorized CRUD.

Academic Terms:
- academic year;
- semester/term;
- dates;
- status;
- authorized CRUD.

Course Offerings:
- course;
- academic term;
- instructor;
- section;
- schedule;
- capacity;
- status;
- authorized management.

Enrollments:
- enroll a student;
- list enrollments;
- update status if supported;
- display duplicate/conflict feedback.

Grades:
- authorized grade entry/update;
- validation feedback;
- restricted-role handling.

Academic Record:
- consume the aggregate endpoint;
- present readable information grouped by academic term.

Profile:
- authenticated user information;
- role;
- available account details.

# API INTEGRATION REQUIREMENTS

The plan must propose a centralized API layer.

Do not scatter raw fetch calls or repeated endpoint strings across components.

Use the project's current approach if already established.

If no approach exists, plan something similar to:

```text
src/
  lib/
    api/
      client.ts
      errors.ts
  services/
    auth.ts
    students.ts
    programs.ts
    courses.ts
    academic-terms.ts
    course-offerings.ts
    enrollments.ts
    grades.ts
    academic-record.ts
```

Adapt the final structure after inspecting the real project.

The API layer must handle:
- central base URL;
- auth headers/credentials;
- response parsing;
- common error normalization;
- 401;
- 403;
- 404;
- 409;
- 422;
- 500+;
- network/unreachable backend;
- cancellation/stale requests where useful.

Use the actual backend response shape. Do not invent a frontend data model that conflicts with the backend.

# ENVIRONMENT CONFIGURATION

The API URL must come from environment configuration.

For Vite, prefer:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Create or preserve `.env.example`.

Do not place database passwords, JWT signing secrets, backend private keys, or service-account secrets in frontend code.

The plan must include CORS verification if frontend and backend use different origins.

# STATE AND DATA MANAGEMENT

Inspect existing dependencies first.

Do not add a state-management library automatically.

Prefer the simplest solution that fits the project.

The plan must distinguish:

Server/API state:
- students;
- programs;
- courses;
- terms;
- offerings;
- enrollments;
- grades;
- profile/current user.

Local UI state:
- dialog open/closed;
- search input;
- filters;
- active tab;
- confirmation state.

Avoid duplicating the same server record across disconnected stores.

After create/update/delete, plan a refetch, invalidation, or safe cache update strategy.

Do not treat localStorage/sessionStorage as the authoritative database.

# FORMS AND VALIDATION

Plan reusable, accessible forms using the existing project stack.

Use shadcn form components and existing form/validation libraries if present.

If no form strategy exists, recommend a simple compatible approach only after inspecting dependencies.

Forms must provide:
- labels;
- clear required fields;
- sensible grouping;
- concise helper text when useful;
- immediate basic client-side validation;
- backend validation display;
- preserved input after server errors;
- pending/disabled submission states;
- clear success/error feedback.

Client validation improves usability. Backend validation remains authoritative.

Map backend field errors such as 422 responses to the correct form controls.

# LOADING, EMPTY, SUCCESS, AND ERROR STATES

Every data-driven module must intentionally handle relevant states.

Loading:
- Skeletons;
- inline progress;
- disabled pending actions.

Empty:
- explain why no data appears;
- provide useful next action when appropriate.

Success:
- concise confirmation feedback.

Validation:
- show messages near relevant fields.

401:
- return to login or follow the backend's documented auth flow.

403:
- show access denied.

404:
- show a useful not-found state.

409:
- explain the conflict, such as duplicate enrollment.

500+:
- show a safe retryable message.

Network failure:
- clearly say the backend is unreachable.

Never leave the user in an endless loader.

# RESPONSIVE DESIGN

The plan must explicitly cover desktop, tablet, and narrow/mobile widths.

Check:
- sidebar;
- headers;
- forms;
- dialogs;
- tables;
- filters;
- action buttons;
- pagination;
- academic-record layout.

Minimum goal: the app must remain usable on both desktop and narrow/mobile widths.

# ACCESSIBILITY

Plan practical accessibility:
- semantic headings;
- form labels;
- keyboard-accessible controls;
- focus visibility;
- accessible dialogs;
- meaningful icon labels/tooltips;
- status not communicated by color alone;
- readable contrast;
- logical tab order.

Use the accessibility behavior provided by Radix/shadcn rather than bypassing it.

# FILE HANDLING AND PROJECT ORGANIZATION

This is a major requirement.

The final implementation must be easy to navigate for both the student and instructor.

Before proposing changes:
1. inspect the current structure;
2. preserve valid existing organization;
3. identify clutter or duplicated files;
4. identify files that can be consolidated;
5. avoid unnecessary folder depth;
6. avoid huge files with unrelated responsibilities.

Prefer feature/domain organization where it improves navigation.

Possible reference structure:

```text
src/
├── app/
│   ├── router/
│   └── providers/
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── students/
│   ├── programs/
│   ├── courses/
│   ├── academic-terms/
│   ├── course-offerings/
│   ├── enrollments/
│   ├── grades/
│   └── academic-record/
├── services/
│   └── api/
├── hooks/
├── types/
├── lib/
└── styles/
```

This is only a reference. Codex must decide the final structure from the actual project.

File-handling rules:
- specify which existing files remain;
- specify which files should be modified;
- specify which files should be created;
- specify which files are safe to remove, if any;
- specify which files should not be touched;
- explain why each structural change is needed;
- verify imports/references before recommending removal;
- do not rename large parts of the project without clear benefit;
- do not edit generated shadcn `components/ui` files unnecessarily;
- prefer application wrappers/compositions over repeated edits to primitives.

# SHADCN COMPONENT STRATEGY

Map required screens to likely shadcn components.

App shell:
- Sidebar
- Sheet
- Breadcrumb
- Dropdown Menu
- Avatar
- Separator

Dashboard:
- Card
- Badge
- Skeleton

Data management:
- Table/Data Table pattern
- Input
- Select
- Dropdown Menu
- Pagination
- Badge
- Tooltip

Forms:
- Form
- Input
- Select
- Textarea
- Combobox
- Calendar / Date Picker
- Button

Dialog workflows:
- Dialog
- AlertDialog
- Sheet / Drawer where better on mobile

Feedback:
- Sonner / toast
- Alert
- Skeleton
- shared empty-state application component

Do not add every shadcn component blindly. Only add what the plan needs.

# VISUAL DESIGN SYSTEM

Inspect the shadcn preset and current CSS/theme before planning visual changes.

Preserve the preset's design language.

The plan should define a small system for:
- page spacing;
- content width;
- heading hierarchy;
- card use;
- table density;
- border radius;
- icon sizing;
- button hierarchy;
- status badges;
- form spacing;
- responsive breakpoints.

Use theme variables instead of random one-off colors.

Suggested hierarchy:
- one primary action per page;
- secondary actions quieter;
- destructive actions clearly distinct;
- consistent status badges;
- predictable page titles;
- concise helper text.

# DASHBOARD DESIGN

Do not invent fake analytics.

Dashboard content must be based on actual backend data that can reasonably be fetched.

If there is no aggregate dashboard endpoint, the plan may use concise counts from existing list endpoints only if practical.

Prefer useful quick navigation and concise summaries over decorative charts.

# REQUIRED STUDENT LIST EXPERIENCE

This screen is a core demonstration.

Plan it carefully with:
- page title;
- concise context if useful;
- create-student action for authorized roles;
- search;
- at least two backend-supported filters;
- sorting where supported;
- data table;
- status badge;
- row actions;
- backend-driven pagination;
- loading skeleton;
- empty state;
- backend error state;
- responsive behavior;
- destructive confirmation;
- validation feedback.

Avoid permanently showing every action in every row if a dropdown menu improves clarity.

# ROUTING PLAN

Inspect whether routing already exists.

If not, propose a client-side routing approach suitable for Vite/React.

Conceptual routes:

```text
/login
/dashboard
/students
/students/:id
/programs
/courses
/academic-terms
/course-offerings
/enrollments
/grades
/academic-record
/profile
/403
/404
```

Adapt actual routes to the backend and role workflows.

Include:
- public route;
- protected shell;
- role-aware navigation;
- nested routes where useful;
- not-found route;
- deep-link refresh behavior.

# TESTING PLAN

Base the test strategy on the actual tooling.

At minimum plan tests for:

Authentication:
- successful login;
- invalid credentials;
- logout;
- protected route while unauthenticated;
- invalid/expired session.

Students:
- load list;
- search;
- filter;
- paginate;
- create;
- edit;
- backend validation failure;
- delete/deactivate.

Authorization:
- restricted UI;
- actual backend denial;
- 403 handling.

Enrollments:
- success;
- duplicate conflict;
- invalid reference.

Grades:
- authorized update;
- validation error;
- unauthorized update.

Networking:
- backend unavailable;
- loading;
- server error.

Routing:
- nested route refresh;
- protected navigation;
- not-found page.

Responsive:
- desktop;
- narrow/mobile.

Automated tests should include, when supported:
- one authentication-flow test;
- one API-integrated list/component test;
- one form-validation/error test;
- one protected-route/authorization test;
- one critical end-to-end flow when practical.

Do not invent a large testing stack if a simpler existing setup works.

# REQUIRED DOCUMENTATION

The eventual implementation must produce:

README.md:
- purpose;
- framework;
- prerequisites;
- installation;
- environment config;
- run/build/test commands;
- API connection instructions;
- how to run frontend and backend together.

API Integration Map:
```text
Frontend Page/Feature
→ REST Endpoint
→ HTTP Method
→ Required Role/Permission
```

AI Development Log:
- task;
- AI tool;
- prompt summary;
- result;
- human review;
- evidence.

Architecture Note:
- routing;
- API client;
- authentication state;
- component structure;
- server/API state;
- local UI state.

Evidence:
- major screens;
- success states;
- validation errors;
- authorization errors;
- network error;
- responsive/mobile view.

# REQUIRED LIVE DEMONSTRATION READINESS

The plan must prepare for these end-to-end demonstrations:

1. verify/start existing backend;
2. start frontend and show API base URL;
3. invalid login and error feedback;
4. successful login and user role;
5. protected route;
6. load Students from backend;
7. backend search;
8. filters and pagination;
9. create student;
10. show backend validation error;
11. edit student;
12. delete/deactivate student with confirmation;
13. manage Programs or Courses;
14. manage Academic Term and Course Offering;
15. enroll student;
16. authorized grade update;
17. display academic record;
18. restricted role + 403;
19. temporarily stop backend and show controlled network-error state;
20. show responsive behavior and explain architecture, API service, authentication, and AI-assisted workflow.

The plan should identify which page/file/component supports each demonstration item.

# PLANNING OUTPUT FORMAT

Create:

```text
FRONTEND_IMPLEMENTATION_PLAN.md
```

The file must be concise enough to navigate easily but detailed enough for another Codex session to implement without repeatedly asking what to do.

Use this structure:

## 1. Current Project Assessment
Summarize what actually exists:
- framework/version;
- shadcn state;
- dependencies;
- routing;
- API integration;
- auth;
- styling/theme;
- testing;
- documentation;
- major gaps.

Do not guess.

## 2. Existing Files to Preserve
List important files/folders and why they should remain.

## 3. Proposed Final Architecture
Show the proposed folder tree.
For each main directory, give a one-line plain-language purpose.

## 4. Design and Navigation Plan
Describe:
- app shell;
- desktop sidebar;
- mobile navigation;
- header;
- breadcrumb;
- role-aware menu;
- page hierarchy;
- responsive behavior.

## 5. Screen / Module Plan
For each module include:
- purpose;
- roles;
- primary actions;
- backend endpoints;
- shadcn components;
- loading/empty/error states;
- responsive notes.

Cover:
- Login
- Dashboard
- Students
- Programs
- Courses
- Academic Terms
- Course Offerings
- Enrollments
- Grades
- Academic Record
- Profile
- 403
- 404
- Network Error

## 6. API Integration Plan
Document:
- base URL;
- API client;
- auth headers;
- response/error normalization;
- service modules;
- 401/403/404/409/422/500/network behavior.

## 7. Authentication and Authorization Plan
Document:
- login;
- logout;
- current user;
- protected routes;
- token/session storage strategy based on actual backend;
- role-aware navigation;
- backend authorization boundary.

If the backend auth contract cannot be determined, flag it as a blocker instead of inventing it.

## 8. Data, State, Search, Filter, and Pagination Plan
Explain:
- server state;
- local state;
- refetch/invalidation;
- search;
- filters;
- sorting;
- pagination;
- useful query-state preservation.

## 9. Forms and Validation Plan
List major forms and their validation/error handling.

## 10. shadcn Component Map
Provide a concise table:

```text
Use Case | shadcn Component | App Component/File
```

Do not list unused components.

## 11. File-by-File Implementation Map
For every major planned change specify:

```text
File path
Action: CREATE / MODIFY / KEEP / REMOVE
Purpose
Main responsibility
Depends on
```

Focus on meaningful files.

Any REMOVE action must include a reason and verification step.

## 12. Implementation Phases

Use logical phases such as:

### Phase 1 — Project audit and cleanup
### Phase 2 — App shell, routing, and design system
### Phase 3 — API client and authentication
### Phase 4 — Reference modules
### Phase 5 — Student management
### Phase 6 — Academic transactions
### Phase 7 — Academic record and role views
### Phase 8 — UX/error/responsive hardening
### Phase 9 — Testing
### Phase 10 — Documentation and demo readiness

For each phase include:
- files involved;
- tasks;
- dependencies;
- verification/checkpoint;
- expected visible result.

## 13. Test Plan
List required manual and automated checks.

## 14. Live Demonstration Map
Map each of the 20 demo requirements to:
- page;
- action;
- expected backend/UI result.

## 15. Risks / Unknowns / Blockers
Examples:
- backend endpoint mismatch;
- token format unknown;
- CORS not configured;
- missing endpoint;
- missing role information;
- unclear pagination response.

Do not silently invent solutions.

## 16. Final Implementation Checklist
Create a clean checkbox list covering:
- real API integration;
- authentication;
- protected routes;
- role-aware UI;
- all required modules;
- student CRUD;
- search/filter/pagination;
- validation;
- loading/empty/error states;
- responsive behavior;
- accessibility;
- no direct DB access;
- no frontend secrets;
- tests;
- documentation;
- build;
- live demo readiness.

# IMPORTANT PLANNING RULES

1. Do not implement yet.
2. Do not generate code just to prove the plan.
3. Base all decisions on the current project.
4. Preserve the shadcn preset and valid project setup.
5. Prefer shadcn components over unnecessary custom primitives.
6. Do not add dependencies unless the plan explains why.
7. Do not create a second backend.
8. Do not access the database directly from the frontend.
9. Do not hardcode core API data.
10. Do not assume frontend-hidden actions provide security.
11. Keep architecture understandable by a student.
12. Keep folder depth reasonable.
13. Keep files focused and navigable.
14. Flag unknown backend contracts instead of hallucinating them.
15. Prioritize required Laboratory 3 functionality over bonus features.
16. The final plan must be realistic, phased, easy to navigate, and easy to defend face-to-face.

# FINAL RESPONSE AFTER PLANNING

After creating `FRONTEND_IMPLEMENTATION_PLAN.md`, respond only with:

## PLAN CREATED
- path to the plan file;
- 3–5 bullets summarizing the direction;
- blockers/unknowns, if any;
- one sentence stating that no implementation was performed yet.

Do not start implementation until explicitly instructed.
