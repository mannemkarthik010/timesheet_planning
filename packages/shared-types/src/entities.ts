// Field names mirror /docs/data-model.md column names 1:1 — never renamed
// between DB, API, and client (PROJECT.md "Coding standards"). These are
// the shapes shared between apps/api entities and apps/mobile; no business
// logic lives here.

import type {
  UserRole,
  LoginStatus,
  RegistrationSource,
  EmploymentStatus,
  ScheduleStatus,
  ShiftType,
  TimesheetStatus,
  EntrySource,
  CorrectionOrigin,
  CorrectionStatus,
  PeriodType,
  PayoutStatus,
  AuditActionType,
  NotificationChannel,
  DevicePlatform,
  ExportFormat,
  ExportStatus,
} from "./enums";

export interface User {
  id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  password_hash: string | null;
  otp_enabled: boolean;
  login_status: LoginStatus;
  registration_source: RegistrationSource;
  invited_by_user_id: string | null;
  invitation_token_hash: string | null;
  invitation_expires_at: string | null;
  is_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeProfile {
  user_id: string;
  job_role: string | null;
  hourly_rate: string | null;
  joining_date: string;
  employment_status: EmploymentStatus;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  employee_code: string;
}

export interface RestaurantSettings {
  id: string;
  restaurant_name: string;
  logo_url: string | null;
  address: string;
  contact_phone: string;
  contact_email: string;
  pdf_footer_message: string | null;
  missed_entry_reminder_time: string | null;
  show_team_schedule_to_employees: boolean;
  admin_session_timeout_minutes: number;
  employee_session_timeout_minutes: number;
}

export interface ShiftSchedule {
  id: string;
  week_start_date: string;
  status: ScheduleStatus;
  published_at: string | null;
  published_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftAssignment {
  id: string;
  schedule_id: string;
  employee_id: string;
  shift_date: string;
  shift_type: ShiftType;
  planned_start_time: string;
  planned_end_time: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAvailability {
  id: string;
  employee_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_until: string | null;
}

export interface TimesheetEntry {
  id: string;
  employee_id: string;
  shift_assignment_id: string | null;
  shift_date: string;
  shift_type: ShiftType;
  time_in: string;
  time_out: string;
  total_hours: string;
  notes: string | null;
  status: TimesheetStatus;
  submitted_at: string;
  lock_expires_at: string;
  is_payout_locked: boolean;
  locked_by_payout_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  entry_source: EntrySource;
  client_generated_id: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrectionRequestProposedChanges {
  time_in?: string;
  time_out?: string;
  shift_type?: ShiftType;
  notes?: string;
}

export interface CorrectionRequest {
  id: string;
  timesheet_entry_id: string;
  requested_by: string;
  proposed_changes: CorrectionRequestProposedChanges;
  reason: string;
  origin: CorrectionOrigin;
  status: CorrectionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
}

export interface PayrollPayout {
  id: string;
  employee_id: string;
  period_type: PeriodType;
  period_start_date: string;
  period_end_date: string;
  total_approved_hours: string;
  hourly_rate_snapshot: string | null;
  suggested_pay: string | null;
  final_payment_amount: string;
  previous_unpaid_hours: string;
  adjustment_notes: string | null;
  status: PayoutStatus;
  processed_by: string;
  employee_signature_url: string | null;
  employee_signed_at: string | null;
  admin_confirmed_at: string | null;
  paid_at: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayoutLineItem {
  id: string;
  payout_id: string;
  timesheet_entry_id: string;
}

export interface PdfReport {
  id: string;
  report_id: string;
  payout_id: string;
  employee_id: string;
  file_url: string;
  restaurant_snapshot: Record<string, unknown>;
  generated_by: string | null;
  generated_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  action_type: AuditActionType;
  entity_type: string;
  entity_id: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason_note: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  channel: NotificationChannel;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DeviceToken {
  id: string;
  user_id: string;
  push_token: string;
  platform: DevicePlatform;
  last_used_at: string;
  created_at: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ExportJob {
  id: string;
  requested_by: string;
  export_format: ExportFormat;
  filter_params: Record<string, unknown>;
  file_url: string | null;
  status: ExportStatus;
  created_at: string;
  completed_at: string | null;
}
