import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.3 — singleton table. The doc says the application
// enforces "exactly one row"; the expression unique index below adds a
// DB-level backstop for that same invariant at negligible cost, so a bug
// in application code can't silently create a second settings row.
export class CreateRestaurantSettingsTable1700000005000 implements MigrationInterface {
  name = "CreateRestaurantSettingsTable1700000005000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE restaurant_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_name text NOT NULL,
        logo_url text,
        address text NOT NULL,
        contact_phone text NOT NULL,
        contact_email text NOT NULL,
        pdf_footer_message text,
        missed_entry_reminder_time time,
        show_team_schedule_to_employees boolean NOT NULL DEFAULT true,
        admin_session_timeout_minutes int NOT NULL DEFAULT 15,
        employee_session_timeout_minutes int NOT NULL DEFAULT 60
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX restaurant_settings_singleton
        ON restaurant_settings ((true));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS restaurant_settings;`);
  }
}
