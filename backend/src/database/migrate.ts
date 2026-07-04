import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, "migrations");
const modulesDir = path.join(dirname, "..", "modules");
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

interface MigrationFile {
  id: string;
  filename: string;
}

export async function discoverMigrations(legacyDirectory = migrationsDir, moduleDirectory = modulesDir): Promise<MigrationFile[]> {
  const discovered: MigrationFile[] = [];
  const legacyFiles = await fs.readdir(legacyDirectory).catch(() => []);
  for (const file of legacyFiles.filter((candidate) => candidate.endsWith(".sql"))) {
    discovered.push({ id: file, filename: path.join(legacyDirectory, file) });
  }

  const moduleNames = await fs.readdir(moduleDirectory).catch(() => []);
  for (const moduleName of moduleNames) {
    const directory = path.join(moduleDirectory, moduleName, "migrations");
    const files = await fs.readdir(directory).catch(() => []);
    for (const file of files.filter((candidate) => candidate.endsWith(".sql"))) {
      discovered.push({ id: `${moduleName}/${file}`, filename: path.join(directory, file) });
    }
  }

  const timestampOwners = new Map<string, string>();
  for (const migration of discovered.filter((item) => /^\d{8}_\d{6}_/.test(path.basename(item.filename)))) {
    const timestamp = path.basename(migration.filename).slice(0, 15);
    const owner = timestampOwners.get(timestamp);
    if (owner) throw new Error(`Duplicate migration timestamp ${timestamp}: ${owner} and ${migration.id}`);
    timestampOwners.set(timestamp, migration.id);
  }
  return discovered.sort((left, right) => {
    const byFilename = path.basename(left.filename).localeCompare(path.basename(right.filename));
    return byFilename || left.id.localeCompare(right.id);
  });
}

export async function runMigrations() {
  await waitForDatabase();
  await ensureMigrationsTable();
  const migrations = await discoverMigrations();

  for (const migration of migrations) {
    const [existing] = await pool.query("SELECT id FROM migrations WHERE id = :id", { id: migration.id });
    if (Array.isArray(existing) && existing.length > 0) continue;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const sql = await fs.readFile(migration.filename, "utf8");
      for (const statement of splitSql(sql)) {
        await connection.query(statement);
      }
      await connection.query("INSERT INTO migrations (id) VALUES (:id)", { id: migration.id });
      await connection.commit();
      console.log(`Applied migration ${migration.id}`);
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
