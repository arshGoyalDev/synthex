/**
 * Auto-detection engine for GitHub/ZIP imports.
 * Given a flat list of file paths (from GitHub file tree or zip contents),
 * plus optional package.json content, infers language, framework, run/install
 * commands and port.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DetectionResult {
  /** Primary language key (matches LANGUAGES keys) */
  language: string | null;
  /** All detected languages */
  languages: string[];
  /** Detected framework identifier */
  framework: string | null;
  /** Suggested run command */
  runCommand: string | null;
  /** Suggested install command */
  installCommand: string | null;
  /** Suggested preview command (if framework serves via dev server) */
  previewCommand: string | null;
  /** Suggested port */
  port: number | null;
  /** Whether this is a web preview project */
  isPreview: boolean;
}

// ─── Language detection ──────────────────────────────────────────────────────

const LANGUAGE_INDICATORS: Array<{ files: string[]; language: string }> = [
  { files: ["package.json"], language: "javascript" },
  { files: ["tsconfig.json", "tsconfig.base.json"], language: "typescript" },
  { files: ["Cargo.toml"], language: "rust" },
  { files: ["go.mod"], language: "go" },
  { files: ["requirements.txt", "pyproject.toml", "setup.py", "setup.cfg", "Pipfile"], language: "python" },
  { files: ["Gemfile"], language: "ruby" },
  { files: ["pom.xml", "build.gradle", "build.gradle.kts"], language: "java" },
  { files: ["composer.json"], language: "php" },
  { files: ["mix.exs"], language: "elixir" },
  { files: ["CMakeLists.txt"], language: "cpp" },
];

// Extension-based language detection (fallback)
const EXTENSION_LANGUAGES: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".rs": "rust",
  ".go": "go",
  ".py": "python",
  ".rb": "ruby",
  ".java": "java",
  ".php": "php",
  ".ex": "elixir",
  ".exs": "elixir",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".zig": "zig",
  ".cs": "csharp",
};

export function detectLanguages(filePaths: string[]): string[] {
  const fileNames = new Set(filePaths.map((p) => p.split("/").pop() ?? ""));
  const detected = new Set<string>();

  // Config-file based (most reliable)
  for (const indicator of LANGUAGE_INDICATORS) {
    if (indicator.files.some((f) => fileNames.has(f))) {
      detected.add(indicator.language);
    }
  }

  // Extension-based fallback
  if (detected.size === 0) {
    for (const filePath of filePaths) {
      const ext = "." + filePath.split(".").pop()?.toLowerCase();
      const lang = EXTENSION_LANGUAGES[ext];
      if (lang) detected.add(lang);
    }
  }

  // If both JS and TS are detected, prefer TS
  if (detected.has("typescript") && detected.has("javascript")) {
    detected.delete("javascript");
  }

  return Array.from(detected);
}

// ─── Framework detection ─────────────────────────────────────────────────────

interface FrameworkDef {
  id: string;
  deps?: string[];           // package.json dependencies
  devDeps?: string[];        // package.json devDependencies
  files?: string[];          // presence of specific files
  language: string;
  runCommand: string;
  installCommand: string;
  port: number;
  isPreview: boolean;
  previewCommand?: string;
}

