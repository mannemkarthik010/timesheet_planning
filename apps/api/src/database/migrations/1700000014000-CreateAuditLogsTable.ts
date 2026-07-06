import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.12 and §3.2. INSERT-only privilege for app_role is
// applied later in 1700000020000-GrantAppRolePrivileges.ts, once the role
// and this table both exist. The CHECK below DB-enforces the one
// reason_note requirement that's derivable from a single audit_logs row
// (payout_unlocked always needs a reason); the other documented case —
// "any edit to a payout-locked entry" — depends on state in other tables,
// so it stays an application-layer check per data-model.md §2.12.
export class CreateAuditLogsTable1700000014000 implements MigrationInterface {
  name = "CreateAuditLogsTable1700000014000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_user_id uuid NOT NULL REFERENCES users(id),
        action_type audit_action_type NOT NULL,
        entity_type text NOT NULL,
        entity_id uuid NOT NULL,
        previous_value jsonb,
        new_value jsonb,
        reason_note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT audit_logs_payout_unlocked_requires_reason
          CHECK (action_type <> 'payout_unlocked' OR reason_note IS NOT NULL)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX audit_logs_entity_idx
        ON audit_logs (entity_type, entity_id, created_at);
    `);
    await queryRunner.query(`
      CREATE INDEX audit_logs_actor_idx
        ON audit_logs (actor_user_id, created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs;`);
  }
}
