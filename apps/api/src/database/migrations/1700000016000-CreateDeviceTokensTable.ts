import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.14.
export class CreateDeviceTokensTable1700000016000 implements MigrationInterface {
  name = "CreateDeviceTokensTable1700000016000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE device_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        push_token text NOT NULL UNIQUE,
        platform device_platform NOT NULL,
        last_used_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS device_tokens;`);
  }
}
