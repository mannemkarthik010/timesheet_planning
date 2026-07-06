import { MigrationInterface, QueryRunner } from "typeorm";

// Every enum(...) column in data-model.md, as a native Postgres type.
// `notifications.type` is deliberately left as `text` (see the model file,
// §2.13) — the requirement doc's §14 trigger list it's meant to mirror
// isn't among the docs provided, so inventing a fixed enum here would risk
// silently excluding a real trigger type later.
export class CreateEnums1700000002000 implements MigrationInterface {
  name = "CreateEnums1700000002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE user_role AS ENUM ('employee', 'admin');`);
    await queryRunner.query(`CREATE TYPE login_status AS ENUM ('active', 'deactivated');`);
    await queryRunner.query(
      `CREATE TYPE registration_source AS ENUM ('self_registered', 'admin_invited');`,
    );
    await queryRunner.query(
      `CREATE TYPE employment_status AS ENUM ('active', 'inactive', 'terminated');`,
    );
    await queryRunner.query(`CREATE TYPE schedule_status AS ENUM ('draft', 'published');`);
    await queryRunner.query(`CREATE TYPE shift_type AS ENUM ('morning', 'evening');`);
    await queryRunner.query(
      `CREATE TYPE timesheet_status AS ENUM ('pending', 'approved', 'rejected', 'corrected');`,
    );
    await queryRunner.query(`CREATE TYPE entry_source AS ENUM ('online', 'offline_synced');`);
    await queryRunner.query(
      `CREATE TYPE correction_origin AS ENUM ('employee_submitted', 'auto_converted_offline_edit');`,
    );
    await queryRunner.query(
      `CREATE TYPE correction_status AS ENUM ('pending', 'approved', 'rejected');`,
    );
    await queryRunner.query(
      `CREATE TYPE period_type AS ENUM ('weekly', 'biweekly', 'monthly', 'custom');`,
    );
    await queryRunner.query(
      `CREATE TYPE payout_status AS ENUM ('draft', 'pending_signature', 'paid', 'voided');`,
    );
    await queryRunner.query(`
      CREATE TYPE audit_action_type AS ENUM (
        'timesheet_submit',
        'timesheet_edit_employee',
        'timesheet_edit_admin',
        'correction_request_created',
        'correction_request_reviewed',
        'correction_request_auto_rejected_payout_locked',
        'offline_edit_converted_to_correction',
        'approval',
        'rejection',
        'schedule_published',
        'payout_created',
        'payout_signed',
        'payout_paid',
        'payout_unlocked',
        'pdf_generated',
        'employee_deactivated',
        'employee_invited',
        'login'
      );
    `);
    await queryRunner.query(
      `CREATE TYPE notification_channel AS ENUM ('in_app', 'push', 'sms');`,
    );
    await queryRunner.query(`CREATE TYPE device_platform AS ENUM ('ios', 'android');`);
    await queryRunner.query(`CREATE TYPE export_format AS ENUM ('pdf', 'xlsx', 'csv');`);
    await queryRunner.query(
      `CREATE TYPE export_status AS ENUM ('processing', 'completed', 'failed');`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TYPE IF EXISTS export_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS export_format;`);
    await queryRunner.query(`DROP TYPE IF EXISTS device_platform;`);
    await queryRunner.query(`DROP TYPE IF EXISTS notification_channel;`);
    await queryRunner.query(`DROP TYPE IF EXISTS audit_action_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS payout_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS period_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS correction_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS correction_origin;`);
    await queryRunner.query(`DROP TYPE IF EXISTS entry_source;`);
    await queryRunner.query(`DROP TYPE IF EXISTS timesheet_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS shift_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS schedule_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS employment_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS registration_source;`);
    await queryRunner.query(`DROP TYPE IF EXISTS login_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role;`);
  }
}
