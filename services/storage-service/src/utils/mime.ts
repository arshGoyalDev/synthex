const MIME_MAP: Record<string, string> = {
  ts: "text/typescript",
  tsx: "text/typescript",
  js: "text/javascript",
  jsx: "text/javascript",
  py: "text/x-python",
  rs: "text/x-rust",
  go: "text/x-go",
  java: "text/x-java",
  cpp: "text/x-c++",
  c: "text/x-c",
  rb: "text/x-ruby",
  php: "text/x-php",
  html: "text/html",
  css: "text/css",
  json: "application/json",
  md: "text/markdown",
  toml: "text/x-toml",
  yaml: "text/yaml",
  yml: "text/yaml",
  sh: "text/x-shellscript",
  dockerfile: "text/x-dockerfile",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  pdf: "application/pdf",
  zip: "application/zip",
};

const BINARY_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif",
  "application/pdf", "application/zip",
  "image/x-icon",
]);

export function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_MAP[ext] ?? "text/plain";
}

export function isBinary(mimeType: string): boolean {
  return BINARY_TYPES.has(mimeType);
}