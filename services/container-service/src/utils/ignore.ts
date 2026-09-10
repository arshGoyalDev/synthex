
// Directories to exclude from snapshots — matched as exact path segments
// so "target" won't match "src/target_utils.rs", only a segment literally
// named "target".
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "target",           // rust build output
  "__pycache__",
  ".next",
  "dist",
  "build",
  "venv",
  ".venv",
]);

// Exact filenames to exclude (matched against the basename only)
const IGNORE_FILES = new Set([
  ".DS_Store",
]);

// File extensions to exclude (without the leading dot)
const IGNORE_EXTENSIONS = new Set([
  "class",            // java compiled
  "pyc",              // python compiled
  "o",                // c/cpp object files
  "exe",              // executables
]);

export function shouldIgnore(filePath: string): boolean {
  const segments = filePath.split("/").filter(Boolean);

  // If ANY directory segment in the path matches an ignored dir, skip the file
  // Check all segments except the last one (which is the filename) for dirs,
  // but also check if the last segment itself is an ignored dir name (handles
  // edge cases where a bare directory name appears as a path).
  for (const segment of segments) {
    if (IGNORE_DIRS.has(segment)) return true;
  }

  const fileName = segments[segments.length - 1];
  if (!fileName) return true;

  // Check exact filename matches
  if (IGNORE_FILES.has(fileName)) return true;

  // Check file extension
  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx !== -1) {
    const ext = fileName.slice(dotIdx + 1);
    if (IGNORE_EXTENSIONS.has(ext)) return true;
  }

  return false;
}