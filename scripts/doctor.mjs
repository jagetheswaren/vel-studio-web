import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const checks = [
  {
    name: 'Node.js 22 or newer',
    ok: Number(process.versions.node.split('.')[0]) >= 22,
    detail: process.version,
  },
];
for (const [name, file] of [
  ['Built frontend', 'dist/index.html'],
  ['Offline studio runtime', 'server/generated/player.js'],
]) {
  try {
    await fs.access(path.join(root, file));
    checks.push({ name, ok: true, detail: file });
  } catch {
    checks.push({ name, ok: false, detail: 'Run npm run build.' });
  }
}
try {
  await import('express');
  checks.push({ name: 'Backend dependencies', ok: true, detail: 'Installed' });
} catch {
  checks.push({ name: 'Backend dependencies', ok: false, detail: 'Run npm ci.' });
}
const result = { version: pkg.version, ok: checks.every((c) => c.ok), checks };
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log('Vel Studio ' + pkg.version + ' · launch checks');
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}: ${c.detail}`);
  console.log(
    result.ok
      ? 'Ready: npm start (browser) or npm run desktop (desktop).'
      : 'Fix the failed checks, then run npm run doctor again.',
  );
}
if (!result.ok) process.exitCode = 1;
