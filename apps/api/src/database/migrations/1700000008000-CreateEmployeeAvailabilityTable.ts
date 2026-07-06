import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.6 — optional feature ("if added"), scaffolded now since
// it's part of the 16-table schema.
export class CreateEmployeeAvailabilityTable1700000008000 implements MigrationInterface {
  name = "CreateEmployeeAvailabilityTable1700000008000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE employee_availability (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id uuid NOT NULL REFERENCES users(id),
        day_of_week smallint NOT NULL,
        start_time time NOT NULL,
        end_time time NOT NULL,
        effective_from date NOT NULL,
        effective_until date,
        CONSTRAINT employee_availability_day_of_week_range
          CHECK (day_of_week BETWEEN 0 AND 6)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS employee_availability;`);
  }
}
