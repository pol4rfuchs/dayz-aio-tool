import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('src/db/schema.sql');
const dst = path.resolve('dist/db/schema.sql');
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
