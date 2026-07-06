# API Contract
Restaurant Timesheet, Scheduling & Payroll App — REST/JSON

## Conventions

- Base URL: `https://api.<restaurant-domain>/api/v1`
- Auth: `Authorization: Bearer <access_token>` (JWT, short-lived ~15 min) + `refresh_token` (httpOnly on web admin console if one exists, or secure storage on mobile) via `POST /auth/refresh`.
- Every endpoint below is tagged `[employee]`, `[admin]`, or `[employee|admin]` indicating which role(s) may call it. Ownership is additionally enforced — an `[employee]` endpoint scoped to a resource always restricts to `employee_id = current_user.id` regardless of what's in the URL/body.
- Standard error envelope:
```json
{ "error": { "code": "LOCKED_ENTRY", "message": "This entry is locked and can no longer be edited.", "details": {} } }
```
- Standard list envelope:
```json
{ "data": [ /* items */ ], "page": 1, "page_size": 25, "total": 143 }
```
- All request/response field names mirror `data-model.md` column names directly so DTOs map 1:1 onto ORM entities.

---

## 1. Auth

### `POST /auth/register` — `[public]`
Self-registration path (per "both supported" account provisioning).
```json
// request
{ "full_name": "Jamie Lee", "email": "jamie@example.com", "phone_number": "+14155551234", "password": "•••••••" }
// response 201
{ "user_id": "uuid", "is_verified": false, "next_step": "verify_otp" }
```

### `POST /auth/verify` — `[public]`
```json
{ "user_id": "uuid", "code": "482913" }
```
`200 → { "verified": true }`. Sets `is_verified = true`; for self-registered accounts, flips `login_status` to `active` only after an admin links them to an `employee_profiles` row (see §2).

### `POST /auth/login` — `[public]`
```json
{ "identifier": "jamie@example.com", "password": "•••••••" }
```
`200 →`
```json
{ "access_token": "jwt", "refresh_token": "opaque", "role": "employee", "requires_2fa": false }
```
If `role = admin`, response instead returns `{ "requires_2fa": true, "otp_challenge_id": "uuid" }` and the client must call the 2FA endpoint below before tokens are issued.

### `POST /auth/login/otp/request` — `[public]`
```json
{ "phone_number": "+14155551234" }
```
Triggers Twilio Verify SMS OTP. `200 → { "otp_challenge_id": "uuid" }`

### `POST /auth/login/otp/verify` — `[public]`
```json
{ "otp_challenge_id": "uuid", "code": "482913" }
```
`200 → { "access_token": "jwt", "refresh_token": "opaque", "role": "employee" }`

### `POST /auth/admin/2fa/verify` — `[public]`
```json
{ "otp_challenge_id": "uuid", "code": "917732" }
```
`200 → { "access_token": "jwt", "refresh_token": "opaque", "role": "admin" }`

### `POST /auth/refresh` / `POST /auth/logout` — `[employee|admin]`
Standard token rotation / revocation (revokes the `refresh_tokens` row).

### `POST /auth/invite` — `[admin]`
Admin-invited provisioning path.
```json
{ "full_name": "Jamie Lee", "email": "jamie@example.com", "phone_number": "+14155551234",
  "job_role": "Server", "hourly_rate": 21.50, "joining_date": "2026-07-10" }
```
`201 →` creates `users` (registration_source=admin_invited) + `employee_profiles`, sends invite SMS/email with a tokenized link, and writes an `audit_logs` row (`action_type: employee_invited`).

### `POST /auth/invite/accept` — `[public]`
```json
{ "invitation_token": "opaque", "password": "•••••••" }
```
`200 → { "access_token": "jwt", "refresh_token": "opaque" }`

---

## 2. Employee Profiles

