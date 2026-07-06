import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.1.
export class CreateUsersTable1700000003000 implements MigrationInterface {
  name = "CreateUsersTable1700000003000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        role user_role NOT NULL,
        full_name text NOT NULL,
        email citext UNIQUE,
        phone_number text UNIQUE,
        password_hash text,
        otp_enabled boolean NOT NULL DEFAULT false,
        login_status login_status NOT NULL DEFAULT 'active',
        registration_source registration_source NOT NULL,
        invited_by_user_id uuid REFERENCES users(id),
        invitation_token_hash text UNIQUE,
        invitation_expires_at timestamptz,
        is_verified boolean NOT NULL DEFAULT false,
        last_login_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_contact_method_required
          CHECK (email IS NOT NULL OR phone_number IS NOT NULL),
        -- non-negotiable rule (PROJECT.md): 2FA is mandatory for admin,
        -- not just a default — enforced here so no code path can create an
        -- admin row with otp_enabled = false.
        CONSTRAINT users_admin_requires_otp
          CHECK (role <> 'admin' OR otp_enabled = true)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
  }
}
