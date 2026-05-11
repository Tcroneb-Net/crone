export function sanitizePath(input: string) {
  return input
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .filter((part) => part !== "." && part !== "..")
    .join("/");
}

export function isTextFile(path: string) {
  return /\.(html|css|js|ts|tsx|jsx|json|md|txt|svg|xml|yml|yaml|env|sql)$/i.test(path);
}
