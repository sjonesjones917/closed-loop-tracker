import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const first=path.join(root,'.verify-deployment-a');
const second=path.join(root,'.verify-deployment-b');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assertUnicodeScalars=(value,label='canonical string')=>{for(let i=0;i<value.length;i++){const unit=value.charCodeAt(i);if(unit>=0xD800&&unit<=0xDBFF){const next=value.charCodeAt(i+1);if(!(next>=0xDC00&&next<=0xDFFF))throw new TypeError(`Unpaired UTF-16 high surrogate in ${label}.`);i++;}else if(unit>=0xDC00&&unit<=0xDFFF)throw new TypeError(`Unpaired UTF-16 low surrogate in ${label}.`);}return value;};
const compareUnicodeScalarSequence=(a,b)=>{const left=Array.from(assertUnicodeScalars(String(a),'canonical object key'),ch=>ch.codePointAt(0));const right=Array.from(assertUnicodeScalars(String(b),'canonical object key'),ch=>ch.codePointAt(0));const length=Math.min(left.length,right.length);for(let i=0;i<length;i++)if(left[i]!==right[i])return left[i]-right[i];return left.length-right.length;};
const canonical=value=>{
  if(value===null)return 'null';
  if(typeof value==='boolean')return value?'true':'false';
  if(typeof value==='string')return JSON.stringify(assertUnicodeScalars(value));
  if(typeof value==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))throw new TypeError('Invalid canonical number.');return String(value);}
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&Object.getPrototypeOf(value)===Object.prototype){const keys=Object.keys(value);for(const key of keys)assertUnicodeScalars(key,'canonical object key');keys.sort(compareUnicodeScalarSequence);return `{${keys.map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;}
  throw new TypeError('Invalid canonical value.');
};
const build=out=>execFileSync(process.execPath,['build-static-site.mjs','--out',out,'--source-commit','TEST-COMMIT','--workflow-run','TEST-RUN'],{stdio:'pipe'});
try{
  const bmp='\uE000',astral='\u{10000}';
  if(canonical({[bmp]:1,[astral]:2})!==`{"${bmp}":1,"${astral}":2}`)throw new Error('Deployment-manifest canonicalizer does not order object keys by unsigned Unicode scalar sequence.');
  if(canonical({'2':'two','10':'ten',a:'aye'})!=='{"10":"ten","2":"two","a":"aye"}')throw new Error('Deployment-manifest canonicalizer allows JavaScript integer-like key enumeration to override canonical scalar ordering.');
  let rejectedSurrogate=false;try{canonical({'\uD800':1});}catch{rejectedSurrogate=true;}if(!rejectedSurrogate)throw new Error('Deployment-manifest canonicalizer accepted an unpaired surrogate key.');
  build(first);build(second);
  const manifestBytesA=fs.readFileSync(path.join(first,'closed-loop-deployment-manifest.json'));
  const manifestBytesB=fs.readFileSync(path.join(second,'closed-loop-deployment-manifest.json'));
  if(!manifestBytesA.equals(manifestBytesB))throw new Error('Two clean builds did not produce the same deployment manifest.');
  const manifest=JSON.parse(manifestBytesA);
  if(manifest.schema!=='closed-loop-deployment-manifest/1')throw new Error('Wrong deployment manifest schema.');
  if(manifest.canonicalOrigin!=='https://sjonesjones917.github.io')throw new Error('Deployment manifest canonical origin is wrong.');
  if(manifest.canonicalHost!=='sjonesjones917.github.io')throw new Error('Deployment manifest canonical host is wrong.');
  if(manifest.canonicalBasePath!=='/closed-loop-tracker/')throw new Error('Deployment manifest canonical base path is wrong.');
  if(manifest.deploymentEnvironment!=='github-pages')throw new Error('Deployment environment identity is wrong.');
  if(manifest.noCrossOriginRedirect!==true||manifest.permittedRuntimeOrigin!=='SAME_ORIGIN_ONLY')throw new Error('Deployment origin/redirect policy is not closed.');
  if(manifest.workflowIdentity!=='mobile-closed-loop/30')throw new Error('Deployment manifest workflow identity is wrong.');
  if(manifest.projectSchema!=='closed-loop-project/3'||manifest.responseSchema!=='closed-loop-stage-response/3')throw new Error('Deployment manifest runtime schema identity is wrong.');
  if(manifest.testIrSchema!=='closed-loop-test-spec/1'||manifest.verificationPackageSchema!=='closed-loop-verification-package/1')throw new Error('Deployment manifest verification contract identity is wrong.');
  if(manifest.contractProfileId!=='closed-loop-completion-profile/1')throw new Error('Deployment manifest contract profile is missing or wrong.');
  if(manifest.testWorkerProtocolVersion!=='closed-loop-test-worker-protocol/1')throw new Error('Deployment manifest worker protocol identity is missing or wrong.');
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
  const workerResource=manifest.runtimeResources.find(resource=>resource.path==='test-worker.js');
  if(!workerResource||manifest.testWorkerSha256!==workerResource.digest)throw new Error('Deployment manifest does not bind testWorkerSha256 to the exact deployed worker bytes.');
  const workerSource=fs.readFileSync(path.join(first,'test-worker.js'),'utf8');
  if(!workerSource.includes("const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1'"))throw new Error('Worker source is not bound to the declared worker protocol.');
  if(!workerSource.includes('workerProtocolVersion:WORKER_PROTOCOL_VERSION'))throw new Error('Worker success/failure results do not expose the worker protocol identity.');
  if(!workerSource.includes('testWorkerSha256'))throw new Error('Worker results do not carry the worker-byte identity field.');
  const workerHashIndex=workerSource.indexOf('`hash.js${query}`');
  const workerRuntimeIndex=workerSource.indexOf('`test-runtime.js${query}`');
  if(workerHashIndex<0||workerRuntimeIndex<0||workerHashIndex>workerRuntimeIndex)throw new Error('Test IR worker must load hash.js before test-runtime.js so the shared canonical hash authority exists in the worker global.');
  const html=fs.readFileSync(path.join(first,'index.html'),'utf8');
  const tokens=[...html.matchAll(/<script\s+defer\s+src="[^"]+\?v=([^"]+)"/g)].map(match=>match[1]);
  if(tokens.length!==9||tokens.some(token=>token!==manifest.buildIdentity))throw new Error('HTML runtime graph has mixed build identities.');
  if(!html.includes(`<meta name="closed-loop-build-identity" content="${manifest.buildIdentity}">`))throw new Error('Executed build identity meta is missing.');
  const active=manifest.runtimeResources.filter(item=>/\.(?:html|js)$/.test(item.path)).map(item=>fs.readFileSync(path.join(first,item.path),'utf8')).join('\n');
  if(/serviceWorker\s*\.\s*register|navigator\s*\.\s*serviceWorker/.test(active))throw new Error('An unmanifested controlling service worker is present.');
  if(!fs.readFileSync(path.join(first,'test-runtime.js'),'utf8').includes("url.search=new URL(source).search"))throw new Error('Worker does not inherit the runtime build identity.');
  console.log(JSON.stringify({deploymentManifest:'PASS',schema:manifest.schema,canonicalOrigin:manifest.canonicalOrigin,canonicalBasePath:manifest.canonicalBasePath,contractProfileId:manifest.contractProfileId,testWorkerProtocolVersion:manifest.testWorkerProtocolVersion,testWorkerSha256:manifest.testWorkerSha256,resources:manifest.runtimeResources.length,buildIdentity:manifest.buildIdentity,manifestDigest:manifest.manifestDigest.digest,reproducible:true,canonicalUnicodeScalarOrdering:true,integerLikeKeyOrdering:true,unpairedSurrogateRejected:true,workerCanonicalHashDependency:true,noControllingServiceWorker:true},null,2));
}finally{
  fs.rmSync(first,{recursive:true,force:true});fs.rmSync(second,{recursive:true,force:true});
}