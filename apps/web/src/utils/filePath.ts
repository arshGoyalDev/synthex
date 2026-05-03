const ensureLeadingSlash = (path: string) =>
  path.startsWith("/") ? path : `/${path}`;

const stripLeadingSlash = (path: string) =>
  path.startsWith("/") ? path.slice(1) : path;

const encodeFilePath = (path: string) =>
  stripLeadingSlash(path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const getFileLanguage = (path: string): string | undefined => {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  if (ext === "ts" || ext === "tsx") return "typescript";
  if (ext === "js" || ext === "jsx") return "javascript";
  if (ext === "json") return "json";
  if (ext === "css") return "css";
  if (ext === "md") return "markdown";
  if (ext === "html") return "html";
  if (ext === "yml" || ext === "yaml") return "yaml";
  if (ext === "go") return "go";
  if (ext === "py") return "python";
  if (ext === "java") return "java";
  if (ext === "rb") return "ruby";
  if (ext === "rs") return "rust";
  if (ext === "php") return "php";
  if (ext === "sh") return "shell";
  return undefined;
};

export {
  ensureLeadingSlash,
  stripLeadingSlash,
  encodeFilePath,
  getFileLanguage,
};
