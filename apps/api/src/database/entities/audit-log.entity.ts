import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import { AuditActionType } from "@timesheet/shared-types";

// Maps onto `audit_logs` (1700000014000-CreateAuditLogsTable.ts). Only
// ever written through AuditLogService.record(), inside the same
// transaction as the mutation it documents — see
// src/database/audit-log.service.ts. The app's DB role (app_role) has
// INSERT/SELECT only on this table; there is deliberately no update/
// delete/repository-remove path anywhere in the codebase either.
@Entity({ name: "audit_logs" })
export class AuditLogEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  actor_user_id: string;

  @Column({ type: "enum", enum: AuditActionType, enumName: "audit_action_type" })
  action_type: AuditActionType;

  @Column()
  entity_type: string;

  @Column()
  entity_id: string;

  // Typed `any` rather than Record<string, unknown>: TypeORM's
  // QueryDeepPartialEntity can't build a partial type over an indexed
  // Record when repositories insert/update this column, and the actual
  // payload is a heterogeneous full-row JSON snapshot anyway (see
  // AuditLogService), so a precise type here wouldn't buy correctness.
  @Column({ type: "jsonb", nullable: true })
  previous_value: any;

  @Column({ type: "jsonb", nullable: true })
  new_value: any;

  @Column({ type: "text", nullable: true })
  reason_note: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;
}
