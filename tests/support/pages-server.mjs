// Test-only HTTP server: no SPA fallback, no Vite middleware, no user profile.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const base='/BetterLumi/';
let revision=0;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.wasm':'application/wasm','.gz':'application/gzip'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  // A memory-only update simulation; never included in the production artifact.
  if(url.pathname==='/__test__/revision'&&req.method==='POST'){revision++;res.writeHead(200);res.end(String(revision));return;}
  if(!url.pathname.startsWith(base)){res.writeHead(404);res.end('Not found');return;}
  try {
    const relative=decodeURIComponent(url.pathname.slice(base.length))||'index.html';
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end('Not found');return;}
    if(!(await stat(file)).isFile())throw Error('Not a file');
    let body=await readFile(file);
    if(relative==='sw.js')body=Buffer.concat([body,Buffer.from('\n// Test update revision '+revision)]);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(5201,'127.0.0.1');
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>server.close(()=>process.exit(0)));