const FRAMEWORKS: FrameworkDef[] = [
  // JS/TS
  {
    id: "nextjs",
    deps: ["next"],
    language: "typescript",
    runCommand: "npm run dev -- --hostname 0.0.0.0",
    installCommand: "npm install",
    port: 3000,
    isPreview: true,
    previewCommand: "npm run dev -- --hostname 0.0.0.0",
  },
  {
    id: "react-vite",
    deps: ["react", "vite"],
    devDeps: ["vite"],
    language: "typescript",
    runCommand: "npm run dev -- --host",
    installCommand: "npm install",
    port: 5173,
    isPreview: true,
    previewCommand: "npm run dev -- --host",
  },
  {
    id: "svelte-kit",
    deps: ["@sveltejs/kit"],
    language: "javascript",
    runCommand: "npm run dev -- --host",
    installCommand: "npm install",
    port: 5173,
    isPreview: true,
    previewCommand: "npm run dev -- --host",
  },
  {
    id: "svelte",
    deps: ["svelte"],
    language: "javascript",
    runCommand: "npm run dev",
    installCommand: "npm install",
    port: 5000,
    isPreview: true,
    previewCommand: "npm run dev",
  },
  {
    id: "nestjs",
    deps: ["@nestjs/core"],
    language: "typescript",
    runCommand: "npm run start:dev",
    installCommand: "npm install",
    port: 3000,
    isPreview: false,
  },
  {
    id: "express",
    deps: ["express"],
    language: "javascript",
    runCommand: "node index.js",
    installCommand: "npm install",
    port: 3000,
    isPreview: false,
  },
  {
    id: "fastify",
    deps: ["fastify"],
    language: "javascript",
    runCommand: "node index.js",
    installCommand: "npm install",
    port: 3000,
    isPreview: false,
  },
  // Python
  {
    id: "fastapi",
    files: ["requirements.txt", "pyproject.toml"],
    deps: ["fastapi"],
    language: "python",
    runCommand: "uvicorn main:app --reload --host 0.0.0.0 --port 8000",
    installCommand: "pip install -r requirements.txt",
    port: 8000,
    isPreview: false,
  },
  {
    id: "django",
    files: ["requirements.txt", "manage.py"],
    deps: ["django"],
    language: "python",
    runCommand: "python manage.py runserver 0.0.0.0:8000",
    installCommand: "pip install -r requirements.txt",
    port: 8000,
    isPreview: false,
  },
  {
    id: "flask",
    files: ["requirements.txt"],
    deps: ["flask"],
    language: "python",
    runCommand: "python app.py",
    installCommand: "pip install -r requirements.txt",
    port: 5000,
    isPreview: false,
  },
  // Rust
  {
    id: "axum",
    files: ["Cargo.toml"],
    deps: ["axum"],
    language: "rust",
    runCommand: "cargo run",
    installCommand: "cargo fetch",
    port: 3000,
    isPreview: false,
  },
  {
    id: "actix",
    files: ["Cargo.toml"],
    deps: ["actix-web"],
    language: "rust",
    runCommand: "cargo run",
    installCommand: "cargo fetch",
    port: 8080,
    isPreview: false,
  },
  {
    id: "rocket",
    files: ["Cargo.toml"],
    deps: ["rocket"],
    language: "rust",
    runCommand: "cargo run",
    installCommand: "cargo fetch",
    port: 8000,
    isPreview: false,
  },
];

export function detectFramework(
  filePaths: string[],
  packageJsonContent?: string,
  requirementsContent?: string,
  cargoContent?: string,
): FrameworkDef | null {
  let pkgDeps: Record<string, string> = {};
  let pkgDevDeps: Record<string, string> = {};
  let pkgScripts: Record<string, string> = {};

  if (packageJsonContent) {
    try {
      const pkg = JSON.parse(packageJsonContent);
      pkgDeps = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };
      pkgDevDeps = pkg.devDependencies ?? {};
      pkgScripts = pkg.scripts ?? {};
    } catch {
      // ignore parse errors
    }
  }

  // Parse requirements.txt as a pseudo-dependency map
  const requirementsDeps: Record<string, string> = {};
  if (requirementsContent) {
    for (const line of requirementsContent.split("\n")) {
      const name = line.trim().split(/[=<>![\s]/)[0]?.toLowerCase();
      if (name) requirementsDeps[name] = "*";
    }
  }

  // Parse Cargo.toml deps (simple)
  const cargoDeps: Record<string, string> = {};
  if (cargoContent) {
    const matches = cargoContent.matchAll(/^(\w[\w-]+)\s*=/gm);
    for (const m of matches) {
      if (m[1]) cargoDeps[m[1]] = "*";
    }
  }

  const allDeps = { ...pkgDeps, ...pkgDevDeps, ...requirementsDeps, ...cargoDeps };
  const fileNames = new Set(filePaths.map((p) => p.split("/").pop() ?? ""));

  for (const fw of FRAMEWORKS) {
    const depsMatch =
      !fw.deps || fw.deps.some((d) => d in allDeps);
    const filesMatch =
      !fw.files || fw.files.some((f) => fileNames.has(f));

    if (depsMatch && filesMatch) {
      // Refine runCommand using package.json scripts if available
      if (packageJsonContent && pkgScripts) {
        const refined = { ...fw };
        if (pkgScripts["dev"]) {
          refined.runCommand = `npm run dev`;
          if (fw.isPreview) refined.previewCommand = `npm run dev`;
        } else if (pkgScripts["start"]) {
          refined.runCommand = `npm start`;
        }
        return refined;
      }
      return fw;
    }
  }

  return null;
}

// ─── Install command detection ────────────────────────────────────────────────

