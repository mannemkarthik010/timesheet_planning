import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

// Maps onto `refresh_tokens` (1700000017000-CreateRefreshTokensTable.ts).
// `token_hash` stores sha256(opaque token) — the raw token is only ever
// held client-side; the server never persists it in reversible form.
@Entity({ name: "refresh_tokens" })
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  user_id: string;

  @Column()
  token_hash: string;

  @Column({ type: "timestamptz" })
  expires_at: Date;

  @Column({ type: "timestamptz", nullable: true })
  revoked_at: Date | null;

  @Column({ type: "inet", nullable: true })
  ip_address: string | null;

  @Column({ type: "text", nullable: true })
  user_agent: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;
}
