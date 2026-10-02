# Frontend Architecture

## Routing and shell

React Router provides public login, a protected shell, domain routes, 403, and wildcard 404. The shell uses a persistent desktop sidebar and mobile overlay drawer. Menu visibility follows the role for usability; backend authorization remains the security boundary.

## API and authentication

`src/services/api/client.ts` owns the environment URL, JSON parsing, Bearer header, 204 handling, cancellation, and normalized failures. Domain services are the only files containing endpoint paths. `AuthProvider` keeps the user in memory and the access token in `sessionStorage`; startup verifies `/auth/me`, and logout invokes backend revocation.

## State and components

TanStack Query manages server state. URL parameters preserve Student search/filter/sort and list pagination. Forms and dialogs keep local state. The radix-luma tokens remain in `src/index.css`; application primitives compose the installed Radix package and existing shadcn Button because the remote shadcn registry was unreachable during implementation.

The API has no dashboard aggregate, refresh token, profile update, GPA rule, grade delete, or non-admin instructor directory. The interface does not invent these capabilities.
