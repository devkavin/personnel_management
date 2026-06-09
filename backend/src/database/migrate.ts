import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, "migrations");
const maxConnectionAttempts = 30;
const connectionRetryDelayMs = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id VARCHAR(190) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= maxConnectionAttempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      if (attempt === maxConnectionAttempts) throw error;
      console.log(`Database is not ready yet, retrying (${attempt}/${maxConnectionAttempts})`);
      await sleep(connectionRetryDelayMs);
    }
  }
}

function splitSql(sql: string) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function runMigrations() {
  await waitForDatabase();
  await ensureMigrationsTable();
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const [existing] = await pool.query("SELECT id FROM migrations WHERE id = :id", { id: file });
    if (Array.isArray(existing) && existing.length > 0) continue;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      for (const statement of splitSql(sql)) {
        await connection.query(statement);
      }
      await connection.query("INSERT INTO migrations (id) VALUES (:id)", { id: file });
      await connection.commit();
      console.log(`Applied migration ${file}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => pool.end())
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
