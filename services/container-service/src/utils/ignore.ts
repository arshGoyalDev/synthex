
// patterns to never store in MinIO or DB
export const IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  "target",           // rust build output
  "__pycache__",
  ".next",
  "dist",
  "build",
  "venv",
  ".venv",
  "*.class",          // java compiled
  "*.jar",
  "*.pyc",
  ".DS_Store",
  "*.o",              // c/cpp object files
  "*.exe",
  "Cargo.lock",       // optional — debatable
];

export function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some((pattern) => {
    if (pattern.startsWith("*")) {
      return filePath.endsWith(pattern.slice(1));
    }
    return filePath.includes(pattern);
  });
}