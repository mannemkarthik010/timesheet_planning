import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

// Migration-runner connection — uses DATABASE_URL (table owner / superuser
// in local dev), never APP_DATABASE_URL. Keeping these separate is what
// makes the app_role privilege lockdown in
// 1700000020000-GrantAppRolePrivileges.ts meaningful: the runtime API can
// never DDL its own way around the audit_logs INSERT-only restriction or
// the RLS policies, because it never connects with owner privileges.
export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [__dirname + "/../**/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  synchronize: false,
});
