# Restaurant Timesheet, Scheduling & Payroll App

Monorepo: `/apps/api` (NestJS), `/apps/mobile` (React Native + Expo), `/packages/shared-types`.
Full spec lives in [`/docs`](docs/PROJECT.md).

## Prerequisites

- Node.js 20+
- Docker (for local Postgres + Redis)
- Expo Go app on your phone, or an iOS/Android simulator (for the mobile app)

## 1. Clone and install

```bash
git clone https://github.com/mannemkarthik010/timesheet_planning.git
cd timesheet_planning
npm install
```

This installs all three workspaces (`apps/api`, `apps/mobile`, `packages/shared-types`) from the root.

## 2. Build shared-types

The API and mobile app both import `@timesheet/shared-types`, which needs a build step before either can resolve it:

```bash
npm run build:shared-types
```

## 3. Configure environment

The API reads its `.env` from **`apps/api/.env`** (npm workspace scripts run with that package's directory as cwd, not the repo root):

```bash
cp .env.example apps/api/.env
```

The defaults in `.env.example` already match the docker-compose Postgres/Redis credentials below, so no edits are required for local dev. `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_VERIFY_SERVICE_SID` can stay blank — with no Twilio credentials configured, the API falls back to `FakeOtpProvider`, which accepts the fixed code `000000` for every OTP/verification step.

## 4. Start Postgres + Redis

```bash
docker compose up -d postgres redis
```

## 5. Run migrations

```bash
npm run migration:run
```

This creates all 16 tables, the `app_role` the API connects as at runtime, the RLS policies, and the `audit_logs` privilege lockdown. To reverse the most recent migration: `npm run migration:revert`.

## 6. Start the API

```bash
npm run dev:api
```

The API listens on `http://localhost:3000/api/v1` (change with `PORT` in `apps/api/.env`).

## 7. Start the mobile app

```bash
npm run start --workspace=@timesheet/mobile
```

This opens the Expo dev server / QR code — scan it with Expo Go, or press `i`/`a` to launch an iOS/Android simulator.

## Running tests

```bash
npm run test:api        # unit tests (guards, etc.)
npm run test:api:e2e    # e2e — requires Postgres up and migrations applied (steps 4-5)
```
