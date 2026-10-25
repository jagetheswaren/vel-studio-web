// Optional local HTTP plugin example. Start: node examples/plugin-server.mjs
import http from 'node:http';
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.method!=='POST'||req.url!=='/run'){res.writeHead(404);res.end(JSON.stringify({error:'POST /run with JSON {input:string}'}));return;}
 try{let body='';for await(const chunk of req){body+=chunk;if(body.length>50000)throw new Error('Input too large.');}const {input}=JSON.parse(body);if(typeof input!=='string')throw new Error('input must be a string.');res.end(JSON.stringify({tool:'Text inspector',characters:input.length,words:input.trim()?input.trim().split(/\s+/).length:0,lines:input.split('\n').length}));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}));}
});
server.listen(4320,'127.0.0.1',()=>console.log('Example plugin: http://127.0.0.1:4320/run'));