| Method & Path | Role | Notes |
|---|---|---|
| `GET /employees` | `[admin]` | query: `status`, `job_role`, `search`; paginated list envelope |
| `GET /employees/:id` | `[admin]` | full profile incl. `employment_status`, `hourly_rate` |
| `PATCH /employees/:id` | `[admin]` | edits `job_role`, `hourly_rate`, `emergency_contact_*`; writes audit log |
| `PATCH /employees/:id/status` | `[admin]` | `{ "employment_status": "terminated" }` or `{ "login_status": "deactivated" }`; independent fields per data-model open question 5 |
| `POST /employees/:id/link-self-registered` | `[admin]` | links a self-registered `users` row to a new `employee_profiles` row when an employee signed up themselves; sets `login_status = active` |
| `GET /me` | `[employee\|admin]` | own profile |
| `PATCH /me` | `[employee\|admin]` | limited self-edit: `emergency_contact_*` only for employees |

---

## 3. Timesheets

### `POST /timesheets` — `[employee]`
```json
{ "shift_date": "2026-07-06", "shift_type": "morning", "time_in": "2026-07-06T15:00:00Z",
  "time_out": "2026-07-06T20:30:00Z", "notes": "Covered extra prep", "client_generated_id": "uuid",
  "shift_assignment_id": "uuid-or-null" }
```
`201 →`
```json
{ "id": "uuid", "status": "pending", "total_hours": 5.5, "submitted_at": "2026-07-06T20:31:02Z",
  "lock_expires_at": "2026-07-06T20:36:02Z" }
```
Side effects: sends confirmation SMS (Twilio), creates in-app + push `notifications` row, writes `audit_logs` (`timesheet_submit`).

### `GET /timesheets` — `[employee|admin]`
Query params: `employee_id` (admin only — employees are always scoped to self), `date_from`, `date_to`, `shift_type`, `status`. Returns list envelope of entries including `is_locked` (computed: `now() > lock_expires_at || is_payout_locked`).

### `GET /timesheets/:id` — `[employee|admin]`

### `PATCH /timesheets/:id` — `[employee|admin]`
```json
{ "time_in": "2026-07-06T15:05:00Z", "time_out": "2026-07-06T20:30:00Z", "notes": "corrected typo", "reason": "optional, required if admin editing a payout-locked entry" }
```
`200 →` updated entry. `403 LOCKED_ENTRY` if employee attempts after `lock_expires_at`, or if `is_payout_locked = true` for anyone without the unlock flow. Every successful edit writes an `audit_logs` row with `previous_value`/`new_value` snapshots.

### `POST /timesheets/sync` — `[employee]`
Bulk upload of offline-queued operations — both new entries **and** edits made to entries while offline. Each operation is tagged `type` so the server can apply create-time and edit-time lock rules differently (data-model.md §3.1 and §3.6).
```json
{ "operations": [
  { "type": "create", "client_generated_id": "uuid", "shift_date": "2026-07-06", "shift_type": "evening",
    "time_in": "...", "time_out": "...", "notes": "", "device_captured_at": "2026-07-06T02:14:00Z" },
  { "type": "edit", "entry_id": "uuid", "time_out": "2026-07-06T21:15:00Z",
    "device_captured_at": "2026-07-06T02:16:30Z" }
] }
```
`200 →`
```json
{ "results": [
  { "client_generated_id": "uuid", "server_id": "uuid", "type": "create", "status": "created",
    "submitted_at": "2026-07-06T09:02:11Z", "lock_expires_at": "2026-07-06T09:07:11Z" },
  { "entry_id": "uuid", "type": "edit", "status": "rejected_converted_to_correction",
    "correction_request_id": "uuid",
    "message": "Your edit couldn't be applied automatically because it reached the server after the 5-minute edit window closed. It's been submitted as a correction request for admin review instead." }
] }
```
Rules (see data-model.md §3.1/§3.6 for the full reasoning):
- **Creates** always get a fresh `lock_expires_at = submitted_at (server sync time) + 5 minutes` — never anchored to `device_captured_at`, so a real connectivity gap never unfairly shortens the window.
- **Edits** are checked against the *target entry's already-established* `lock_expires_at`. If the edit arrives after that deadline, it is rejected outright and auto-converted into a `pending` `correction_requests` row (`origin: auto_converted_offline_edit`) rather than silently dropped — the client should tell the user their change is now awaiting admin review, not that it succeeded.
- `device_captured_at` is stored for audit/UX purposes only (e.g., showing "edited 3 minutes ago" in the app) — it is never used to grant or extend a lock window.
- Duplicate `client_generated_id` (creates) or duplicate identical edit resubmission is idempotent — returns the existing outcome instead of creating a duplicate row or a second correction request.

