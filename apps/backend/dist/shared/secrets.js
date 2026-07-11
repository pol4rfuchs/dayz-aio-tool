import crypto from "node:crypto";
import { SECRET_KEY } from "./env.js";
const PREFIX = "enc:v1:";
function key() {
    return crypto.createHash("sha256").update(SECRET_KEY, "utf8").digest();
}
export function isEncryptedSecret(value) {
    return Boolean(value?.startsWith(PREFIX));
}
export function encryptSecret(value) {
    if (!value)
        return null;
    if (isEncryptedSecret(value))
        return value;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}
export function decryptSecret(value) {
    if (!value)
        return null;
    if (!isEncryptedSecret(value))
        return value;
    const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
export function maskSecret(value) {
    return value ? "***" : null;
}
