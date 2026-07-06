import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.2 — one row per user with role = 'employee'
// (not DB-enforced beyond the FK, since cross-table role checks need a
// trigger; the application only ever creates this row alongside an
// employee-role user).
export class CreateEmployeeProfilesTable1700000004000 implements MigrationInterface {
  name = "CreateEmployeeProfilesTable1700000004000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE employee_profiles (
        user_id uuid PRIMARY KEY REFERENCES users(id),
        job_role text,
        hourly_rate numeric(10,2),
        joining_date date NOT NULL,
        employment_status employment_status NOT NULL DEFAULT 'active',
        emergency_contact_name text,
        emergency_contact_phone text,
        employee_code text NOT NULL UNIQUE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS employee_profiles;`);
  }
}
