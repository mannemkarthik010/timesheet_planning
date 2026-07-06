import { Injectable } from "@nestjs/common";
import { QueryRunner } from "typeorm";
import { AuditActionType } from "@timesheet/shared-types";
import { AuditLogEntity } from "./entities/audit-log.entity";

export interface RecordAuditLogInput {
  actorUserId: string;
  actionType: AuditActionType;
  entityType: string;
  entityId: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reasonNote?: string | null;
}

// PROJECT.md: "Every mutation ... must write its audit_logs row in the
// same DB transaction as the mutation itself. No exceptions." Callers
// pass the same QueryRunner they used for the mutation itself (already
// inside a started transaction) — this method never opens its own
// transaction, so a caller can never accidentally commit the mutation
// without the audit row, or vice versa.
@Injectable()
export class AuditLogService {
  async record(queryRunner: QueryRunner, input: RecordAuditLogInput): Promise<void> {
    const repo = queryRunner.manager.getRepository(AuditLogEntity);
    await repo.insert({
      actor_user_id: input.actorUserId,
      action_type: input.actionType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      previous_value: (input.previousValue ?? null) as any,
      new_value: (input.newValue ?? null) as any,
      reason_note: input.reasonNote ?? null,
    });
  }
}