### `GET /timesheets/:id/audit` — `[employee|admin]`
Returns the filtered `audit_logs` slice for this entity (employee sees own; admin sees all).

---

## 4. Correction Requests

### `POST /timesheets/:id/correction-requests` — `[employee]`
```json
{ "proposed_changes": { "time_out": "2026-07-06T21:00:00Z" }, "reason": "Forgot to clock out on time" }
```
`201 → { "id": "uuid", "status": "pending", "origin": "employee_submitted" }` — allowed regardless of lock state (this is precisely the unlock mechanism for locked-but-not-payout-locked entries). **Rejected with `409 ENTRY_PAYOUT_LOCKED`** if `timesheet_entries.is_payout_locked = true` for the target entry — a payout-locked entry can only be reopened by an admin via the "Unlock for correction" flow (data-model.md §3.4), not by filing a new correction request against it.

### `GET /correction-requests` — `[admin]`
Query: `status=pending`, `employee_id`, `date_from/to`, `origin` (filter out/in system-auto-converted ones if desired).

### `PATCH /correction-requests/:id` — `[admin]`
```json
{ "status": "approved", "admin_note": "Confirmed with manager on duty" }
```
`200 →` on approval, applies `proposed_changes` to the underlying `timesheet_entries` row in the same transaction, sets entry `status = corrected`, and writes two audit log rows (`correction_request_reviewed`, `timesheet_edit_admin`). **Fails with `409 PAYOUT_ALREADY_LOCKED`** if the target entry's payout has been locked in the meantime — the admin must unlock the payout first (data-model.md §3.4).

**Automatic rejection on payout lock:** a `pending` correction request is never left dangling once its entry's pay period is finalized. `POST /payouts` and `POST /payouts/:id/confirm` both block on any linked entry with a pending correction request (see §7 below); as a backstop, the instant a payout locks, any surviving pending request on its entries is auto-set to `status = rejected` with a system-generated `admin_note`, and the requesting employee is notified (data-model.md §3.5). No separate endpoint call is needed for this — it's a side effect of the payout-lock transaction.

---

## 5. Approvals

### `PATCH /timesheets/:id/approve` — `[admin]`
`200 → { "id": "uuid", "status": "approved", "reviewed_by": "uuid", "reviewed_at": "..." }`

### `PATCH /timesheets/:id/reject` — `[admin]`
```json
{ "admin_note": "Total hours don't match schedule — please clarify" }
```

### `POST /timesheets/bulk-approve` — `[admin]`
```json
{ "timesheet_ids": ["uuid", "uuid"] }
```
Convenience batch action for the admin approval queue; still writes one audit row per entry.

---

## 6. Scheduling

### `POST /schedules` — `[admin]`
```json
{ "week_start_date": "2026-07-06" }
```
`201 → { "id": "uuid", "status": "draft" }`

### `GET /schedules?week_start_date=2026-07-06` — `[employee|admin]`
Employees receive only `published` schedules. **Default behavior (decided): coworkers' shifts are visible.** Each assignment in the response includes `employee_id`, `employee_name`, `shift_date`, `shift_type`, `planned_start_time`, `planned_end_time` — never `hourly_rate` or any other profile/contact field, regardless of who's viewing. If an admin sets `restaurant_settings.show_team_schedule_to_employees = false`, the response is filtered server-side to each employee's own assignments only before it's returned — this is enforced in the API layer, not left to the client to hide.

### `POST /schedules/:id/assignments` — `[admin]`
```json
{ "employee_id": "uuid", "shift_date": "2026-07-07", "shift_type": "evening",
  "planned_start_time": "17:00", "planned_end_time": "22:00" }
```
`201 →` new assignment. Drag-and-drop "move" is modeled as a `PATCH`, not delete+recreate, so history/notifications stay coherent.

