import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'server/generated/player.js');
if (process.argv.includes('--if-missing')) {
  try {
    await fs.access(output);
    process.exit(0);
  } catch {}
}
await build({
  entryPoints: [path.join(root, 'runtime/player.js')],
  outfile: output,
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'eof',
  logLevel: 'info',
});
