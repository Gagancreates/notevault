// Runs every SQL file in /sql in order (01 → 06) against DATABASE_URL.
// Usage: npm run db:setup            (skips 00_reset.sql)
//        npm run db:setup -- --reset (drops everything first)
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { loadEnv } from "./load-env.mjs";

loadEnv();
const reset = process.argv.includes("--reset");
const dir = path.resolve("sql");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => reset || !f.startsWith("00_"))
  .sort();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (copy .env.example to .env.local)");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false },
});
await client.connect();
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), "utf8");
  process.stdout.write(`→ ${f} ... `);
  try {
    await client.query(sql);
    console.log("ok");
  } catch (e) {
    console.log("FAILED");
    console.error(e.message);
    await client.end();
    process.exit(1);
  }
}
await client.end();
console.log("Database ready.");