### `PATCH /assignments/:id` — `[admin]`
```json
{ "employee_id": "uuid-of-different-employee" }
```
Moves a worker between shifts; triggers an `assignment_changed` notification to both the old and new assignee if the schedule is already published.

### `DELETE /assignments/:id` — `[admin]`

### `POST /schedules/:id/publish` — `[admin]`
`200 → { "id": "uuid", "status": "published", "published_at": "..." }` — fans out `schedule_published` notifications to every assigned employee.

### Availability *(optional feature)*
- `GET /employees/:id/availability` — `[employee|admin]`
- `PUT /employees/:id/availability` — `[employee]` (self only) — replaces the week's availability blocks.

---

## 7. Payroll & Payouts

### `GET /payroll/summary` — `[admin]`
Query: `employee_id`, `period_type`, `period_start`, `period_end`. Pre-payout preview screen.
```json
// response
{ "employee_id": "uuid", "employee_name": "Jamie Lee", "period_start": "2026-06-29", "period_end": "2026-07-05",
  "total_approved_hours": 38.5, "hourly_rate": 21.50, "suggested_pay": 827.75,
  "previous_unpaid_hours": 2.0, "eligible_timesheet_entry_ids": ["uuid", "uuid"],
  "held_back_entry_ids": ["uuid"], "held_back_reason": "pending_correction_request" }
```
`suggested_pay` is informational only — the admin still must enter `final_payment_amount` explicitly (raw-hours-only v1 rule). Entries with a `pending` correction request are surfaced separately in `held_back_entry_ids` and excluded from `eligible_timesheet_entry_ids` and the hours total, so the admin sees up front which hours can't be paid out yet (data-model.md §3.5).

### `POST /payouts` — `[admin]`
```json
{ "employee_id": "uuid", "period_type": "weekly", "period_start_date": "2026-06-29", "period_end_date": "2026-07-05",
  "final_payment_amount": 850.00, "adjustment_notes": "Rounded up for split-shift inconvenience",
  "timesheet_entry_ids": ["uuid", "uuid"] }
```
`201 → { "id": "uuid", "status": "draft" }` — creates `payroll_payouts` + `payout_line_items` rows. **Fails with `409 CORRECTION_PENDING`** if any `timesheet_entry_ids` has a `pending` correction request:
```json
{ "error": { "code": "CORRECTION_PENDING", "message": "2 of the selected entries have an unresolved correction request and cannot be included in this payout.",
  "details": { "blocked_entry_ids": ["uuid", "uuid"] } } }
```
The admin must either resolve those correction requests first or resubmit the payout excluding those entry IDs (they roll forward via `previous_unpaid_hours` next period).

### `GET /payouts` — `[employee|admin]`
Employees see only their own; supports `status` filter.

### `GET /payouts/:id` — `[employee|admin]`

### `PATCH /payouts/:id` — `[admin]`
Edits a still-`draft` payout (`final_payment_amount`, `adjustment_notes`) — blocked once `status` moves past `draft`.

