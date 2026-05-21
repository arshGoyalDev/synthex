/**
 * Maps file extensions to Monaco Editor language IDs.
 * Monaco has built-in tokenizers for all languages listed here; files with
 * unknown extensions fall back to "plaintext" (no highlighting).
 */
const EXT_TO_MONACO: Record<string, string> = {
  // Web
  js: "javascript",
  jsx: "javascript",        // Monaco uses 'javascript' for JSX files
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",        // Monaco uses 'typescript' for TSX files
  mts: "typescript",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",

  // Data / config
  json: "json",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",          // Monaco has no TOML tokenizer; ini is close
  ini: "ini",
  env: "ini",
  xml: "xml",
  svg: "xml",
  graphql: "graphql",
  gql: "graphql",

  // Systems
  c: "c",
  h: "c",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  "c++": "cpp",
  hpp: "cpp",
  rs: "rust",
  go: "go",
  zig: "plaintext",     // no built-in Monaco support
  v: "plaintext",       // Vlang — no built-in support

  // JVM
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  groovy: "plaintext",  // no built-in Monaco tokenizer
  clj: "clojure",
  cljs: "clojure",
  cljc: "clojure",

  // Scripting
  py: "python",
  pyw: "python",
  rb: "ruby",
  php: "php",
  lua: "lua",
  r: "r",
  dart: "dart",
  swift: "swift",
  jl: "julia",
  ex: "elixir",
  exs: "elixir",
  erl: "plaintext",     // no built-in Monaco
  sol: "sol",           // Solidity

  // .NET / ML
  cs: "csharp",
  fs: "fsharp",
  vb: "vb",
  m: "objective-c",
  mm: "objective-c",

  // Shell
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  ps1: "powershell",
  bat: "bat",
  cmd: "bat",

  // Docs / markup
  md: "markdown",
  mdx: "mdx",
  rst: "restructuredtext",
  tex: "latex",
  pug: "pug",
  handlebars: "handlebars",
  hbs: "handlebars",

  // DB
  sql: "sql",
  pgsql: "pgsql",
  mysql: "mysql",
  redis: "redis",

  // Config / infra
  dockerfile: "dockerfile",
  tf: "hcl",
  hcl: "hcl",
  proto: "protobuf",
  bicep: "bicep",
  wgsl: "wgsl",
};

/**
 * Returns the Monaco Editor language ID for a given filename or extension.
 * Handles dotfiles (e.g. ".env"), bare names ("Dockerfile"), and extensions.
 */
export function getMonacoLanguage(fileName: string): string {
  const lower = fileName.toLowerCase();

  // Bare filenames without an extension
  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) return "dockerfile";
  if (lower === "makefile" || lower === "gnumakefile") return "makefile";
  if (lower === ".env" || lower.startsWith(".env.")) return "ini";
  if (lower === ".gitignore" || lower === ".gitattributes") return "ini";
  if (lower === "cargo.lock" || lower === "package-lock.json") return "json";

  // Extract extension (handles dotfiles like ".eslintrc" → ext = "eslintrc")
  const parts = lower.split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1] : lower;

  return EXT_TO_MONACO[ext] ?? "plaintext";
}
