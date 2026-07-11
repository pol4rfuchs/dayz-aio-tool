import path from "node:path";
import { crc32 } from "../../shared/crc32.js";

export type ZipEntry = {
  name: string;
  content: Buffer | string;
  date?: Date;
};

function dosTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getSeconds() >> 1) | (date.getMinutes() << 5) | (date.getHours() << 11);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dosDate = day | (month << 5) | ((year - 1980) << 9);
  return { time, date: dosDate };
}

function normalizedName(name: string) {
  return name.replace(/\\/g, "/").replace(/^\/+/, "").split("/").filter(Boolean).join("/");
}

export function createStoredZip(entries: ZipEntry[]) {
  if (entries.length > 65535) {
    throw new Error(`ZIP entry limit exceeded: ${entries.length} > 65535. Debug bundles are intentionally bounded.`);
  }
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = normalizedName(entry.name);
    if (!name || name.includes("..")) continue;
    const nameBuffer = Buffer.from(name, "utf8");
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, "utf8");
    if (nameBuffer.length > 0xffff) throw new Error(`ZIP entry name is too long: ${name}`);
    if (content.length > 0xffffffff) throw new Error(`ZIP entry is too large for non-Zip64 writer: ${name}`);
    if (offset > 0xffffffff) throw new Error("ZIP archive offset exceeds non-Zip64 limit.");
    const crc = crc32(content);
    const stamp = dosTime(entry.date ?? new Date());

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8); // stored/no compression
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length >>> 0, 18);
    local.writeUInt32LE(content.length >>> 0, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length >>> 0, 20);
    central.writeUInt32LE(content.length >>> 0, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset >>> 0, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + content.length;
  }

  const centralStart = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const entryCount = centralParts.length / 2;
  if (entryCount > 65535) throw new Error(`ZIP entry limit exceeded after filtering: ${entryCount} > 65535.`);
  if (centralStart > 0xffffffff || centralSize > 0xffffffff) throw new Error("ZIP archive exceeds non-Zip64 size limits.");
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entryCount, 8);
  end.writeUInt16LE(entryCount, 10);
  end.writeUInt32LE(centralSize >>> 0, 12);
  end.writeUInt32LE(centralStart >>> 0, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

export function zipPath(...parts: string[]) {
  return path.posix.join(...parts.map((part) => part.replace(/\\/g, "/")));
}
