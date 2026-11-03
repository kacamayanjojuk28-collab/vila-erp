import "dotenv/config";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const existing = readFileSync(".env", "utf8");
if (existing.includes("MIGRATION_DATABASE_URL")) {
  console.log("Application role already configured.");
  process.exit(0);
}
const admin = process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: admin });
await client.connect();
const password = randomBytes(32).toString("hex");
await client.query(
  `CREATE ROLE vila_app LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
);
await client.query("GRANT CONNECT ON DATABASE vila TO vila_app");
await client.query("GRANT USAGE ON SCHEMA public TO vila_app");
await client.query(
  "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vila_app",
);
await client.query(
  'REVOKE UPDATE, DELETE ON "Audit", "Movement", "Payment" FROM vila_app',
);
await client.query('REVOKE ALL ON "_prisma_migrations" FROM vila_app');
await client.query(
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vila_app",
);
const url = new URL(admin);
url.username = "vila_app";
url.password = password;
writeFileSync(
  ".env",
  existing.replace(
    /^DATABASE_URL=.*$/m,
    'DATABASE_URL="' + url.toString() + '"',
  ) +
    '\nMIGRATION_DATABASE_URL="' +
    admin +
    '"\n',
);
await client.end();
console.log(
  "Restricted application role configured; audit, movements and payments are append-only.",
);
