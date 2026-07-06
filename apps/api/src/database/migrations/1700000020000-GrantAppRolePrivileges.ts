import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.12 / §3.2 — audit_logs is append-only at the DB role
// level: app_role gets INSERT/SELECT only, never UPDATE/DELETE, so
// tampering with history requires actual superuser DB access rather than
// an application bug or a compromised admin session. Every other table
// gets normal CRUD privileges for app_role since the RLS policies from
// the previous migration (and NestJS guards) are what actually restrict
// row-level access there.
export class GrantAppRolePrivileges1700000020000 implements MigrationInterface {
  name = "GrantAppRolePrivileges1700000020000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO app_role;`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;`,
    );

    // Revoke first, then grant back only what audit_logs actually allows.
    await queryRunner.query(`REVOKE ALL ON audit_logs FROM app_role;`);
    await queryRunner.query(`REVOKE ALL ON audit_logs FROM PUBLIC;`);
    await queryRunner.query(`GRANT SELECT, INSERT ON audit_logs TO app_role;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_role;`,
    );
    await queryRunner.query(`REVOKE USAGE ON SCHEMA public FROM app_role;`);
  }
}
