// Requires a Postgres instance with the migrations from
// src/database/migrations already applied (docker-compose up postgres &&
// npm run migration:run), and no TWILIO_ACCOUNT_SID set so AuthModule
// wires FakeOtpProvider (fixed code "000000") instead of a real Twilio
// call — see src/auth/auth.module.ts.
process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";
process.env.APP_DATABASE_URL ??=
  "postgres://app_role:app_role_password@localhost:5432/timesheet_dev";
delete process.env.TWILIO_ACCOUNT_SID;

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import { RegistrationSource, UserRole } from "@timesheet/shared-types";
import { AppModule } from "../src/app.module";
import { UserEntity } from "../src/auth/entities/user.entity";

// First proof point for the guard stack: RolesGuard (common/guards/roles.guard.ts)
// must block an authenticated employee from an [admin]-only route
// (api-contract.md §1, POST /auth/invite) — this exercises the real HTTP
// stack (JwtStrategy -> JwtAuthGuard -> RolesGuard), not a mocked guard.
describe("Admin-only route RBAC (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const runId = Date.now().toString().slice(-8);
  const employeePhone = `+1555${runId}`;
  const adminPhone = `+1556${runId}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAndLoginEmployee(): Promise<string> {
    const registerRes = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ full_name: "Test Employee", phone_number: employeePhone, password: "supersecret1" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/auth/verify")
      .send({ user_id: registerRes.body.user_id, code: "000000" })
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ identifier: employeePhone, password: "supersecret1" })
      .expect(200);

    return loginRes.body.access_token;
  }

  async function seedAndLoginAdmin(): Promise<string> {
    const users = dataSource.getRepository(UserEntity);
    await users.save(
      users.create({
        role: UserRole.ADMIN,
        full_name: "Test Admin",
        phone_number: adminPhone,
        password_hash: await bcrypt.hash("adminpass123", 12),
        otp_enabled: true,
        registration_source: RegistrationSource.ADMIN_INVITED,
        is_verified: true,
      }),
    );

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ identifier: adminPhone, password: "adminpass123" })
      .expect(200);
    expect(loginRes.body.requires_2fa).toBe(true);

    const verifyRes = await request(app.getHttpServer())
      .post("/api/v1/auth/admin/2fa/verify")
      .send({ otp_challenge_id: loginRes.body.otp_challenge_id, code: "000000" })
      .expect(200);

    return verifyRes.body.access_token;
  }

  it("rejects an employee token on the admin-only POST /auth/invite route", async () => {
    const employeeToken = await registerAndLoginEmployee();

    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/invite")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ full_name: "New Hire", phone_number: `+1557${runId}`, joining_date: "2026-07-10" });

    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request on the same admin-only route", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/invite")
      .send({ full_name: "New Hire", phone_number: `+1558${runId}`, joining_date: "2026-07-10" });

    expect(res.status).toBe(401);
  });

  it("allows an admin token (post-2FA) on the same admin-only route", async () => {
    const adminToken = await seedAndLoginAdmin();

    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/invite")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ full_name: "New Hire", phone_number: `+1559${runId}`, joining_date: "2026-07-10" });

    expect(res.status).toBe(201);
  });
});
