import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.10.
export class CreatePayoutLineItemsTable1700000012000 implements MigrationInterface {
  name = "CreatePayoutLineItemsTable1700000012000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payout_line_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        payout_id uuid NOT NULL REFERENCES payroll_payouts(id),
        timesheet_entry_id uuid NOT NULL REFERENCES timesheet_entries(id),
        CONSTRAINT payout_line_items_unique UNIQUE (payout_id, timesheet_entry_id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS payout_line_items;`);
  }
}
