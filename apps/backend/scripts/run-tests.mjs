#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const testRoot = fileURLToPath(new URL('../test/', import.meta.url));
const backendRoot = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

let files = [];
try {
  if (statSync(testRoot).isDirectory()) {
    files = walk(testRoot).sort();
  }
} catch {
  files = [];
}

if (files.length === 0) {
  console.log('[test] No backend test files found under apps/backend/test/**/*.test.ts; skipping.');
  process.exit(0);
}

const displayFiles = files.map((file) => file.split(`${sep}apps${sep}backend${sep}`).pop() ?? file);
console.log(`[test] Running ${files.length} backend test file(s):`);
for (const file of displayFiles) {
  console.log(`  - ${file}`);
}

const result = spawnSync(process.execPath, [
  '--import',
  'tsx',
  '--test',
  ...files,
], {
  stdio: 'inherit',
  cwd: backendRoot,
  env: process.env,
});

if (result.error) {
  console.error(`[test] Failed to launch test runner: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
