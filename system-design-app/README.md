# System Design React App

This React app is built with a clean component-based architecture and includes login, signup, and dashboard functionality.

## What is included

- React 19 application scaffolded with Vite
- Material UI for the user interface
- Redux Toolkit for global state management
- Zod for form input validation
- Axios for API calls to `http://localhost:4004`
- React Router for page navigation
- A clean feature-based folder structure ready for scaling

## Folder structure

- `src/`
  - `core/` — shared application logic, such as protected route handling
  - `features/auth/` — authentication state, API calls, validation schemas
  - `store/` — Redux store and typed hooks
  - `components/ui/` — reusable UI components built with Material UI
  - `pages/` — page-level components for login, signup, and dashboard
  - `lib/api.ts` — Axios instance configured with base API URL

## Configuration flow

1. `src/main.tsx`
   - Initializes React
   - Wraps the app with `ThemeProvider`, `CssBaseline`, `Provider`, and `BrowserRouter`
2. `src/App.tsx`
   - Defines routes for `/login`, `/signup`, and `/dashboard`
   - Uses `ProtectedRoute` to secure the dashboard page
3. `src/store/store.ts`
   - Configures the Redux Toolkit store with the auth slice
4. `src/features/auth/authSlice.ts`
   - Manages auth state, status, user info, and errors
   - Contains async thunks for login and signup
5. `src/lib/api.ts`
   - Creates a shared Axios client pointing at `http://localhost:4004`
   - Update the baseURL here when your backend URL changes
6. `src/features/auth/authSchemas.ts`
   - Validates login and signup form data with Zod
   - Converts validation rules into typed form values
7. `src/features/auth/authApi.ts`
   - Sends API requests for login and signup using Axios
8. Page flow
   - `LoginPage` validates credentials and dispatches `login`
   - `SignupPage` validates registration info and dispatches `signup`
   - `DashboardPage` is reachable only when auth token exists

## Libraries used

- `react` / `react-dom` — UI library
- `react-router-dom` — client-side routing
- `@mui/material` / `@mui/icons-material` — Material UI component library
- `@reduxjs/toolkit` — standardized Redux patterns
- `react-redux` — bindings for React and Redux
- `axios` — HTTP client for REST calls
- `zod` — runtime schema validation with TypeScript inference
- `vite` — fast development and build tooling
- `typescript` — static typing

## Functional behavior

- **Signup**
  - User fills in name, email, password
  - Zod validates the form client-side
  - Axios sends `POST /auth/signup` to backend
  - Redux stores the returned token and user data
  - User is redirected to `/dashboard`

- **Login**
  - User enters email and password
  - Zod validates the form client-side
  - Axios sends `POST /auth/login`
  - Redux stores the returned token and user data
  - Protected dashboard becomes accessible

- **Dashboard**
  - Shows a welcome message and app summary
  - Includes a logout button that clears auth state
  - Redirects to login when token is missing

## Running the project

1. Install dependencies

```bash
cd /var/www/html/project/system-design-app
npm install
```

2. Start the development server

```bash
npm run dev
```

3. Open the app in your browser

- `http://localhost:5173`

## Notes for React learners

**Start here:** [`LEARNING_GUIDE.md`](./LEARNING_GUIDE.md) — detailed guide covering every library, pattern, auth flow, responsive layout, and interview Q&A.

- The app is organized by feature rather than by file type. This means auth-related logic lives together in `src/features/auth/`.
- `src/core/ProtectedRoute.tsx` separates the authentication guard from page components.
- Redux Toolkit keeps state management simple with slices and async thunks.
- Zod gives you validation rules and strong types in one place.
- Axios centralizes your API base URL and headers so every request is consistent.
- Material UI supplies responsive form controls, buttons, layout, and typography.

## How to update the API URL

- Open `src/lib/api.ts`
- Change `baseURL: 'http://localhost:4004'` to your backend address

## Next improvements

   - Implemented: `src/core/storage.ts`, store hydration and subscription in `src/store/store.ts`.
   - The app now persists `{ token, user }` to localStorage under key `system_design_app_auth_v1`.
   - To clear stored auth, call `clearAuthStorage()` or use the `logout()` action.

## Git workflow

Remote: [github.com/rajivpandeyin/system-design-app](https://github.com/rajivpandeyin/system-design-app)

| Step | Action |
|------|--------|
| 1 | Branch from `develop`: `git checkout -b feature/my-change` |
| 2 | Open PR **into `develop`** |
| 3 | After CI passes, merge to `develop` |
| 4 | Open PR **`develop` → `main`** for release |

Full guide: [CONTRIBUTING.md](./CONTRIBUTING.md)

## Testing

Unit tests (Jest + Testing Library) and end-to-end tests (Playwright) are configured.

```bash
cd /var/www/html/project/system-design-app
npm install
npm run test:e2e:install   # first time only — downloads Chromium for Playwright
npm run test:unit          # 26 unit tests
npm run test:e2e:ci        # starts Vite dev server automatically, runs 10 E2E tests
npm run test               # unit + e2e
```

### CI on pull requests

GitHub Actions runs on every PR to `develop` or `main`:

- **Unit tests** — Jest  
- **Playwright E2E** — browser tests (API mocked)  
- **Production build** — `tsc` + Vite  
- **CI Summary** — overall pass/fail on the PR  

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch protection setup.

### Unit tests (`src/**/*.test.ts(x)`)

| Area | Files |
|------|--------|
| Auth | `authSlice`, `authThunks`, `authSchemas` |
| Core | `storage`, `ProtectedRoute` |
| Pages | `LoginPage`, `SignupPage` |
| API | `lib/api` |

Shared helpers: `src/test/test-utils.tsx`

### E2E tests (`e2e/`)

| File | Coverage |
|------|----------|
| `login.spec.ts` | Login form, protected-route redirect |
| `login-signup.spec.ts` | Signup, login, logout confirm dialog |
| `dashboard.spec.ts` | Sidebar nav, tools, profile via app bar, mobile menu |

API calls are mocked in `e2e/helpers.ts` (no backend required for E2E).
