import { MigrationInterface, QueryRunner } from "typeorm";

// data-model.md §2.16.
export class CreateExportJobsTable1700000018000 implements MigrationInterface {
  name = "CreateExportJobsTable1700000018000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE export_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        requested_by uuid NOT NULL REFERENCES users(id),
        export_format export_format NOT NULL,
        filter_params jsonb NOT NULL,
        file_url text,
        status export_status NOT NULL DEFAULT 'processing',
        created_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS export_jobs;`);
  }
}
