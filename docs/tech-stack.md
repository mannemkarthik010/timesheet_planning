# Tech Stack Recommendation
Restaurant Timesheet, Scheduling & Payroll App — iOS + Android

**Scope assumptions locked in for this document** (confirmed with stakeholder on 2026-07-06):
- Single restaurant, single location (not multi-tenant SaaS).
- Payouts are record-only — the app confirms and documents a payment made outside the app (cash/check/external payroll); no money-movement/disbursement integration.
- Employee accounts support both self-registration and admin-invite, reconciled by the admin.
- Payroll math is raw-hours-only for v1 — no automatic overtime/meal-break calculation; admin enters the final payment amount manually.

---

## 1. Mobile Framework: **React Native (with Expo, bare/dev-client workflow)**

**Why:**
- Single codebase for iOS + Android is the main cost/time driver here — this is a small internal-style business app, not a graphics-heavy consumer product, so a native-per-platform approach (Swift + Kotlin) would roughly double build and QA effort for no real UX benefit.
- Needs several device-native capabilities — push notifications, offline local storage/sync, signature capture (touch drawing), camera/logo upload, background reminders — all of which have mature, actively maintained React Native libraries.
- Expo's managed/dev-client workflow gives fast OTA updates for bug fixes (important for a payroll-adjacent app where a calculation bug needs a same-day fix without waiting on App Store review) while still allowing custom native modules via a dev client when needed (e.g., signature pad, SMS/OTP autofill).
- Large hiring pool and long-term maintenance story compared to Flutter; easier to find contractors later if the original developer moves on.

**Alternative considered:** Flutter — equally valid technically (single codebase, good offline story via `sqflite`/`drift`, good signature-pad packages). React Native is preferred here mainly because of JS/TS ecosystem overlap with the backend (shared types/validation logic between mobile and API) and marginally larger talent pool for a solo/small-team project. If the team already has Dart/Flutter expertise, Flutter is an equally reasonable choice — flag if that's the case.

**Alternative rejected:** Fully native (Swift/SwiftUI + Kotlin/Compose) — better raw performance and platform idiom, but doubles the build surface for a CRUD-and-forms app where that performance ceiling is never approached. Not worth it here.

---

## 2. Backend: **Node.js + NestJS (TypeScript), deployed as a containerized service**

**Why:**
- TypeScript end-to-end (React Native + NestJS) lets request/response DTOs and validation schemas (e.g., Zod) be shared or at least structurally mirrored between mobile and API, cutting down on integration bugs — important given payroll correctness is high-stakes.
- NestJS gives you batteries-included structure (modules, guards, interceptors) that maps cleanly onto this app's needs: role-based guards for Employee vs Admin, interceptors for audit logging (see data-model.md), and a clean place to hang webhook-style jobs (reminders, scheduled digests).
- Mature ecosystem for exactly the pieces this app needs: `@nestjs/schedule` for missed-entry reminders and locked-period jobs, Passport strategies for email/password + OTP, Bull/BullMQ for background jobs (PDF generation, SMS sending) so those don't block API requests.
- Deploying as a container (Docker) on a managed platform (Render, Railway, AWS ECS/Fargate, or Fly.io) keeps infra simple for a single-location restaurant while leaving room to scale if the "multi-location" future path is ever revisited.

**Alternative considered:** Firebase (Cloud Functions + Firestore) as a fully managed BaaS — faster initial setup, but Firestore's document model and query limitations make the relational reporting this app needs (date-range payroll reports, joins across shifts/timesheets/employees, audit trails) noticeably more awkward, and its rules-based security model is harder to reason about for the payout-locking and audit requirements than an explicit application-layer authorization service. Better fit for MVPs without complex reporting; not the better fit here.

---

## 3. Database: **PostgreSQL** (managed — e.g., AWS RDS, Supabase, or Neon)

**Why:**
- The domain is inherently relational: employees, shifts, timesheet entries, approvals, correction requests, payroll periods, payouts, and audit logs all reference each other with real foreign-key constraints (see data-model.md) — exactly what a relational database enforces well and a document store does not.
- Strong support for the constraints this app specifically needs: row-level `CHECK` constraints (e.g., time_out > time_in), unique constraints (one payout per employee per period), and transactional guarantees (a payout must lock the period, write the audit record, and mark the PDF generated atomically).
- Native support for range types and date arithmetic (useful for the 5-minute edit-lock window and custom date-range reporting) and mature full-text/trigram search extensions (`pg_trgm`) for the search/filter feature.
- Managed Postgres options (Supabase, Neon, RDS) all provide automatic backups and point-in-time recovery out of the box, which satisfies the "Cloud Backup" security requirement without custom tooling.

**Alternative considered:** MySQL — also a fine relational choice; Postgres is preferred for its richer constraint/type system (range types, `CHECK` constraints across columns, better JSON support for flexible fields like "adjustment notes").

---

## 4. PDF Generation: **Server-side, using Puppeteer (HTML/CSS → PDF) or `pdf-lib` for programmatic assembly**

