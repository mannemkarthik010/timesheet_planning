import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.9. Created before timesheet_entries because
// timesheet_entries.locked_by_payout_id references it.
export class CreatePayrollPayoutsTable1700000009000 implements MigrationInterface {
  name = "CreatePayrollPayoutsTable1700000009000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_payouts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id uuid NOT NULL REFERENCES users(id),
        period_type period_type NOT NULL,
        period_start_date date NOT NULL,
        period_end_date date NOT NULL,
        total_approved_hours numeric(6,2) NOT NULL,
        hourly_rate_snapshot numeric(10,2),
        suggested_pay numeric(10,2),
        final_payment_amount numeric(10,2) NOT NULL,
        previous_unpaid_hours numeric(6,2) NOT NULL DEFAULT 0,
        adjustment_notes text,
        status payout_status NOT NULL DEFAULT 'draft',
        processed_by uuid NOT NULL REFERENCES users(id),
        employee_signature_url text,
        employee_signed_at timestamptz,
        admin_confirmed_at timestamptz,
        paid_at timestamptz,
        is_locked boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        -- stops exact-duplicate periods; overlapping-but-distinct custom
        -- ranges are an application-layer check per data-model.md §5.4
        -- (open question, not a scaffolding blocker).
        CONSTRAINT payroll_payouts_unique_period
          UNIQUE (employee_id, period_start_date, period_end_date),
        -- non-negotiable rule: a payout can't be marked paid without a
        -- captured signature.
        CONSTRAINT payroll_payouts_paid_requires_signature
          CHECK (status <> 'paid' OR (employee_signature_url IS NOT NULL AND paid_at IS NOT NULL))
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS payroll_payouts;`);
  }
}
