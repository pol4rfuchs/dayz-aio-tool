import fs from "node:fs";
import path from "node:path";

// Resolves symlinks/junctions for the deepest existing ancestor, so a link inside the root cannot
// redirect a (possibly not yet existing) target outside of it.
function realpathOfExistingPrefix(input: string) {
  const resolved = path.resolve(input);
  const missing: string[] = [];
  let current = resolved;
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(current), ...missing.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return resolved;
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

function isOutside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

export function assertInsideRoot(rootPath: string, targetPath: string) {
  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  if (isOutside(root, target) || isOutside(realpathOfExistingPrefix(root), realpathOfExistingPrefix(target))) {
    throw Object.assign(new Error(`Blocked unsafe path outside root: ${target}`), { statusCode: 400 });
  }
  return target;
}
