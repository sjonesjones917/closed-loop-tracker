import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const first=path.join(root,'.verify-deployment-a');
const second=path.join(root,'.verify-deployment-b');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=value=>{
  if(value===null)return 'null';
  if(typeof value==='boolean')return value?'true':'false';
  if(typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))throw new TypeError('Invalid canonical number.');return String(value);}
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&Object.getPrototypeOf(value)===Object.prototype)return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  throw new TypeError('Invalid canonical value.');
};
const build=out=>execFileSync(process.execPath,['build-static-site.mjs','--out',out,'--source-commit','TEST-COMMIT','--workflow-run','TEST-RUN'],{stdio:'pipe'});
try{
  build(first);build(second);
  const manifestBytesA=fs.readFileSync(path.join(first,'closed-loop-deployment-manifest.json'));
  const manifestBytesB=fs.readFileSync(path.join(second,'closed-loop-deployment-manifest.json'));
  if(!manifestBytesA.equals(manifestBytesB))throw new Error('Two clean builds did not produce the same deployment manifest.');
  const manifest=JSON.parse(manifestBytesA);
  if(manifest.schema!=='closed-loop-deployment-manifest/1')throw new Error('Wrong deployment manifest schema.');
  const withoutDigest={...manifest};delete withoutDigest.manifestDigest;
  if(manifest.manifestDigest?.hashAlgorithm!=='SHA-256'||manifest.manifestDigest?.digest!==sha256(Buffer.from(canonical(withoutDigest),'utf8')))throw new Error('Deployment manifest digest mismatch.');
  if(!Array.isArray(manifest.runtimeResources)||manifest.runtimeResources.length!==13)throw new Error('Deployment resource closure is incomplete.');
  const paths=new Set();
  for(const resource of manifest.runtimeResources){
    if(paths.has(resource.path))throw new Error(`Duplicate deployment path: ${resource.path}`);paths.add(resource.path);
    const bytes=fs.readFileSync(path.join(first,resource.path));
    if(resource.byteSize!==bytes.length||resource.hashAlgorithm!=='SHA-256'||resource.digest!==sha256(bytes))throw new Error(`Deployment digest mismatch: ${resource.path}`);
    if(resource.buildIdentity!==manifest.buildIdentity)throw new Error(`Mixed build identity: ${resource.path}`);
  }
  const html=fs.readFileSync(path.join(first,'index.html'),'utf8');
  const tokens=[...html.matchAll(/<script\s+defer\s+src="[^"]+\?v=([^"]+)"/g)].map(match=>match[1]);
  if(tokens.length!==9||tokens.some(token=>token!==manifest.buildIdentity))throw new Error('HTML runtime graph has mixed build identities.');
  if(!html.includes(`<meta name="closed-loop-build-identity" content="${manifest.buildIdentity}">`))throw new Error('Executed build identity meta is missing.');
  const active=manifest.runtimeResources.filter(item=>/\.(?:html|js)$/.test(item.path)).map(item=>fs.readFileSync(path.join(first,item.path),'utf8')).join('\n');
  if(/serviceWorker\s*\.\s*register|navigator\s*\.\s*serviceWorker/.test(active))throw new Error('An unmanifested controlling service worker is present.');
  if(!fs.readFileSync(path.join(first,'test-runtime.js'),'utf8').includes("url.search=new URL(source).search"))throw new Error('Worker does not inherit the runtime build identity.');
  console.log(JSON.stringify({deploymentManifest:'PASS',schema:manifest.schema,resources:manifest.runtimeResources.length,buildIdentity:manifest.buildIdentity,manifestDigest:manifest.manifestDigest.digest,reproducible:true,noControllingServiceWorker:true},null,2));
}finally{
  fs.rmSync(first,{recursive:true,force:true});fs.rmSync(second,{recursive:true,force:true});
}
