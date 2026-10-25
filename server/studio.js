import fs from 'node:fs';
import { parseStudio, animationDuration } from '../shared/studio.js';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const runtimePath = new URL('./generated/player.js',import.meta.url);
export function compileStudio(source){
 let doc;try{doc=parseStudio(source);}catch(e){return {html:`<!doctype html><html><body style="background:#121c27;color:#e8b7ad;font:14px/1.6 system-ui;padding:28px"><h2>Studio document needs attention</h2><pre style="white-space:pre-wrap">${escape(e.message)}</pre></body></html>`,diagnostics:[{line:1,message:e.message,severity:'error'}],tracks:[],duration:1000};}
 if(!fs.existsSync(runtimePath))throw new Error('The studio runtime is not built. Run npm run build, then restart the server.');
 const runtime=fs.readFileSync(runtimePath,'utf8').replace(/<\/script/gi,'<\\/script');
 const json=JSON.stringify(doc).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(doc.name)} · Vel Studio</title><style>html,body,#vel-player{margin:0;min-height:100%;font-family:system-ui,sans-serif}body{background:#111923;color:#e5eee9}</style></head><body><div id="vel-player"></div><script id="vel-document" type="application/json">${json}</script><script>${runtime}</script></body></html>`;
 const names=new Map([...doc.design.nodes,...doc.scene.entities].map(n=>[n.id,n.name]));
 return {html,diagnostics:[],tracks:doc.animations.map(a=>({name:names.get(a.target)||a.target,property:a.property,duration:a.duration,delay:a.delay})),duration:animationDuration(doc)};
}