export function detectInstallCommand(filePaths: string[]): string | null {
  const fileNames = new Set(filePaths.map((p) => p.split("/").pop() ?? ""));

  if (fileNames.has("bun.lockb")) return "bun install";
  if (fileNames.has("yarn.lock")) return "yarn install";
  if (fileNames.has("package-lock.json")) return "npm ci";
  if (fileNames.has("pnpm-lock.yaml")) return "pnpm install";
  if (fileNames.has("package.json")) return "npm install";
  if (fileNames.has("requirements.txt")) return "pip install -r requirements.txt";
  if (fileNames.has("pyproject.toml")) return "pip install -e .";
  if (fileNames.has("Pipfile")) return "pipenv install";
  if (fileNames.has("Cargo.toml")) return "cargo fetch";
  if (fileNames.has("go.mod")) return "go mod download";
  if (fileNames.has("Gemfile")) return "bundle install";
  if (fileNames.has("composer.json")) return "composer install";
  if (fileNames.has("pom.xml")) return "mvn dependency:resolve -q";
  if (fileNames.has("build.gradle") || fileNames.has("build.gradle.kts")) {
    return "gradle dependencies";
  }

  return null;
}

// ─── Run command detection ────────────────────────────────────────────────────

export function detectRunCommand(
  filePaths: string[],
  primaryLanguage: string | null,
  packageJsonScripts?: Record<string, string>,
): string | null {
  const fileNames = new Set(filePaths.map((p) => p.split("/").pop() ?? ""));

  // Prefer package.json scripts
  if (packageJsonScripts) {
    if (packageJsonScripts["dev"]) return "npm run dev";
    if (packageJsonScripts["start"]) return "npm start";
  }

  if (fileNames.has("Procfile")) return null; // caller should parse
  if (fileNames.has("manage.py")) return "python manage.py runserver 0.0.0.0:8000";

  switch (primaryLanguage) {
    case "python":
      if (fileNames.has("main.py")) return "python main.py";
      if (fileNames.has("app.py")) return "python app.py";
      return "python main.py";
    case "rust":
      return "cargo run";
    case "go":
      if (fileNames.has("main.go")) return "go run main.go";
      return "go run .";
    case "java":
      if (fileNames.has("pom.xml")) return "mvn spring-boot:run";
      return "java -jar app.jar";
    case "ruby":
      if (fileNames.has("config.ru")) return "rails server -b 0.0.0.0";
      return "ruby main.rb";
    case "php":
      return "php -S 0.0.0.0:8000";
    case "javascript":
    case "typescript":
      if (fileNames.has("package.json")) return "npm start";
      return null;
    default:
      return null;
  }
}

// ─── Port detection ───────────────────────────────────────────────────────────

export function detectPort(framework: FrameworkDef | null, primaryLanguage: string | null): number | null {
  if (framework) return framework.port;

  switch (primaryLanguage) {
    case "python": return 8000;
    case "ruby": return 3000;
    case "php": return 8000;
    case "go": return 8080;
    case "rust": return 3000;
    case "java": return 8080;
    default: return null;
  }
}

// ─── Main: detectAll ──────────────────────────────────────────────────────────

export interface DetectAllOptions {
  filePaths: string[];
  packageJsonContent?: string;
  requirementsContent?: string;
  cargoContent?: string;
}

export function detectAll(opts: DetectAllOptions): DetectionResult {
  const { filePaths, packageJsonContent, requirementsContent, cargoContent } = opts;

  const languages = detectLanguages(filePaths);
  const primaryLanguage = languages[0] ?? null;

  const framework = detectFramework(
    filePaths,
    packageJsonContent,
    requirementsContent,
    cargoContent,
  );

  // Parse scripts for run command refinement
  let pkgScripts: Record<string, string> | undefined;
  if (packageJsonContent) {
    try {
      pkgScripts = JSON.parse(packageJsonContent).scripts;
    } catch {
      /* ignore */
    }
  }

  const installCommand =
    framework?.installCommand ?? detectInstallCommand(filePaths);

  const runCommand =
    framework?.runCommand ??
    detectRunCommand(filePaths, primaryLanguage, pkgScripts);

  const previewCommand = framework?.isPreview
    ? (framework.previewCommand ?? framework.runCommand)
    : null;

  const port = detectPort(framework, primaryLanguage);

  return {
    language: primaryLanguage,
    languages,
    framework: framework?.id ?? null,
    runCommand,
    installCommand,
    previewCommand,
    port,
    isPreview: framework?.isPreview ?? false,
  };
}
