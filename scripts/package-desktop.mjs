import { packager } from '@electron/packager';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.access(path.join(root, 'dist/index.html'));
await fs.access(path.join(root, 'server/generated/player.js'));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const outputFlag = process.argv.indexOf('--output');
const output =
  outputFlag >= 0 && process.argv[outputFlag + 1]
    ? path.resolve(root, process.argv[outputFlag + 1])
    : path.resolve(root, '..', 'desktop-build', 'v' + manifest.version);
const destinations = await packager({
  dir: root,
  name: 'Vel Studio',
  platform: 'win32',
  arch: 'x64',
  out: output,
  overwrite: false,
  prune: true,
  asar: true,
  icon: undefined,
  ignore: [
    /^\/(\.vel-data|\.playwright-cli|\.github|output|test|src|runtime|scripts|examples|extensions)(\/|$)/,
    /^\/node_modules\/(monaco-editor|@monaco-editor|react|react-dom|lucide-react|three)(\/|$)/,
    /^\/(README|VERIFICATION|PRODUCT_ANALYSIS|ARCHITECTURE|STUDIO_LANGUAGE|DEVELOPMENT_ROADMAP|PROJECTS_AND_LAUNCH)\.md$/,
    /^\/package-lock\.json$/,
  ],
  appVersion: manifest.version,
  appCopyright: 'Vel Studio local application',
  win32metadata: {
    CompanyName: 'Vel Studio',
    FileDescription: 'Unified design, code and 3D studio',
    ProductName: 'Vel Studio',
  },
});
console.log(destinations.map((p) => path.join(p, 'Vel Studio.exe')).join('\n'));
