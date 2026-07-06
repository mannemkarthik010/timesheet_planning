import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.15 — backs session-timeout enforcement and the
// mandatory re-auth check before "Unlock for correction" (PROJECT.md §4).
export class CreateRefreshTokensTable1700000017000 implements MigrationInterface {
  name = "CreateRefreshTokensTable1700000017000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        ip_address inet,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens;`);
  }
}
