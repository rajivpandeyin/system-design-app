# System Design Auth Service

This is a small Express + TypeScript authentication service using PostgreSQL and Redis.
It provides endpoints used by the React app:

- `POST /auth/signup` — create user, returns `{ token, refreshToken, user }`
- `POST /auth/login` — login, returns `{ token, refreshToken, user }`
- `POST /auth/refresh` — exchange refresh token for new access token (rotates refresh token)
- `POST /auth/logout` — delete refresh token
- `GET /metrics` — example protected endpoint

## Features

- PostgreSQL for user storage
- Redis to store refresh tokens (simple rotation and invalidation)
- JWT access tokens (short-lived) and refresh tokens (server-stored UUIDs)
- Password hashing with `bcrypt`
- Input validation with `zod`

## Quickstart (local)

1. Copy example env and adjust values:

```bash
cp .env.example .env
# edit .env if needed
```

2. Start Postgres + Redis (option A: docker-compose):

```bash
docker-compose up -d
# wait until Postgres is ready, then initialize schema
npm run migrate
```

Option B: start Postgres and Redis externally and set `DATABASE_URL` and `REDIS_URL` appropriately.

3. Install dependencies and run dev server

```bash
npm install
npm run dev
```

Server will be available at `http://localhost:4004` by default.

## DB schema

The SQL in `sql/init.sql` creates a `users` table with columns:

- `id` (serial primary key)
- `name`, `email`, `password_hash`, `created_at`

## Token flow

- On signup/login: service issues a short-lived JWT access token (signed with `JWT_ACCESS_SECRET`) and a server-stored refresh token (UUID) stored in Redis keyed as `refresh:<token>` -> `userId` with TTL.
- To refresh: client calls `POST /auth/refresh` with `refreshToken`. Service looks up Redis, deletes old token, issues new refresh token and new access token.
- On logout: client calls `/auth/logout` with the refresh token to remove it from Redis.

## Integration with React app

- Use `POST /auth/login` and `/auth/signup` to obtain `token` and `refreshToken`.
- Attach `Authorization: Bearer <token>` header to protected API calls (e.g., `/metrics`).
- When token expires, call `/auth/refresh` with `refreshToken` to get a new access token.

## Notes and improvements

- In production, use strong random secrets and secure storage for `JWT_*` env vars.
- Consider adding refresh token rotation tracking to detect reuse and revoke all tokens for a user.
- Implement rate limiting and brute-force protection on auth endpoints.
- Add email verification and password reset flows.

