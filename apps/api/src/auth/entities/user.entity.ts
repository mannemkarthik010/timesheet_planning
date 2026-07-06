import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { LoginStatus, RegistrationSource, UserRole } from "@timesheet/shared-types";

// Maps onto the `users` table created in
// 1700000003000-CreateUsersTable.ts. synchronize is off (see
// data-source.ts / app.module.ts) — this entity is for query/repository
// typing only, the migration is the source of truth for the schema.
@Entity({ name: "users" })
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: UserRole, enumName: "user_role" })
  role: UserRole;

  @Column()
  full_name: string;

  @Column({ type: "citext", nullable: true })
  email: string | null;

  @Column({ type: "text", nullable: true })
  phone_number: string | null;

  @Column({ type: "text", nullable: true })
  password_hash: string | null;

  @Column({ default: false })
  otp_enabled: boolean;

  @Column({ type: "enum", enum: LoginStatus, enumName: "login_status", default: LoginStatus.ACTIVE })
  login_status: LoginStatus;

  @Column({ type: "enum", enum: RegistrationSource, enumName: "registration_source" })
  registration_source: RegistrationSource;

  @Column({ type: "uuid", nullable: true })
  invited_by_user_id: string | null;

  @Column({ type: "text", nullable: true })
  invitation_token_hash: string | null;

  @Column({ type: "timestamptz", nullable: true })
  invitation_expires_at: Date | null;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ type: "timestamptz", nullable: true })
  last_login_at: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
