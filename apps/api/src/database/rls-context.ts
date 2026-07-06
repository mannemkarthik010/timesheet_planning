import { QueryRunner } from "typeorm";

// Sets the two session GUCs the RLS policies in
// 1700000019000-EnableRowLevelSecurity.ts read via current_setting(). Must
// be called with SET LOCAL (not SET) so the value is scoped to the current
// transaction only and never leaks across pooled connections between
// requests. Callers open a transaction, call this first, then run their
// queries and commit — the same transaction a mutation's audit_logs write
// must already be in (PROJECT.md "Every mutation ... writes its audit_logs
// row in the same DB transaction").
export async function setRlsContext(
  queryRunner: QueryRunner,
  currentUserId: string,
  isAdmin: boolean,
): Promise<void> {
  // SET/SET LOCAL don't accept bound parameters in Postgres's extended
  // query protocol — set_config(..., true) is the parameterized
  // equivalent of SET LOCAL (third arg = is_local).
  await queryRunner.query(`SELECT set_config('app.current_user_id', $1, true)`, [
    currentUserId,
  ]);
  await queryRunner.query(`SELECT set_config('app.is_admin', $1, true)`, [String(isAdmin)]);
}
