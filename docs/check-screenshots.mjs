// Verifies every screenshot is within Upwork's 4000x4000 px upload limit.
// Reads PNG dimensions straight from the IHDR header (no dependencies).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');
const LIMIT = 4000;
let allOk = true;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.png')).sort()) {
  const buf = readFileSync(join(dir, file));
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const ok = width <= LIMIT && height <= LIMIT;
  if (!ok) allOk = false;
  console.log(`${ok ? 'OK ' : 'BIG'}  ${file.padEnd(30)} ${width} x ${height}`);
}

console.log(allOk ? '\nAll screenshots are within 4000 x 4000 px.' : '\nSome screenshots exceed the limit.');
process.exit(allOk ? 0 : 1);
