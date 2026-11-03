import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
const bin =
  process.env.PG_BIN ??
  path.join(
    process.env.LOCALAPPDATA,
    "Programs",
    "PostgreSQL18",
    "pgsql",
    "bin",
  );
const url = new URL(
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL,
);
const args = ["-h", url.hostname, "-p", url.port || "5432", "-U", url.username];
const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
function run(name, extra) {
  const r = spawnSync(path.join(bin, name + ".exe"), [...args, ...extra], {
    env,
    stdio: "inherit",
  });
  if (r.status !== 0) throw Error(name + " failed (" + r.status + ")");
}
const command = process.argv[2];
if (command === "backup") {
  mkdirSync(".local/backups", { recursive: true });
  const file = path.resolve(".local/backups/vila-" + Date.now() + ".dump");
  run("pg_dump", ["-Fc", "-f", file, url.pathname.slice(1)]);
  console.log(file);
} else if (command === "restore-check") {
  const file = path.resolve(process.argv[3] ?? "");
  if (!existsSync(file) || !file.endsWith(".dump"))
    throw Error("Provide an existing .dump backup");
  const database = "vila_restore_" + Date.now();
  run("createdb", [database]);
  run("pg_restore", [
    "--no-owner",
    "--no-acl",
    "--exit-on-error",
    "-d",
    database,
    file,
  ]);
  run("psql", [
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    'SELECT count(*) AS organizations FROM "Organization"; SELECT count(*) AS audit_entries FROM "Audit";',
  ]);
  console.log(
    "Restored into separate database: " +
      database +
      " (retained for inspection).",
  );
} else
  throw Error("Usage: node scripts/database.mjs backup | restore-check <file>");