### `POST /payouts/:id/signature` — `[employee]`
```json
{ "signature_image_base64": "..." }
```
`200 →` uploads to cloud storage, sets `employee_signature_url`, `employee_signed_at`, `status = pending_signature → paid` only after the admin confirmation step below (signature alone doesn't finalize).

### `POST /payouts/:id/confirm` — `[admin]`
`200 →` sets `admin_confirmed_at`, `paid_at`, `status = paid`; enqueues the PDF-generation background job; on completion sets `is_locked = true` on the payout and every linked `timesheet_entries` row, and auto-rejects (with notification) any correction request that snuck in as `pending` on a linked entry since the payout was created (data-model.md §3.5, backstop layer). Fails with `409 SIGNATURE_MISSING` if `employee_signature_url` is null, or `409 CORRECTION_PENDING` (same shape as the `POST /payouts` error) if a new correction request appeared on a linked entry after the draft was created — this re-check closes the gap between creation and confirmation.

### `POST /payouts/:id/unlock` — `[admin]`
```json
{ "reason": "Employee reported incorrect hourly total after payout; correcting per manager approval" }
```
Requires a fresh admin session (re-auth within the last N minutes, enforced via `refresh_tokens` issued-at check) — `403 REAUTH_REQUIRED` otherwise. `200 →` sets `is_locked = false` on the payout and its entries, writes `audit_logs` (`payout_unlocked`) with the mandatory reason.

### `GET /payouts/:id/history` and `GET /employees/:id/payouts` — `[employee|admin]`
Previous payout history (employee: self only; admin: any employee).

---

## 8. PDFs

### `GET /payouts/:id/pdf` — `[employee|admin]`
```json
{ "report_id": "RPT-2026-000123", "status": "ready", "file_url": "https://.../signed-url", "generated_at": "..." }
```
`status` can be `generating` (still in the background job) or `ready`.

### `GET /pdf-reports` — `[employee|admin]`
Query: `employee_id` (admin only), `date_from/to`. History list per requirement §11.

### `GET /pdf-reports/:report_id` — `[employee|admin]`
Returns a fresh time-limited signed download URL (never a permanent public link, per the PDF-protection security requirement).

---

## 9. Notifications

| Method & Path | Role | Notes |
|---|---|---|
| `GET /notifications` | `[employee\|admin]` | `?unread_only=true`; own notifications only |
| `PATCH /notifications/:id/read` | `[employee\|admin]` | |
| `POST /device-tokens` | `[employee\|admin]` | `{ "push_token": "...", "platform": "ios" }` — registers for FCM |
| `DELETE /device-tokens/:id` | `[employee\|admin]` | on logout/uninstall |

---

## 10. Dashboard

### `GET /dashboard/admin` — `[admin]`
```json
{ "today_submitted_hours": 42.5, "pending_approvals": 6, "employees_scheduled_today": 5,
  "weekly_shift_summary": { "morning": 7, "evening": 6 }, "total_approved_hours_period": 312.0,
  "recent_payouts": [ /* last 5 payout summaries */ ], "employees_missing_entries_today": ["uuid"],
  "pending_correction_requests": 2, "payroll_amount_summary": { "period": "2026-06-29–2026-07-05", "total": 8420.00 } }
```

### `GET /dashboard/employee` — `[employee]`
```json
{ "upcoming_shifts": [ /* next 7 days */ ], "recent_submissions": [ /* last 5 entries */ ],
  "pending_correction_requests": 0, "last_payout": { "id": "uuid", "paid_at": "...", "amount": 850.00 } }
```

---

## 11. Search, Filter & Export

### `GET /reports/search` — `[admin]`
Query: `employee_id`, `date_from`, `date_to`, `shift_type`, `approval_status`, `payment_status`. Returns paginated `timesheet_entries` joined with employee name and payout status.

### `POST /reports/export` — `[admin]`
```json
{ "format": "xlsx", "filters": { "date_from": "2026-06-01", "date_to": "2026-06-30", "approval_status": "approved" } }
```
`202 → { "job_id": "uuid", "status": "processing" }` — creates an `export_jobs` row (auditable).

### `GET /reports/export/:job_id` — `[admin]`
`200 → { "status": "completed", "file_url": "https://.../signed-url" }`

---

## 12. Notes on cross-cutting concerns

- **Rate limiting:** `/auth/*` OTP endpoints should be rate-limited per phone/email (e.g., 5/hour) to prevent SMS-bombing abuse of the Twilio integration.
- **Idempotency:** `POST /timesheets` and `/timesheets/sync` accept `client_generated_id` specifically so a flaky mobile connection retrying a submit never creates duplicate entries.
- **Session timeout:** access tokens are short-lived (15 min); `refresh_token` TTL differs by role — `admin_session_timeout_minutes` / `employee_session_timeout_minutes` from `restaurant_settings` drive refresh-token expiry, satisfying the admin session-timeout security requirement.
- **Versioning:** `/api/v1` prefix now so breaking changes later (e.g., if multi-location support is ever added) can ship as `/api/v2` without disrupting the released mobile app.