**Why:**
- PDFs must be generated server-side (not on-device) because they need to be stored in both the employee's and admin's records and be reproducible/auditable independent of any one device — and because report assembly pulls data across employee, shift, timesheet, and payout tables that shouldn't be joined and serialized on a phone.
- **Recommended approach:** render an HTML/CSS template (using the restaurant's branding — logo, name, address, footer) with a headless Chromium instance via Puppeteer, then output PDF. This is the fastest way to get a professional-looking, branded, precisely-laid-out report (tables of date-wise shifts, signature image embed, report ID footer) without hand-coding PDF layout primitives.
- **Alternative within the same server:** `pdf-lib` (pure JS/TS, no headless browser dependency) is lighter-weight and faster if the report layout stays simple; worth switching to if Puppeteer's memory footprint becomes a concern on a small server instance. Start with Puppeteer for layout speed; migrate to `pdf-lib` only if it becomes an infra bottleneck.
- Run PDF generation as a background job (BullMQ) triggered right after the payout signature is captured, so the API request that finalizes a payout returns quickly and the PDF (which can take a few seconds) is generated asynchronously and pushed as a notification when ready.

---

## 5. SMS Provider: **Twilio**

**Why:**
- Needed for two distinct features: (1) transactional SMS confirmation after each timesheet submission, and (2) phone-number OTP as a login option. Twilio supports both a general Programmable SMS API and a purpose-built Verify API for OTP, so one vendor covers both needs instead of stitching together two providers.
- Reliable US carrier delivery and straightforward per-message pricing, which matters since submission-confirmation SMS could fire twice a day per employee — costs stay predictable and easy to project against a small headcount.
- Well-documented Node.js SDK integrates cleanly with the NestJS background-job queue (send SMS as an async job so a delivery hiccup never blocks the timesheet-submission API response).

**Alternative considered:** AWS SNS — cheaper at high volume but weaker built-in OTP tooling (Verify-equivalent) and less mature delivery-status webhooks; Twilio's better developer experience and Verify API make it the better fit for a small-to-mid volume app like this one.

**Flag:** the requirement doc doesn't say whether phone numbers are US-only. Twilio works internationally but per-country carrier support and cost vary — worth confirming if any employees have non-US numbers.

---

## 6. Signature Capture: **`react-native-signature-canvas`** (client-side canvas, image uploaded to cloud storage)

**Why:**
- Purpose-built, actively maintained React Native library for exactly this use case (touch-drawn signature → base64 PNG/SVG export); avoids building custom `PanResponder`/canvas drawing logic from scratch.
- Signature is captured on-device at the moment of payout confirmation, exported as a PNG, uploaded to cloud storage, and the resulting URL is stored on the payout record and embedded into the generated PDF — keeping the signature image as durable evidence tied to a specific payout, not just a "signed: true" boolean.
- Works within Expo's dev-client workflow (it's a JS/WebView-based canvas, not a custom native module), keeping it compatible with the React Native + Expo choice above.

---

## 7. Cloud Storage: **AWS S3** (or S3-compatible — Cloudflare R2 as a lower-cost alternative)

**Why:**
- Stores two categories of files: signature images and generated PDF reports (plus optionally the restaurant's logo asset). Both are write-once, read-many, rarely-updated binary blobs — the textbook use case for object storage rather than storing binaries in the relational database.
- Private buckets with signed, time-limited URLs (`GetObjectCommand` + `getSignedUrl`) enforce the "employees see only their own PDFs, admin sees all" access rule at the storage layer as a second line of defense, in addition to the API-level authorization check.
- Encryption at rest (SSE-S3 or SSE-KMS) satisfies the "Data Encryption" and "PDF Protection" security requirements directly; versioning can be enabled on the bucket as extra protection against accidental overwrite of a finalized payout PDF.
- Cloudflare R2 is a viable cost-optimization swap later (S3-compatible API, no egress fees) if PDF/download volume grows — no code change needed beyond endpoint/credentials since it speaks the S3 API.

---

## 8. Supporting Choices (brief)

- **Push notifications:** Firebase Cloud Messaging (FCM) — the de facto standard for cross-platform (iOS + Android) push from a single backend integration, needed regardless of Expo/RN choice for APNs token relay.
- **Authentication:** Passport.js strategies in NestJS — local (email/password) + a custom OTP strategy (Twilio Verify) + JWT (short-lived access token + refresh token), with a mandatory second OTP step gating admin login (2FA requirement).
- **Offline sync:** local SQLite on-device (`expo-sqlite` or `op-sqlite`) as a write-ahead queue; a lightweight `synced: boolean` + `client_generated_id` (UUID) pattern reconciles offline-created timesheet entries with the server once connectivity returns (see data-model.md for the field-level design).
- **Background jobs / scheduling:** BullMQ (Redis-backed) inside the NestJS service for: missed-entry reminders, SMS/PDF generation, and the 5-minute-edit-lock transition (a job that flips `is_locked` on a timer, described in data-model.md).
- **Hosting:** any container platform (Render, Railway, Fly.io, or AWS ECS/Fargate) plus managed Postgres and Redis add-ons — sized appropriately for single-restaurant load; no need for Kubernetes-scale infrastructure at this stage.

---

## Open items that affect this stack (see full list in the chat response)

- Whether any employee has a non-US phone number (affects Twilio country coverage/cost).
- Whether the team has existing Flutter expertise that would flip the mobile-framework recommendation.
- Expected data retention period for old PDFs/audit logs (affects S3 lifecycle/archival policy, not a blocker to start building).
