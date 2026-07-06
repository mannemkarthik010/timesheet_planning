export default () => ({
  port: parseInt(process.env.PORT ?? "3000", 10),
  database: {
    // Runtime connection uses the restricted `app_role`, never the
    // migration-owner connection in DATABASE_URL — see .env.example and
    // src/database/migrations for why these are kept separate.
    url: process.env.APP_DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshTtlAdminMinutes: parseInt(process.env.JWT_REFRESH_TTL_ADMIN_MINUTES ?? "15", 10),
    refreshTtlEmployeeMinutes: parseInt(process.env.JWT_REFRESH_TTL_EMPLOYEE_MINUTES ?? "60", 10),
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
  },
});
