#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lockfile = path.join(root, 'pnpm-lock.yaml');
const packageFile = path.join(root, 'package.json');

function fail(message) {
  console.error(`::error::${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(lockfile)) {
  fail('pnpm-lock.yaml is missing. Generate and commit it before running frozen installs or releases.');
  process.exit();
}

if (fs.existsSync(path.join(root, 'package-lock.json'))) {
  fail('package-lock.json is stale. This repository uses pnpm; remove it.');
}

const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
const projectVersion = String(pkg.version || '').trim();
const lock = fs.readFileSync(lockfile, 'utf8');

if (!projectVersion) {
  fail('Root package.json has no version field.');
}

const forbiddenDependencyVersion = new RegExp(`^\\s+version:\\s+${projectVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
if (forbiddenDependencyVersion.test(lock)) {
  fail(`pnpm-lock.yaml contains the project version '${projectVersion}' as a dependency version. A release/version bump script likely modified the lockfile incorrectly.`);
}


if (process.exitCode) {
  process.exit();
}

console.log('pnpm lockfile integrity OK');
