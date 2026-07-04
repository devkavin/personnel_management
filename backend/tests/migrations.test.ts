import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverMigrations } from "../src/database/migrate.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "personnel-migrations-"));
  temporaryDirectories.push(root);
  const legacy = path.join(root, "legacy");
  const modules = path.join(root, "modules");
  await fs.mkdir(path.join(modules, "attendance", "migrations"), { recursive: true });
  await fs.mkdir(legacy, { recursive: true });
  return { legacy, modules };
}

describe("migration discovery", () => {
  it("keeps legacy IDs and gives module migrations stable scoped IDs", async () => {
    const { legacy, modules } = await fixture();
    await fs.writeFile(path.join(legacy, "011_existing.sql"), "SELECT 1;");
    await fs.writeFile(path.join(modules, "attendance", "migrations", "20260703_100000_add_rule.sql"), "SELECT 1;");
    const migrations = await discoverMigrations(legacy, modules);
    expect(migrations.map((migration) => migration.id)).toEqual([
      "011_existing.sql",
      "attendance/20260703_100000_add_rule.sql"
    ]);
  });

  it("rejects timestamp collisions between modules", async () => {
    const { legacy, modules } = await fixture();
    await fs.mkdir(path.join(modules, "scheduling", "migrations"), { recursive: true });
    await fs.writeFile(path.join(modules, "attendance", "migrations", "20260703_100000_one.sql"), "SELECT 1;");
    await fs.writeFile(path.join(modules, "scheduling", "migrations", "20260703_100000_two.sql"), "SELECT 1;");
    await expect(discoverMigrations(legacy, modules)).rejects.toThrow("Duplicate migration timestamp");
  });
});
