import fs from "node:fs/promises";
import path from "node:path";
import { createBackup } from "../backups/service.js";

export async function readTextFile(filePath: string) {
  return fs.readFile(filePath, "utf8");
}

export async function writeTextFileWithBackup(input: {
  serverId: string;
  filePath: string;
  backupType: string;
  reason: string;
  content: string;
}) {
  // A brand-new file (e.g. the first messages.xml) has nothing to back up yet.
  const alreadyExists = await fs.access(input.filePath).then(() => true, () => false);
  if (alreadyExists) {
    await createBackup({
      serverId: input.serverId,
      type: input.backupType,
      reason: input.reason,
      files: [input.filePath]
    });
  }

  const tmpPath = `${input.filePath}.dayz-aio.tmp`;
  await fs.mkdir(path.dirname(input.filePath), { recursive: true });
  await fs.writeFile(tmpPath, input.content, "utf8");
  await fs.rename(tmpPath, input.filePath);
}
