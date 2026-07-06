import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.13.
export class CreateNotificationsTable1700000015000 implements MigrationInterface {
  name = "CreateNotificationsTable1700000015000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        type text NOT NULL,
        title text NOT NULL,
        body text NOT NULL,
        related_entity_type text,
        related_entity_id uuid,
        channel notification_channel NOT NULL,
        sent_at timestamptz,
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notifications;`);
  }
}
