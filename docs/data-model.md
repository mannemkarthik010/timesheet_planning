# Data Model
Restaurant Timesheet, Scheduling & Payroll App

Target: PostgreSQL. Scope: single restaurant (no tenant_id needed — see `restaurant_settings` as a singleton table instead of a multi-tenant `restaurants` table). All timestamps are `timestamptz` (UTC storage, local-time display). All primary keys are `uuid` (`gen_random_uuid()`) unless noted, so client-generated IDs (needed for offline entry sync) can be created before the row ever reaches the server.

---

## 1. Entity list (overview)

`users`, `employee_profiles`, `restaurant_settings`, `shift_schedules`, `shift_assignments`, `employee_availability`, `timesheet_entries`, `correction_requests`, `payroll_payouts`, `payout_line_items`, `pdf_reports`, `audit_logs`, `notifications`, `device_tokens`, `refresh_tokens`, `export_jobs`.

---

## 2. Table definitions

### 2.1 `users`
Shared identity table for both roles (employee and admin). Role-specific attributes live in `employee_profiles`.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| role | enum(`employee`,`admin`) | NOT NULL |
| full_name | text | NOT NULL |
| email | citext | UNIQUE, nullable (see note below) |
| phone_number | text | UNIQUE, nullable |
| password_hash | text | nullable (null if account not yet activated) |
| otp_enabled | boolean | NOT NULL DEFAULT false — forced `true` for role=`admin` (2FA requirement) |
| login_status | enum(`active`,`deactivated`) | NOT NULL DEFAULT `active` |
| registration_source | enum(`self_registered`,`admin_invited`) | NOT NULL |
| invited_by_user_id | uuid | FK → users.id, nullable |
| invitation_token_hash | text | nullable, unique when not null |
| invitation_expires_at | timestamptz | nullable |
| is_verified | boolean | NOT NULL DEFAULT false — true once email/phone verified or invite accepted |
| last_login_at | timestamptz | nullable |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

Constraints:
- `CHECK (email IS NOT NULL OR phone_number IS NOT NULL)` — at least one contact method required (login supports email/password or phone OTP).
- Deactivation is soft (`login_status = 'deactivated'`), never a row delete — timesheets, payouts, and audit entries must keep a valid FK to the user permanently.

### 2.2 `employee_profiles`
One row per user with `role = 'employee'`.

| Field | Type | Constraints |
|---|---|---|
| user_id | uuid | PK, FK → users.id |
| job_role | text | nullable (e.g., "Server", "Line Cook") |
| hourly_rate | numeric(10,2) | nullable ("if applicable" per doc) |
| joining_date | date | NOT NULL |
| employment_status | enum(`active`,`inactive`,`terminated`) | NOT NULL DEFAULT `active` |
| emergency_contact_name | text | nullable |
| emergency_contact_phone | text | nullable |
| employee_code | text | UNIQUE, NOT NULL — human-readable ID shown on PDFs (e.g., `EMP-0007`) |

### 2.3 `restaurant_settings`
Singleton (application enforces exactly one row) holding branding and business-wide config, since this is a single-restaurant deployment.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| restaurant_name | text | NOT NULL |
| logo_url | text | nullable |
| address | text | NOT NULL |
| contact_phone | text | NOT NULL |
| contact_email | text | NOT NULL |
| pdf_footer_message | text | nullable |
| missed_entry_reminder_time | time | nullable — fixed daily time to check for missing entries |
| show_team_schedule_to_employees | boolean | NOT NULL DEFAULT true — **decided default: ON.** Employees see coworkers' name, shift date, shift type, and planned time on *published* schedules only (never drafts, never historical schedules beyond the current/upcoming published weeks). Hourly rate, contact info, and any other employee-profile fields are never exposed regardless of this setting — it controls shift-grid visibility only. Admin can flip to `false` to restrict each employee to their own shifts only. |
| admin_session_timeout_minutes | int | NOT NULL DEFAULT 15 |
| employee_session_timeout_minutes | int | NOT NULL DEFAULT 60 |

