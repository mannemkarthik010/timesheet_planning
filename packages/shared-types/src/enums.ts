// Mirrors the enum(...) columns defined in /docs/data-model.md exactly —
// field/value names are never renamed between DB, API, and client.

export const UserRole = { EMPLOYEE: "employee", ADMIN: "admin" } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const LoginStatus = { ACTIVE: "active", DEACTIVATED: "deactivated" } as const;
export type LoginStatus = (typeof LoginStatus)[keyof typeof LoginStatus];

export const RegistrationSource = {
  SELF_REGISTERED: "self_registered",
  ADMIN_INVITED: "admin_invited",
} as const;
export type RegistrationSource = (typeof RegistrationSource)[keyof typeof RegistrationSource];

export const EmploymentStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  TERMINATED: "terminated",
} as const;
export type EmploymentStatus = (typeof EmploymentStatus)[keyof typeof EmploymentStatus];

export const ScheduleStatus = { DRAFT: "draft", PUBLISHED: "published" } as const;
export type ScheduleStatus = (typeof ScheduleStatus)[keyof typeof ScheduleStatus];

export const ShiftType = { MORNING: "morning", EVENING: "evening" } as const;
export type ShiftType = (typeof ShiftType)[keyof typeof ShiftType];

export const TimesheetStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CORRECTED: "corrected",
} as const;
export type TimesheetStatus = (typeof TimesheetStatus)[keyof typeof TimesheetStatus];

export const EntrySource = { ONLINE: "online", OFFLINE_SYNCED: "offline_synced" } as const;
export type EntrySource = (typeof EntrySource)[keyof typeof EntrySource];

export const CorrectionOrigin = {
  EMPLOYEE_SUBMITTED: "employee_submitted",
  AUTO_CONVERTED_OFFLINE_EDIT: "auto_converted_offline_edit",
} as const;
export type CorrectionOrigin = (typeof CorrectionOrigin)[keyof typeof CorrectionOrigin];

export const CorrectionStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;
export type CorrectionStatus = (typeof CorrectionStatus)[keyof typeof CorrectionStatus];

export const PeriodType = {
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  MONTHLY: "monthly",
  CUSTOM: "custom",
} as const;
export type PeriodType = (typeof PeriodType)[keyof typeof PeriodType];

export const PayoutStatus = {
  DRAFT: "draft",
  PENDING_SIGNATURE: "pending_signature",
  PAID: "paid",
  VOIDED: "voided",
} as const;
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];

// data-model.md §2.12 gives an illustrative, non-exhaustive list ("etc.").
// This is the full set implemented so far; adding a new action type is an
// additive migration (ALTER TYPE ... ADD VALUE), not a breaking change.
export const AuditActionType = {
  TIMESHEET_SUBMIT: "timesheet_submit",
  TIMESHEET_EDIT_EMPLOYEE: "timesheet_edit_employee",
  TIMESHEET_EDIT_ADMIN: "timesheet_edit_admin",
  CORRECTION_REQUEST_CREATED: "correction_request_created",
  CORRECTION_REQUEST_REVIEWED: "correction_request_reviewed",
  CORRECTION_REQUEST_AUTO_REJECTED_PAYOUT_LOCKED: "correction_request_auto_rejected_payout_locked",
  OFFLINE_EDIT_CONVERTED_TO_CORRECTION: "offline_edit_converted_to_correction",
  APPROVAL: "approval",
  REJECTION: "rejection",
  SCHEDULE_PUBLISHED: "schedule_published",
  PAYOUT_CREATED: "payout_created",
  PAYOUT_SIGNED: "payout_signed",
  PAYOUT_PAID: "payout_paid",
  PAYOUT_UNLOCKED: "payout_unlocked",
  PDF_GENERATED: "pdf_generated",
  EMPLOYEE_DEACTIVATED: "employee_deactivated",
  EMPLOYEE_INVITED: "employee_invited",
  LOGIN: "login",
} as const;
export type AuditActionType = (typeof AuditActionType)[keyof typeof AuditActionType];

// data-model.md §2.13 says notification `type` "mirrors the trigger list in
// the requirement doc (§14)" — that doc isn't in /docs, so `type` is kept as
// free-form text (see entities.ts) rather than inventing an enum here.

export const NotificationChannel = {
  IN_APP: "in_app",
  PUSH: "push",
  SMS: "sms",
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const DevicePlatform = { IOS: "ios", ANDROID: "android" } as const;
export type DevicePlatform = (typeof DevicePlatform)[keyof typeof DevicePlatform];

export const ExportFormat = { PDF: "pdf", XLSX: "xlsx", CSV: "csv" } as const;
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const ExportStatus = {
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export type ExportStatus = (typeof ExportStatus)[keyof typeof ExportStatus];
