import path from "node:path";

export function assertInsideRoot(rootPath: string, targetPath: string) {
  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw Object.assign(new Error(`Blocked unsafe path outside root: ${target}`), { statusCode: 400 });
  }
  return target;
}
