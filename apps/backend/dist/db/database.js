import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { DB_PATH, DATA_DIR } from "../shared/env.js";
import { encryptSecret, isEncryptedSecret } from "../shared/secrets.js";
let db;
export function getDb() {
    if (!db) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        db = new Database(DB_PATH);
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");
    }
    return db;
}
function ensureColumn(table, column, ddl) {
    const columns = getDb().prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((item) => item.name === column)) {
        getDb().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
}
export function closeDatabase() {
    if (db) {
        db.close();
        db = undefined;
    }
}
export function initDatabase() {
    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    getDb().exec(schema);
    ensureColumn("servers", "mission_path", "TEXT NOT NULL DEFAULT ''");
    ensureColumn("servers", "steamcmd_path", "TEXT");
    ensureColumn("servers", "workshop_app_id", "TEXT NOT NULL DEFAULT '221100'");
    ensureColumn("mods", "workshop_id", "TEXT");
    ensureColumn("schedules", "failure_count", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("schedules", "last_error", "TEXT");
    const rconRows = getDb().prepare("SELECT id, rcon_password as rconPassword FROM servers WHERE rcon_password IS NOT NULL AND rcon_password != ''").all();
    for (const row of rconRows) {
        if (!isEncryptedSecret(row.rconPassword)) {
            getDb().prepare("UPDATE servers SET rcon_password = ? WHERE id = ?").run(encryptSecret(row.rconPassword), row.id);
        }
    }
}
