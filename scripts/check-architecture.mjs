import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function files(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(target);
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

function imports(source) {
  return [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)].map((match) => match[1]);
}

function featureOwner(filename, featureRoot) {
  const relative = path.relative(featureRoot, filename);
  if (relative.startsWith("..")) return null;
  const parts = relative.split(path.sep);
  return parts.length > 1 ? parts[0] : null;
}

function checkBoundaries(sourceRoot, featureRoot, label, exemptions = new Set()) {
  for (const filename of files(sourceRoot)) {
    const owner = featureOwner(filename, featureRoot);
    if (!owner || exemptions.has(path.relative(sourceRoot, filename).replaceAll("\\", "/"))) continue;
    const source = fs.readFileSync(filename, "utf8");
    for (const specifier of imports(source).filter((value) => value.startsWith("."))) {
      const resolved = path.resolve(path.dirname(filename), specifier);
      const targetOwner = featureOwner(resolved, featureRoot);
      if (!targetOwner || targetOwner === owner) continue;
      const targetRelative = path.relative(path.join(featureRoot, targetOwner), resolved).replaceAll("\\", "/");
      if (targetRelative === "index" || targetRelative === "index.ts" || targetRelative === "index.tsx") continue;
      violations.push(`${label}: ${path.relative(root, filename)} imports internal files from ${targetOwner}`);
    }
  }
}

checkBoundaries(
  path.join(root, "backend", "src"),
  path.join(root, "backend", "src", "modules"),
  "backend",
  new Set(["modules/catalog.ts", "modules/system-catalog.ts"])
);
checkBoundaries(
  path.join(root, "frontend", "src"),
  path.join(root, "frontend", "src", "features"),
  "frontend"
);

for (const directory of fs.readdirSync(path.join(root, "backend", "src", "modules"), { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  const moduleDirectory = path.join(root, "backend", "src", "modules", directory.name);
  if (files(moduleDirectory).length && !fs.existsSync(path.join(moduleDirectory, "module.ts"))) {
    violations.push(`backend: module ${directory.name} has no module.ts descriptor`);
  }
}

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log("Architecture boundaries are valid.");
