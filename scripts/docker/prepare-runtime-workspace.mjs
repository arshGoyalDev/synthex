import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packageDirs = process.argv.slice(2);

if (packageDirs.length === 0) {
  console.error("No workspace package directories provided.");
  process.exit(1);
}

for (const packageDir of packageDirs) {
  const packageJsonPath = join(packageDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  if (typeof packageJson.main === "string" && packageJson.main.startsWith("./src/")) {
    packageJson.main = packageJson.main
      .replace("./src/", "./dist/")
      .replace(/\.ts$/, ".js");
  }

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
