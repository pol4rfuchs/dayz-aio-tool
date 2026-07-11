#!/usr/bin/env node
// Guards against the case where a new sensitive env var (API key, secret,
// password, token) gets read in shared/env.ts but nobody adds a matching
// masking rule in modules/debug/masking.ts. Without this check, the new
// secret would leak into every Debug Bundle export in plaintext.

import fs from "node:fs";
import path from "node:path";

const ENV_FILE = path.resolve("apps/backend/src/shared/env.ts");
const MASKING_FILE = path.resolve("apps/backend/src/modules/debug/masking.ts");

const SENSITIVE_NAME_PATTERN = /\b(KEY|SECRET|PASSWORD|PASS|TOKEN)\b/i;
const ENV_VAR_PATTERN = /process\.env\.([A-Z0-9_]+)/g;

function readFileOrFail(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(`Could not read ${filePath}: ${error.message}`);
    process.exit(1);
  }
}

const envSource = readFileOrFail(ENV_FILE);
const maskingSource = readFileOrFail(MASKING_FILE);

const sensitiveVars = new Set();
let match;
while ((match = ENV_VAR_PATTERN.exec(envSource)) !== null) {
  const name = match[1];
  if (SENSITIVE_NAME_PATTERN.test(name)) sensitiveVars.add(name);
}

const missing = [...sensitiveVars].filter((name) => !maskingSource.includes(name));

if (missing.length > 0) {
  console.error(
    "The following sensitive env vars are read in apps/backend/src/shared/env.ts\n" +
      "but have no matching masking rule in apps/backend/src/modules/debug/masking.ts:\n"
  );
  for (const name of missing) console.error(`  - ${name}`);
  console.error(
    "\nAdd a masking pattern for each before merging, or the Debug Bundle export\n" +
      "will include the raw value the next time someone exports it."
  );
  process.exit(1);
}

console.log(
  `Secret-masking check passed. ${sensitiveVars.size} sensitive env var(s) verified: ` +
    [...sensitiveVars].join(", ")
);
