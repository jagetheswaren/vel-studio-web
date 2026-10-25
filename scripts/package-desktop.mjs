import {packager} from '@electron/packager';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await fs.access(path.join(root,'dist/index.html'));
await fs.access(path.join(root,'server/generated/player.js'));
const output=path.resolve(root,'..','desktop-build');
const destinations=await packager({dir:root,name:'Vel Studio',platform:'win32',arch:'x64',out:output,overwrite:false,prune:true,asar:true,icon:undefined,
 ignore:[/^\/(\.vel-data|\.playwright-cli|output|test|src|runtime|scripts|examples|extensions)(\/|$)/,/^\/(README|VERIFICATION|PRODUCT_ANALYSIS|ARCHITECTURE|STUDIO_LANGUAGE|DEVELOPMENT_ROADMAP)\.md$/,/^\/package-lock\.json$/],
 appVersion:'0.2.0',appCopyright:'Vel Studio local prototype',win32metadata:{CompanyName:'Vel Studio',FileDescription:'Unified design, code and 3D studio',ProductName:'Vel Studio'}});
console.log(destinations.map(p=>path.join(p,'Vel Studio.exe')).join('\n'));
