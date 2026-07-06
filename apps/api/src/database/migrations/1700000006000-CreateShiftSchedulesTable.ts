import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.4.
export class CreateShiftSchedulesTable1700000006000 implements MigrationInterface {
  name = "CreateShiftSchedulesTable1700000006000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shift_schedules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        week_start_date date NOT NULL UNIQUE,
        status schedule_status NOT NULL DEFAULT 'draft',
        published_at timestamptz,
        published_by uuid REFERENCES users(id),
        created_by uuid NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS shift_schedules;`);
  }
}
