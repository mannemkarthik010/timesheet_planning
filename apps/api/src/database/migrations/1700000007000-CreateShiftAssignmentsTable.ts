import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.5. The end-after-start CHECK does not yet support
// shifts crossing midnight — open question §5.1 in data-model.md, flagged
// as not a scaffolding blocker; revisit this constraint once that's decided.
export class CreateShiftAssignmentsTable1700000007000 implements MigrationInterface {
  name = "CreateShiftAssignmentsTable1700000007000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shift_assignments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        schedule_id uuid NOT NULL REFERENCES shift_schedules(id),
        employee_id uuid NOT NULL REFERENCES users(id),
        shift_date date NOT NULL,
        shift_type shift_type NOT NULL,
        planned_start_time time NOT NULL,
        planned_end_time time NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT shift_assignments_unique_slot
          UNIQUE (employee_id, shift_date, shift_type),
        CONSTRAINT shift_assignments_end_after_start
          CHECK (planned_end_time > planned_start_time)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS shift_assignments;`);
  }
}
