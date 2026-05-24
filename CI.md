# GitHub Actions — CI

Pull requests targeting `main`, `master`, or `develop` trigger the **Pull Request CI** workflow.

## What runs

| Check (shown on PR) | When | Command |
|---------------------|------|---------|
| **Frontend / Unit tests** | `system-design-app/` changed | `npm run test:unit` |
| **Frontend / Playwright E2E** | `system-design-app/` changed | `npm run test:e2e:ci` |
| **Backend / Unit tests** | `system-design-auth-service/` changed | `npm test` |
| **CI Summary** | Every PR | Fails if any required check above failed |

Changes only under `.github/workflows/` run **all** checks.

## PR status

GitHub shows each job on the PR automatically:

- **Yellow / pending** — job is running
- **Green / success** — job passed
- **Red / failure** — job failed (click for logs)

The **CI Summary** job adds a markdown table on the workflow run page.

## Branch protection (recommended)

In GitHub → **Settings** → Branches → branch protection rule, enable **Require status checks** and select:

- `Frontend / Unit tests`
- `Frontend / Playwright E2E`
- `Backend / Unit tests`
- `CI Summary`

## Run locally (same as CI)

```bash
# Frontend
cd system-design-app
npm ci
npm run test:unit
npm run test:e2e:install
npm run test:e2e:ci

# Backend
cd system-design-auth-service
npm ci
npm test -- --runInBand --ci
```

## Workflow file

.github/workflows/pull-request-ci.yml
