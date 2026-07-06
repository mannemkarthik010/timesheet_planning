import { MigrationInterface, QueryRunner } from "typeorm";

// pgcrypto -> gen_random_uuid() for all PKs; citext -> case-insensitive
// unique email. Also creates the restricted `app_role` the running API
// connects as at runtime (see data-source.ts and .env.example) — created
// here, first, so every later migration's GRANT/RLS work has a role to
// target. Table ownership stays with whatever role runs migrations
// (DATABASE_URL), so app_role is never exempt from RLS by ownership.
export class EnableExtensionsAndAppRole1700000001000 implements MigrationInterface {
  name = "EnableExtensionsAndAppRole1700000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext;`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_role') THEN
          CREATE ROLE app_role LOGIN;
        END IF;
      END
      $$;
    `);

    // ALTER ROLE is DDL and Postgres doesn't accept bound ($1) parameters
    // for it at all, only for regular DML/queries — so this can't use
    // queryRunner.query's parameter array like the RLS context helper
    // does. APP_DB_PASSWORD is an operator-supplied deploy-time secret,
    // never end-user request input, so escaping single quotes here (the
    // only character that can break out of a single-quoted literal) is
    // sufficient; only run migrations with a trusted .env file.
    const password = process.env.APP_DB_PASSWORD;
    if (password) {
      const escaped = password.replace(/'/g, "''");
      await queryRunner.query(`ALTER ROLE app_role WITH PASSWORD '${escaped}'`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Table-level GRANTs (1700000020000) are revoked implicitly when the
    // role is dropped; this runs last in a full revert, after every table
    // that depends on these extensions/role has already been dropped.
    await queryRunner.query(`DROP ROLE IF EXISTS app_role;`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS citext;`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS pgcrypto;`);
  }
}
