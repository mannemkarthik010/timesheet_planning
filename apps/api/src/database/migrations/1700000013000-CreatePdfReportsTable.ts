import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.11.
export class CreatePdfReportsTable1700000013000 implements MigrationInterface {
  name = "CreatePdfReportsTable1700000013000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE pdf_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id text NOT NULL UNIQUE,
        payout_id uuid NOT NULL REFERENCES payroll_payouts(id),
        employee_id uuid NOT NULL REFERENCES users(id),
        file_url text NOT NULL,
        restaurant_snapshot jsonb NOT NULL,
        generated_by uuid REFERENCES users(id),
        generated_at timestamptz NOT NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS pdf_reports;`);
  }
}
