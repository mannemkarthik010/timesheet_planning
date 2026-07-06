import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §3.3 — defense-in-depth. NestJS guards (role + ownership)
// are the primary enforcement point; these RLS policies mean even a bug
// in application-layer authorization can't leak another employee's rows
// through a raw/ad-hoc query.
//
// The app must SET LOCAL app.current_user_id and app.is_admin inside the
// same transaction as every query against these tables — see
// src/database/rls-context.ts. FORCE ROW LEVEL SECURITY is required
// because app_role does not own these tables (the migration-runner role
// does), but FORCE also protects against a future accidental ownership
// change. Both session GUCs default to unset, and unset/invalid values
// fail closed (no rows visible) rather than open, since a NULL compared
// with `=` or cast to boolean is never true.
export class EnableRowLevelSecurity1700000019000 implements MigrationInterface {
  name = "EnableRowLevelSecurity1700000019000";

  private readonly tables = ["timesheet_entries", "payroll_payouts", "pdf_reports"];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      await queryRunner.query(`
        CREATE POLICY ${table}_owner_or_admin ON ${table}
          USING (
            employee_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            OR COALESCE(NULLIF(current_setting('app.is_admin', true), '')::boolean, false) IS TRUE
          )
          WITH CHECK (
            employee_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            OR COALESCE(NULLIF(current_setting('app.is_admin', true), '')::boolean, false) IS TRUE
          );
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`DROP POLICY IF EXISTS ${table}_owner_or_admin ON ${table};`);
      await queryRunner.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
    }
  }
}
