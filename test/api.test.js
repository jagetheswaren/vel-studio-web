import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createApp} from '../server/app.js';
let root,server,base,mock,mockBase,lastRequest;
before(async()=>{
 root=await fs.mkdtemp(path.join(os.tmpdir(),'vel-api-'));const {app}=await createApp({dataDir:root});server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
 mock=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;lastRequest={url:req.url,auth:req.headers.authorization,body:body?JSON.parse(body):null};res.setHeader('Content-Type','application/json');if(req.url==='/api/tags')res.end(JSON.stringify({models:[{name:'local-test'}]}));else if(req.url==='/v1/models')res.end(JSON.stringify({data:[{id:'cloud-test'}]}));else if(req.url==='/api/chat')res.end(JSON.stringify({message:{content:'Local reply ✓'}}));else if(req.url==='/v1/chat/completions')res.end(JSON.stringify({choices:[{message:{content:'Cloud reply'}}]}));else res.end(JSON.stringify({result:'plugin result',input:lastRequest.body?.input}));});mock.listen(0,'127.0.0.1');await new Promise(r=>mock.once('listening',r));mockBase=`http://127.0.0.1:${mock.address().port}`;
});
after(async()=>{await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>mock.close(r))]);await fs.rm(root,{recursive:true,force:true});});
async function api(route,{method='GET',body,headers={}}={}){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json','X-Vel-Client':'local',...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
test('workspace CRUD persists and blocks path traversal',async()=>{
 const initial=await api('/api/workspaces');assert.equal(initial.workspaces[0].id,'welcome');
 const created=await api('/api/workspaces',{method:'POST',body:{name:'Test workspace'}});assert.equal(created.status,201);
 const body={workspace:created.id,path:'src/test.vel',content:'T "A"',create:true};assert.equal((await api('/api/file',{method:'PUT',body})).ok,true);
 assert.equal((await api(`/api/file?workspace=${created.id}&path=src/test.vel`)).content,'T "A"');
 assert.equal((await api('/api/file',{method:'PUT',body})).status,409);
 for(const p of ['../secret','a/../../secret','C:/secret','a\\b','a/.secret','CON','src/test.vel:secret'])assert.equal((await api('/api/file',{method:'PUT',body:{...body,path:p}})).status,400,p);
 assert.equal((await api('/api/file',{method:'DELETE',body:{workspace:created.id,path:'src/test.vel'}})).ok,true);
 assert.equal((await api(`/api/file?workspace=${created.id}&path=src/test.vel`)).status,404);
});
test('local API rejects cross-origin and missing header mutations',async()=>{
 const r=await fetch(base+'/api/workspaces',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":"Blocked"}'});assert.equal(r.status,403);
 assert.equal((await api('/api/workspaces',{method:'POST',body:{name:'Blocked'},headers:{Origin:'https://evil.example'}})).status,403);
 const hostStatus=await new Promise((resolve,reject)=>{http.get(base+'/api/health',{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});assert.equal(hostStatus,403);
});
test('preview endpoint adds network isolation and diagnostics',async()=>{const p=await api('/api/preview',{method:'POST',body:{source:'T "Hi"',path:'main.vel'}});assert.match(p.html,/connect-src 'none'/);assert.equal(p.diagnostics.length,0);});
test('provider adapters connect, send context and keep keys off responses and disk plaintext',async()=>{
 let settings=await api('/api/settings');settings.providers=settings.providers.map(p=>({...p,baseUrl:mockBase+(p.type==='ollama'?'':'/v1'),model:p.type==='ollama'?'local-test':'cloud-test',apiKey:'secret-for-test'}));
 const saved=await api('/api/settings',{method:'PUT',body:settings});assert.equal(saved.status,200);assert.equal(saved.providers[0].hasKey,true);assert.ok(!JSON.stringify(saved).includes('secret-for-test'));assert.ok(!(await fs.readFile(path.join(root,'settings.json'),'utf8')).includes('secret-for-test'));
 assert.deepEqual((await api('/api/models',{method:'POST',body:{providerId:'ollama'}})).models,['local-test']);assert.deepEqual((await api('/api/models',{method:'POST',body:{providerId:'openai'}})).models,['cloud-test']);
 for(const [id,expected] of [['ollama','Local reply ✓'],['openai','Cloud reply'],['compatible','Cloud reply']]){const r=await api('/api/chat',{method:'POST',body:{providerId:id,messages:[{role:'user',content:'Help'}],context:{path:'main.vel',content:'T "Hello"'}}});assert.equal(r.content,expected);assert.equal(lastRequest.auth,'Bearer secret-for-test');assert.match(lastRequest.body.messages[0].content,/Current file context/);}
 const noContext=await api('/api/chat',{method:'POST',body:{providerId:'ollama',messages:[{role:'user',content:'Hello'}]}});assert.equal(noContext.status,200);assert.doesNotMatch(lastRequest.body.messages[0].content,/Current file context/);
 settings=await api('/api/settings');assert.equal((await api('/api/settings',{method:'PUT',body:settings})).providers[0].hasKey,true);
 assert.equal((await api('/api/chat',{method:'POST',body:{providerId:'ollama',messages:[{role:'system',content:'bad'}]}})).status,400);
});
test('plugin lifecycle requires enable and forwards only explicit input',async()=>{
 const p=await api('/api/plugins',{method:'POST',body:{name:'Mock plugin',description:'Integration test',url:mockBase+'/plugin',apiKey:'plugin-secret'}});assert.equal(p.status,201);assert.equal(p.enabled,false);assert.ok(!JSON.stringify(p).includes('plugin-secret'));
 assert.equal((await api(`/api/plugins/${p.id}/run`,{method:'POST',body:{input:'hello'}})).status,400);
 await api(`/api/plugins/${p.id}`,{method:'PATCH',body:{enabled:true}});const r=await api(`/api/plugins/${p.id}/run`,{method:'POST',body:{input:'hello'}});assert.equal(r.output.input,'hello');assert.deepEqual(lastRequest.body,{input:'hello'});assert.equal(lastRequest.auth,'Bearer plugin-secret');
 assert.equal((await api(`/api/plugins/${p.id}`,{method:'DELETE'})).ok,true);
});
test('workspace console validates and exports without arbitrary shell execution',async()=>{
 const run=command=>api('/api/terminal',{method:'POST',body:{workspace:'welcome',command}});
 assert.equal((await run('check src/main.vel')).exitCode,0);assert.equal((await run('build src/main.vel')).exitCode,0);assert.match((await api('/api/file?workspace=welcome&path=build/index.html')).content,/<!doctype html>/);
 assert.equal((await run('powershell Get-Process')).exitCode,1);assert.match((await run('ls')).output,/src\/main.vel/);
 assert.equal((await api('/api/native-build',{method:'POST',body:{workspace:'welcome',path:'src/main.vel'}})).status,400);
});
test('endpoint validator rejects remote cleartext and credentials',async()=>{
 const s=await api('/api/settings');for(const value of ['http://example.com','file:///etc/passwd','https://user:pass@example.com','https://example.com?q=secret']){s.providers[0].baseUrl=value;assert.equal((await api('/api/settings',{method:'PUT',body:s})).status,400);}
});
test('studio template API and export preserve one validated document',async()=>{
 const result=await api('/api/studio/templates');assert.equal(result.templates.length,3);const source=result.templates.find(t=>t.id==='starter').source;assert.equal(JSON.parse(source).kind,'vel-studio');
 const response=await fetch(base+'/api/studio/export',{method:'POST',headers:{'Content-Type':'application/json','X-Vel-Client':'local'},body:JSON.stringify({source})});assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment.*\.html/);const html=await response.text();assert.match(html,/id="vel-document"/);assert.match(html,/id="vel-player"/);assert.ok(html.length>100000);
 assert.equal((await api('/api/studio/export',{method:'POST',body:{source:'{}'}})).status,400);
 const workspace=await api('/api/workspaces',{method:'POST',body:{name:'Studio export test'}});const files=await api(`/api/files?workspace=${workspace.id}`);assert.ok(files.files.some(f=>f.path==='src/studio.vel'));
});