### 2.4 `shift_schedules`
One row per calendar week — a container that can be draft or published.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| week_start_date | date | NOT NULL, UNIQUE — Monday (or configured week start) of the scheduled week |
| status | enum(`draft`,`published`) | NOT NULL DEFAULT `draft` |
| published_at | timestamptz | nullable |
| published_by | uuid | FK → users.id, nullable |
| created_by | uuid | FK → users.id, NOT NULL |
| created_at / updated_at | timestamptz | NOT NULL |

### 2.5 `shift_assignments`
Individual assigned shifts within a weekly schedule (the drag-and-drop grid cells).

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| schedule_id | uuid | FK → shift_schedules.id, NOT NULL |
| employee_id | uuid | FK → users.id, NOT NULL |
| shift_date | date | NOT NULL |
| shift_type | enum(`morning`,`evening`) | NOT NULL |
| planned_start_time | time | NOT NULL |
| planned_end_time | time | NOT NULL |
| created_at / updated_at | timestamptz | NOT NULL |

Constraints:
- `UNIQUE (employee_id, shift_date, shift_type)` — prevents assigning the same employee twice to the same shift slot (doc does allow multiple *different* employees on one shift, which this constraint permits since it's keyed per-employee).
- `CHECK (planned_end_time > planned_start_time)` — see open question about overnight shifts below.

### 2.6 `employee_availability` *(optional feature — doc says "if added")*

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| employee_id | uuid | FK → users.id, NOT NULL |
| day_of_week | smallint | NOT NULL CHECK (0–6) |
| start_time | time | NOT NULL |
| end_time | time | NOT NULL |
| effective_from | date | NOT NULL |
| effective_until | date | nullable |

### 2.7 `timesheet_entries`
Core record of hours worked. Every row is either employee-submitted or admin-created/edited.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| employee_id | uuid | FK → users.id, NOT NULL |
| shift_assignment_id | uuid | FK → shift_assignments.id, nullable (links back to the schedule if this entry corresponds to a planned shift) |
| shift_date | date | NOT NULL |
| shift_type | enum(`morning`,`evening`) | NOT NULL |
| time_in | timestamptz | NOT NULL |
| time_out | timestamptz | NOT NULL |
| total_hours | numeric(5,2) | NOT NULL — computed at write time as `EXTRACT(EPOCH FROM (time_out - time_in)) / 3600` |
| notes | text | nullable |
| status | enum(`pending`,`approved`,`rejected`,`corrected`) | NOT NULL DEFAULT `pending` |
| submitted_at | timestamptz | NOT NULL DEFAULT now() — **server** timestamp, not client-supplied, even for offline-created entries (see 3.1) |
| lock_expires_at | timestamptz | NOT NULL, generated as `submitted_at + interval '5 minutes'` |
| is_payout_locked | boolean | NOT NULL DEFAULT false |
| locked_by_payout_id | uuid | FK → payroll_payouts.id, nullable |
| reviewed_by | uuid | FK → users.id, nullable |
| reviewed_at | timestamptz | nullable |
| entry_source | enum(`online`,`offline_synced`) | NOT NULL DEFAULT `online` |
| client_generated_id | uuid | UNIQUE, nullable — set by the mobile app at creation time so offline entries can dedupe safely on sync |
| synced_at | timestamptz | nullable — null while an offline entry is queued locally |
| created_at / updated_at | timestamptz | NOT NULL |

Constraints:
- `CHECK (time_out > time_in)` for same-day shifts. **(See open question 3 below on overnight shifts.)**
- `UNIQUE (employee_id, shift_date, shift_type)` for entries with `status <> 'rejected'` (partial unique index) — one active entry per employee per shift slot per day; a rejected entry can be resubmitted.
- Row-level edit rule (enforced in the application layer, not purely by the DB, since it depends on *who* is editing):
  - Employee may `UPDATE` only while `now() < lock_expires_at` **and** `is_payout_locked = false` **and** `employee_id = current_user`.
  - Admin may `UPDATE` at any time, **except** when `is_payout_locked = true`, which additionally requires an explicit "unlock for correction" admin action that is itself audit-logged with a mandatory reason (see 3.4).
  - Every successful `UPDATE` (employee-in-window or admin) writes one row to `audit_logs` with previous/new value snapshots — see 3.2.

### 2.8 `correction_requests`
Employee-initiated request to change a locked entry.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| timesheet_entry_id | uuid | FK → timesheet_entries.id, NOT NULL |
| requested_by | uuid | FK → users.id, NOT NULL |
| proposed_changes | jsonb | NOT NULL — subset of `{time_in, time_out, shift_type, notes}` |
| reason | text | NOT NULL |
| origin | enum(`employee_submitted`,`auto_converted_offline_edit`) | NOT NULL DEFAULT `employee_submitted` — see 3.6 |
| status | enum(`pending`,`approved`,`rejected`) | NOT NULL DEFAULT `pending` |
| reviewed_by | uuid | FK → users.id, nullable — **null when `status` was set by the system** (auto-rejection on payout lock, 3.5) rather than an admin |
| reviewed_at | timestamptz | nullable |
| admin_note | text | nullable — system-generated auto-rejections populate this with a standard explanatory message (see 3.5) |
| created_at | timestamptz | NOT NULL |

Constraint: `CHECK (jsonb_object_keys(proposed_changes) are a subset of allowed set)` enforced at the application layer (Postgres doesn't easily constrain JSONB key sets, so this is an API-level validation, not a DB constraint — flagged so it isn't silently assumed to be DB-enforced).

### 2.9 `payroll_payouts`
One row per employee per pay period. This is the unit that gets locked once paid.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| employee_id | uuid | FK → users.id, NOT NULL |
| period_type | enum(`weekly`,`biweekly`,`monthly`,`custom`) | NOT NULL |
| period_start_date | date | NOT NULL |
| period_end_date | date | NOT NULL |
| total_approved_hours | numeric(6,2) | NOT NULL — sum of linked `payout_line_items` |
| hourly_rate_snapshot | numeric(10,2) | nullable — copied from `employee_profiles.hourly_rate` at creation time (so a later rate change doesn't retroactively alter historical payouts) |
| suggested_pay | numeric(10,2) | nullable — informational only (`total_approved_hours * hourly_rate_snapshot`); never authoritative |
| final_payment_amount | numeric(10,2) | NOT NULL — admin-entered, authoritative figure actually paid |
| previous_unpaid_hours | numeric(6,2) | NOT NULL DEFAULT 0 |
| adjustment_notes | text | nullable |
| status | enum(`draft`,`pending_signature`,`paid`,`voided`) | NOT NULL DEFAULT `draft` |
| processed_by | uuid | FK → users.id (admin), NOT NULL |
| employee_signature_url | text | nullable — set once signed |
| employee_signed_at | timestamptz | nullable |
| admin_confirmed_at | timestamptz | nullable |
| paid_at | timestamptz | nullable |
| is_locked | boolean | NOT NULL DEFAULT false — set true the moment the PDF is generated |
| created_at / updated_at | timestamptz | NOT NULL |

Constraints:
- `UNIQUE (employee_id, period_start_date, period_end_date)` — prevents duplicate payouts for the identical period; does **not** by itself prevent overlapping-but-not-identical custom ranges, which must be checked at the application layer before creating a `custom` payout.
- `CHECK (status <> 'paid' OR (employee_signature_url IS NOT NULL AND paid_at IS NOT NULL))` — payout cannot be marked paid without a captured signature, matching "payout should not be completed until the worker signs."
- Once `is_locked = true`, any further change requires the same admin-authorization + audit-log-with-reason flow as a locked timesheet entry (see 3.4).

### 2.10 `payout_line_items`
Explicit join between a payout and the exact timesheet entries it covers — captured at payout-creation time so the PDF and the underlying data stay consistent even if new entries are added to that date range later.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| payout_id | uuid | FK → payroll_payouts.id, NOT NULL |
| timesheet_entry_id | uuid | FK → timesheet_entries.id, NOT NULL |

Constraint: `UNIQUE (payout_id, timesheet_entry_id)`.

### 2.11 `pdf_reports`

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| report_id | text | UNIQUE, NOT NULL — human-readable (e.g., `RPT-2026-000123`) |
| payout_id | uuid | FK → payroll_payouts.id, NOT NULL |
| employee_id | uuid | FK → users.id, NOT NULL |
| file_url | text | NOT NULL — cloud storage location |
| restaurant_snapshot | jsonb | NOT NULL — copy of `restaurant_settings` branding fields at generation time |
| generated_by | uuid | FK → users.id, nullable (null = system-generated background job) |
| generated_at | timestamptz | NOT NULL |

### 2.12 `audit_logs`
Append-only. No `UPDATE`/`DELETE` grants at the DB role level — enforced by revoking those privileges for the application's DB user on this table (only `INSERT`/`SELECT`), so even a bug in application code cannot rewrite history.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| actor_user_id | uuid | FK → users.id, NOT NULL |
| action_type | enum | NOT NULL — `timesheet_submit`, `timesheet_edit_employee`, `timesheet_edit_admin`, `correction_request_created`, `correction_request_reviewed`, `correction_request_auto_rejected_payout_locked`, `offline_edit_converted_to_correction`, `approval`, `rejection`, `schedule_published`, `payout_created`, `payout_signed`, `payout_paid`, `payout_unlocked`, `pdf_generated`, `employee_deactivated`, `login`, etc. |
| entity_type | text | NOT NULL — e.g., `timesheet_entry`, `payroll_payout` |
| entity_id | uuid | NOT NULL |
| previous_value | jsonb | nullable |
| new_value | jsonb | nullable |
| reason_note | text | nullable — **NOT NULL enforced at application layer specifically for `payout_unlocked` and any edit to a payout-locked entry** |
| created_at | timestamptz | NOT NULL DEFAULT now() |

Index: `(entity_type, entity_id, created_at)` for fast per-record history lookups; `(actor_user_id, created_at)` for per-user activity review.

### 2.13 `notifications`

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, NOT NULL |
| type | enum | NOT NULL — mirrors the trigger list in the requirement doc (§14) |
| title | text | NOT NULL |
| body | text | NOT NULL |
| related_entity_type | text | nullable |
| related_entity_id | uuid | nullable |
| channel | enum(`in_app`,`push`,`sms`) | NOT NULL |
| sent_at | timestamptz | nullable |
| read_at | timestamptz | nullable |
| created_at | timestamptz | NOT NULL |

### 2.14 `device_tokens`

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, NOT NULL |
| push_token | text | UNIQUE, NOT NULL |
| platform | enum(`ios`,`android`) | NOT NULL |
| last_used_at | timestamptz | NOT NULL |
| created_at | timestamptz | NOT NULL |

### 2.15 `refresh_tokens`
Backs session-timeout enforcement (security requirement §8).

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, NOT NULL |
| token_hash | text | UNIQUE, NOT NULL |
| expires_at | timestamptz | NOT NULL |
| revoked_at | timestamptz | nullable |
| ip_address | inet | nullable |
| user_agent | text | nullable |
| created_at | timestamptz | NOT NULL |

### 2.16 `export_jobs`
Logs ad-hoc admin exports (PDF/Excel/CSV from the search & filter screen) so exports of payroll data are themselves auditable.

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| requested_by | uuid | FK → users.id, NOT NULL |
| export_format | enum(`pdf`,`xlsx`,`csv`) | NOT NULL |
| filter_params | jsonb | NOT NULL — snapshot of the filters used |
| file_url | text | nullable |
| status | enum(`processing`,`completed`,`failed`) | NOT NULL DEFAULT `processing` |
| created_at / completed_at | timestamptz | |

---

## 3. Cross-cutting business rules (explicitly called out per the request)

### 3.1 5-minute edit lock
- `timesheet_entries.lock_expires_at` is derived from `submitted_at + 5 minutes` at write time — not a background job flipping a boolean, since "locked" is purely a function of elapsed time and computing it on read (`now() > lock_expires_at`) avoids clock-drift bugs from a cron job running slightly late.
- Critically, `submitted_at` must be the **server's** clock, assigned when the row is actually persisted — including for the **initial create** of offline entries synced later. An offline entry's on-device capture timestamp is stored separately (`device_captured_at` on the sync payload, not persisted as the authoritative clock) but **does not** start the 5-minute window; the window starts at successful server sync, so a freshly-synced create always gets a full, fresh 5 minutes. This deliberately avoids trusting client clocks for the *create* case, where trusting them would be easy to bypass and only benefits the honest case (a real connectivity gap) at no security cost, since the window is short and low-stakes either way.
- This "anchor to sync time" rule applies cleanly to creates. It does **not**, by itself, resolve what happens when an **edit** to an already-synced entry is made offline and arrives late — that race is handled explicitly in 3.6, because a naive client-clock anchor there is exploitable in a way the create case isn't.
- API layer re-validates `now() < lock_expires_at` on every edit attempt server-side — the mobile app's local countdown UI is a convenience, never the authority.

### 3.2 Audit logging
- Every mutation covered by the requirement doc's audit list (§6) writes to `audit_logs` in the **same transaction** as the mutation itself, so an edit can never succeed without a corresponding log row (e.g., in NestJS, both writes happen inside one `queryRunner` transaction).
- `audit_logs` has `INSERT`-only DB privileges for the application role — no `UPDATE`/`DELETE` — making tampering require actual superuser DB access rather than an application bug or compromised admin session.
- `previous_value`/`new_value` store full-row JSON snapshots (not just the changed field) so history reconstruction never depends on diffing logic changing over time.

### 3.3 Role-based access control
- `users.role` plus employee/admin-only foreign keys (`employee_id` fields) are the primary enforcement point at the API layer (NestJS guards check role + resource ownership on every request — see api-contract.md).
- As defense-in-depth, Postgres Row-Level Security (RLS) policies are recommended on `timesheet_entries`, `payroll_payouts`, and `pdf_reports`: a policy restricting `SELECT`/`UPDATE` to rows where `employee_id = current_setting('app.current_user_id')` unless the connecting role carries an `admin` claim. This means even a bug in application-layer authorization logic can't leak another employee's payroll data through a raw query.

### 3.4 Payout locking
- `payroll_payouts.is_locked` flips to `true` the instant `pdf_reports` gets its row for that payout (same transaction).
- Once locked, both the payout row and every linked `timesheet_entries` row (via `locked_by_payout_id` / `is_payout_locked`) reject direct edits.
- The **only** path to change a locked period is an explicit "Unlock for correction" admin action that: (a) requires re-authentication (fresh admin session, not just an active token — ties into the 2FA/session-timeout requirement), (b) requires a mandatory `reason_note`, (c) writes an audit log entry of type `payout_unlocked` **before** allowing the subsequent edit, and (d) re-locks automatically once a new PDF is regenerated. This directly implements "any future change to a paid period should require admin authorization and should be recorded in the audit log."

### 3.5 Pending correction requests vs. payout locking (race condition, decided)
A payout must never finalize while a dispute about the underlying hours is still open. Three layers, so the race can't slip through at any single point:

1. **At payout creation** (`POST /payouts`): any `timesheet_entries` row with a `correction_requests` row in `status = 'pending'` is rejected from `payout_line_items`. The create call fails with the specific blocked entry IDs listed, and the admin must either resolve the correction request first (approve/reject it) or knowingly leave that entry out of this payout — it then carries forward via `previous_unpaid_hours` on the employee's next payout.
2. **At payout confirmation** (`POST /payouts/:id/confirm`): the same check re-runs immediately before the PDF job is enqueued, to close the gap where a correction request is filed *after* the payout was created as `draft` but *before* it was confirmed. If any linked entry now has a pending request, confirmation is rejected the same way, forcing the admin to resolve it first.
3. **Backstop, at the moment `is_locked` flips true**: if a pending correction request somehow still exists on a just-locked payout's entries (should not happen given 1–2, but this is the safety net for a race between two admin sessions or a bug), the system automatically transitions it to `status = 'rejected'`, `origin` stays whatever it was, `reviewed_by = NULL`, `admin_note` is auto-filled with *"Auto-rejected: the pay period for this entry was finalized before this request could be reviewed. If a correction is still needed, ask an admin to unlock the payout."* An `audit_logs` row (`correction_request_auto_rejected_payout_locked`) is written and a notification is sent to the requesting employee so nothing is silently dropped. Reopening it requires the same admin "Unlock for correction" flow from 3.4.

### 3.6 Offline edits arriving after the lock window has already closed (decided)
This is distinct from 3.1's create-sync case. Scenario: an entry was already created (online or previously synced), the employee edits it locally while offline — in good faith, within what they believe is still their 5-minute window — but the device doesn't regain connectivity until after `lock_expires_at` (anchored to the entry's real `submitted_at`) has already passed server-side.

Trusting the device's claimed edit time here would be exploitable (an employee could always claim "I edited this seconds after I created it" regardless of when the edit really happened, since the server has no independent way to verify a client-side timestamp for an edit the same way it can anchor a *create* to its own receipt time). So edits are **never** granted extra time based on a client-claimed timestamp. Decided behavior:

- The server evaluates the offline-queued edit against the entry's real, already-established `lock_expires_at`. If `now() > lock_expires_at` at the moment the edit reaches the server, the raw edit is rejected (`403 LOCKED_ENTRY`) — same as it would be for an online employee trying to edit past the window.
- Instead of the correction silently disappearing, the sync endpoint automatically converts the rejected offline edit into a `correction_requests` row: `proposed_changes` = the edit's intended field changes, `reason` = auto-generated (*"Offline edit attempted before the 5-minute window closed, but could not sync in time."*), `origin = 'auto_converted_offline_edit'`, `status = 'pending'` — routing it into the normal admin-review queue rather than losing it.
- The sync response tells the mobile app this happened (see api-contract.md §3, `POST /timesheets/sync`) so the UI can surface "your edit is pending admin review" instead of implying it silently failed.
- An `audit_logs` row (`offline_edit_converted_to_correction`) captures both the device-claimed edit time and the server's `lock_expires_at`, so a later dispute about "I edited it in time" has a paper trail.

---

## 4. Relationships summary

- `users` 1—1 `employee_profiles` (only for role=employee)
- `users` 1—N `shift_assignments`, `timesheet_entries`, `correction_requests`, `payroll_payouts`, `notifications`, `device_tokens`, `refresh_tokens`
- `shift_schedules` 1—N `shift_assignments`
- `shift_assignments` 1—0/1 `timesheet_entries` (a submitted entry may reference the planned shift it fulfills)
- `timesheet_entries` 1—N `correction_requests`
- `timesheet_entries` N—1 `payroll_payouts` (via `payout_line_items`, N—N in practice)
- `payroll_payouts` 1—1 `pdf_reports` (one finalized PDF per payout, once locked)
- All mutating actions across the above → `audit_logs` (polymorphic via `entity_type`/`entity_id`)

---

## 5. Open questions / gaps found while modeling (please confirm)

1. **Overnight shifts:** The doc's evening-shift example plus `time_out > time_in` assumption breaks if an evening shift crosses midnight (e.g., 6pm–1am). Should `time_out` on the next calendar day be supported, and if so, is `shift_date` the date the shift *starts* or the date it's *paid against*? This affects the `CHECK` constraint and daily reporting rollups.
2. **Correction request scope:** Can an employee propose changing `shift_type` and `shift_date` via a correction request, or only `time_in`/`time_out`/`notes`? Modeled as a flexible JSONB for now — narrowing this would let it become strongly-typed columns instead.
3. **Concurrent pending correction requests:** If an entry already has a `pending` correction request, should a second one be blocked, or should the admin simply see the latest? Currently unconstrained (multiple `pending` rows allowed per entry).
4. **Custom payout period overlap:** The `UNIQUE (employee_id, period_start_date, period_end_date)` constraint stops exact duplicates but not overlapping custom ranges (e.g., Jan 1–15 and Jan 10–20 for the same employee). Should the app hard-block overlapping periods, or is it acceptable for an admin to intentionally re-run a partial period (with the "previous unpaid hours" field reconciling the difference)?
5. **Terminated employee data:** When employment_status becomes `terminated`, should the account be fully deactivated (blocked login) immediately, or kept accessible read-only so they can still view past payout PDFs? Currently modeled so `login_status` and `employment_status` are independent fields, allowing either policy — worth confirming which.
