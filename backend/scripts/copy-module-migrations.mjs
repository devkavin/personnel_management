import fs from "node:fs/promises";
import path from "node:path";

const source = path.resolve("src/modules");
const destination = path.resolve("dist/modules");
const modules = await fs.readdir(source, { withFileTypes: true });

for (const module of modules.filter((entry) => entry.isDirectory())) {
  const migrationSource = path.join(source, module.name, "migrations");
  const files = await fs.readdir(migrationSource).catch(() => []);
  if (!files.length) continue;
  const migrationDestination = path.join(destination, module.name, "migrations");
  await fs.mkdir(migrationDestination, { recursive: true });
  for (const file of files.filter((candidate) => candidate.endsWith(".sql"))) {
    await fs.copyFile(path.join(migrationSource, file), path.join(migrationDestination, file));
  }
}
