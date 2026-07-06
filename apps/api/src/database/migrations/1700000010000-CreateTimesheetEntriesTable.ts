import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.7 and §3.1 (5-minute edit lock).
//
// `total_hours` and `lock_expires_at` are plain columns computed by the
// application at write time (data-model.md: "computed at write time" /
// "generated as"), not Postgres GENERATED ALWAYS AS ... STORED columns —
// Postgres classifies `timestamptz - timestamptz` as STABLE, not
// IMMUTABLE (timezone-dependent), so it's rejected as a generation
// expression ("generation expression is not immutable"). The app must
// (re)compute total_hours on every create/edit of time_in/time_out, and
// set lock_expires_at = submitted_at + 5 minutes once at create — "locked"
// is still evaluated purely as now() > lock_expires_at on read, never a
// background job flipping a boolean, matching the doc's intent.
export class CreateTimesheetEntriesTable1700000010000 implements MigrationInterface {
  name = "CreateTimesheetEntriesTable1700000010000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE timesheet_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id uuid NOT NULL REFERENCES users(id),
        shift_assignment_id uuid REFERENCES shift_assignments(id),
        shift_date date NOT NULL,
        shift_type shift_type NOT NULL,
        time_in timestamptz NOT NULL,
        time_out timestamptz NOT NULL,
        total_hours numeric(5,2) NOT NULL,
        notes text,
        status timesheet_status NOT NULL DEFAULT 'pending',
        -- server clock only, per PROJECT.md non-negotiable rule #1 — never
        -- trust a client-claimed timestamp for starting the lock window,
        -- including for offline entries synced later (data-model.md §3.1).
        submitted_at timestamptz NOT NULL DEFAULT now(),
        lock_expires_at timestamptz NOT NULL,
        is_payout_locked boolean NOT NULL DEFAULT false,
        locked_by_payout_id uuid REFERENCES payroll_payouts(id),
        reviewed_by uuid REFERENCES users(id),
        reviewed_at timestamptz,
        entry_source entry_source NOT NULL DEFAULT 'online',
        client_generated_id uuid UNIQUE,
        synced_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        -- open question §5.1 (overnight shifts) applies here too; revisit
        -- once decided.
        CONSTRAINT timesheet_entries_time_out_after_time_in
          CHECK (time_out > time_in)
      );
    `);

    // One active entry per employee per shift slot per day; a rejected
    // entry can be resubmitted (data-model.md §2.7).
    await queryRunner.query(`
      CREATE UNIQUE INDEX timesheet_entries_unique_active_slot
        ON timesheet_entries (employee_id, shift_date, shift_type)
        WHERE status <> 'rejected';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS timesheet_entries;`);
  }
}
