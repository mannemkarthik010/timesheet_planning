# PROJECT.md
Restaurant Timesheet, Scheduling & Payroll App — iOS + Android

> Read this file at the start of every session. It is the single source of truth for stack, structure, and non-negotiable business rules. Full detail lives in `/docs/tech-stack.md`, `/docs/data-model.md`, `/docs/api-contract.md` — this file is the summary + the rules that must never be violated.

---

## Scope (locked)
- Single restaurant, single location. No multi-tenancy.
- Payouts are record-only — the app documents a payment made outside the app (cash/check/external payroll). No money movement.
- Employees may self-register or be admin-invited; admin reconciles/links either path.
- Payroll math is raw-hours-only for v1. No auto overtime/meal-break calc — admin enters the final payment amount manually.

---

## Tech stack
- **Mobile:** React Native + Expo (dev-client workflow), single codebase for iOS + Android.
- **Backend:** Node.js + NestJS (TypeScript), containerized (Docker).
- **Database:** PostgreSQL (managed — Supabase/Neon/RDS), `uuid` PKs, `timestamptz` everywhere (UTC storage).
- **PDF generation:** Server-side, Puppeteer (HTML/CSS → PDF) as a background job (BullMQ), triggered right after payout confirmation.
- **SMS/OTP:** Twilio (Programmable SMS + Verify API).
- **Signature capture:** `react-native-signature-canvas`, exported PNG uploaded to cloud storage.
- **Cloud storage:** AWS S3 (or Cloudflare R2), private buckets, signed time-limited URLs only — never public links.
- **Push notifications:** Firebase Cloud Messaging (iOS + Android).
- **Auth:** Passport.js — local (email/password) + Twilio Verify OTP + JWT access/refresh; mandatory 2FA for admin.
- **Offline sync:** on-device SQLite (`expo-sqlite`) write-ahead queue, `client_generated_id` (UUID) reconciliation.
- **Background jobs:** BullMQ (Redis-backed) — reminders, SMS, PDF generation.
- **Hosting:** any container platform (Render/Railway/Fly/ECS) + managed Postgres + Redis add-on.

---

## Folder structure convention
```
/apps
  /mobile        → React Native (Expo) app
  /api           → NestJS backend
/packages
  /shared-types  → DTOs/Zod schemas shared between mobile and API
/docs
  tech-stack.md
  data-model.md
  api-contract.md
  PROJECT.md
```
Shared request/response types live in `/packages/shared-types` and are imported by both apps — never redefined separately, since payroll correctness depends on mobile and API agreeing on shapes.

---

## Coding standards
- All request/response field names mirror `data-model.md` column names 1:1 — no renaming between DB, API, and client.
- Every mutation listed under "Audit logging" below must write its `audit_logs` row **in the same DB transaction** as the mutation itself. No exceptions, no "add logging later."
- Standard error envelope: `{ "error": { "code": "...", "message": "...", "details": {} } }`.
- Standard list envelope: `{ "data": [...], "page": 1, "page_size": 25, "total": N }`.
- Every feature ships with tests for its business rules — not just happy path.
- API versioned at `/api/v1` from day one.

---

## Non-negotiable business rules

### 1. 5-minute employee edit lock
- `lock_expires_at = submitted_at (server time) + 5 min`. Server clock only — never trust a client-claimed timestamp for starting the window.
- **Creates** (including offline entries synced later): the window always starts at server sync time, giving a full fresh 5 minutes — a real connectivity gap never shortens it.
- **Edits arriving offline after the window closed**: rejected outright (`403 LOCKED_ENTRY`), auto-converted into a `pending` `correction_requests` row instead of silently dropped, with an audit log capturing both the device-claimed time and the server's real `lock_expires_at`.
- Server re-validates the lock on every edit attempt — the mobile countdown UI is a convenience only, never the authority.

### 2. Audit logging
- Every submission, edit, approval/rejection, correction request, admin edit, payout action, and PDF generation writes to `audit_logs` — same transaction as the mutation.
- `audit_logs` table: INSERT-only DB privilege for the app role (no UPDATE/DELETE).
- Snapshots are full-row JSON (`previous_value`/`new_value`), not diffs.

### 3. Role-based access control
- Enforced at the API layer (NestJS guards: role + resource ownership) as the primary check.
- Defense-in-depth: Postgres Row-Level Security on `timesheet_entries`, `payroll_payouts`, `pdf_reports` — restricts rows to `employee_id = current_user` unless the connection carries an admin claim.
- Employees only ever see their own data. Published-schedule visibility of coworkers' shifts is controlled separately by `restaurant_settings.show_team_schedule_to_employees` (shift-grid only — never exposes hourly rate or contact info).

### 4. Payout locking
- `payroll_payouts.is_locked = true` the instant the linked `pdf_reports` row is created (same transaction) — also locks every linked `timesheet_entries` row.
- Only path to change a locked period: explicit "Unlock for correction" admin action requiring (a) fresh re-authentication, (b) a mandatory reason note, (c) an audit log entry written *before* the edit is allowed, (d) automatic re-lock once a new PDF is regenerated.

### 5. Correction requests vs. payout locking (race condition — 3 enforcement layers)
1. At payout creation: any entry with a `pending` correction request is rejected from the payout (`409 CORRECTION_PENDING`, lists blocked entry IDs).
2. At payout confirmation: the same check re-runs immediately before the PDF job is enqueued (closes the create→confirm gap).
3. Backstop at lock time: any correction request that still somehow made it through is auto-rejected with a notification to the employee and an audit log entry — nothing is silently dropped.

### 6. Signature required before payout finalizes
- `POST /payouts/:id/signature` uploads the signature but does **not** finalize payment.
- `POST /payouts/:id/confirm` (admin) is what actually sets `paid_at`/`status = paid` and triggers PDF generation — fails with `409 SIGNATURE_MISSING` if no signature exists yet.

### 7. PDFs
- Generated server-side only, as a background job, never on-device.
- Every PDF: unique report ID, restaurant branding, signed time-limited download URL only (never a permanent public link).

---

## Open items still needing a decision (from data-model.md §5 and tech-stack.md)
Resolve before the relevant feature is built — not blockers for scaffolding, but flag if you hit one mid-build:
1. Overnight shifts crossing midnight — does `time_out` land on the next calendar day, and which date is the shift "paid against"?
2. Correction request scope — can employees propose changes to `shift_type`/`shift_date`, or only `time_in`/`time_out`/`notes`?
3. Concurrent pending correction requests on the same entry — block a second one, or allow and show only the latest?
4. Custom payout period overlap — hard-block overlapping date ranges per employee, or allow intentional re-runs?
5. Terminated employee accounts — immediate login block, or read-only access to view past payout PDFs?
6. Non-US employee phone numbers — affects Twilio country coverage/cost.
7. Data retention period for old PDFs/audit logs — affects storage lifecycle policy only, not a build blocker.

---

## Reference docs
Full schema: `/docs/data-model.md` (16 tables, all constraints, relationships).
Full API surface: `/docs/api-contract.md` (all endpoints, request/response shapes, error codes).
Full stack rationale + alternatives considered: `/docs/tech-stack.md`.
