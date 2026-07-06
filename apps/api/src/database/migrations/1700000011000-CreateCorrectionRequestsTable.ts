import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.8. The proposed_changes key-subset check is explicitly
// called out in the doc as application-layer only (Postgres doesn't
// cleanly constrain JSONB key sets) — flagged here so it isn't silently
// assumed to be DB-enforced.
export class CreateCorrectionRequestsTable1700000011000 implements MigrationInterface {
  name = "CreateCorrectionRequestsTable1700000011000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE correction_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        timesheet_entry_id uuid NOT NULL REFERENCES timesheet_entries(id),
        requested_by uuid NOT NULL REFERENCES users(id),
        proposed_changes jsonb NOT NULL,
        reason text NOT NULL,
        origin correction_origin NOT NULL DEFAULT 'employee_submitted',
        status correction_status NOT NULL DEFAULT 'pending',
        reviewed_by uuid REFERENCES users(id),
        reviewed_at timestamptz,
        admin_note text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS correction_requests;`);
  }
}
