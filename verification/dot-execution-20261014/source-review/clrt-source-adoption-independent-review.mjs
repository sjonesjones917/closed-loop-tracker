import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {validateSpecificationSource} from '/workspace/shared/clrt-source-review/review-specification-coverage.mjs';
const root='/workspace/shared/clrt-source-review', base='7df5f46e9a7e54da09622387a978badb39916c09', head='ebf6a930d1e5ef2f9afaaf68631a318facee5181';
const spec='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
const results=[];
const check=(name,fn)=>{fn();results.push({name,status:'PASS'});};
const target=fs.readFileSync('/workspace/shared/clrt-controlling-part-b.txt'), bytes=git('show',`${head}:${spec}`), historical=git('show',`${base}:${spec}`);
const run=(cwd,script,args=[])=>{const r=cp.spawnSync(process.execPath,[script,...args],{cwd,encoding:'utf8',timeout:120000,maxBuffer:64*1024*1024,env:{...process.env,GITHUB_ACTIONS:'false'}});return {status:r.status,signal:r.signal,error:r.error?.message,stdout:r.stdout,stderr:r.stderr};};
const artifacts={};
check('supplied/frozen/disk byte equality and pinned identity',()=>{assert.equal(bytes.length,309482);assert.equal(hash(bytes),'8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883');assert.deepEqual(bytes,target);assert.deepEqual(bytes,fs.readFileSync(path.join(root,spec)));assert.equal(git('rev-parse','HEAD').toString().trim(),head);});
check('historical source retained at reachable base and historical source commit',()=>{assert.equal(historical.length,342110);assert.equal(hash(historical),'95a6a8b1f8857b35c47cb44874aee2bbada1ccfd2ee7aa9033d92fb39c8bda9d');git('merge-base','--is-ancestor',base,head);git('merge-base','--is-ancestor','8283121898e18d7868eef81c5ca8bebf0c9585c0',head);assert.deepEqual(historical,git('show',`8283121898e18d7868eef81c5ca8bebf0c9585c0:${spec}`));});
const changed=git('diff','--name-only',base,head).toString().trim().split('\n');
check('all changes within bounded source governance scope; runtime and historical declarations unchanged',()=>{const allowed=new Set([spec,'generate-specification-governance.mjs','review-specification-coverage.mjs','specification-governance-core.mjs','test-specification-source-adoption.mjs','verify-specification-governance.mjs']);assert.ok(changed.every(p=>allowed.has(p)||p.startsWith('verification/specification-source-adoption-20261014/')));for(const p of ['specification/closed-loop-specification-manifest.json','specification/closed-loop-normative-requirements.json','specification/requirement-evidence-bindings.json','specification/source-clause-review.json'])assert.deepEqual(git('show',`${base}:${p}`),git('show',`${head}:${p}`));});
const tuple=b=>({sha256:hash(b),byteLength:b.length,sourceCommit:head});
check('exact source accepts actual frozen source commit tuple',()=>assert.equal(validateSpecificationSource(bytes,tuple(bytes),head),bytes.toString('utf8')));
const text=bytes.toString('utf8');
const badUtf=Buffer.from(bytes);badUtf[120]=0x80;
const boundaryCases=[['BOM',Buffer.concat([Buffer.from([239,187,191]),bytes]),/BOM/],['invalid UTF8',badUtf,/encoded data/],['CR interior',Buffer.from(text.replace('Repository:','\rRepository:')),/CR or CRLF/],['remove both final LF',bytes.subarray(0,-2),/two final LF/],['one final LF',bytes.subarray(0,-1),/two final LF/],['three final LF',Buffer.concat([bytes,Buffer.from('\n')]),/two final LF/],['prepend blank',Buffer.concat([Buffer.from('\n'),bytes]),/leading blank/],['remove supplied header',Buffer.from(text.slice(9)),/start boundary/],['combined prompt boundary',Buffer.concat([Buffer.from('PART A\n'),bytes]),/start boundary/],['changed final phrase',Buffer.from(text.replace('pinned actual physical-iPhone Safari operator path.\n\n','pinned other operator path.\n\n')),/end boundary/]];
for(const [name,b,pattern] of boundaryCases)check(`independent boundary rejects ${name} even with rehashed tuple`,()=>assert.throws(()=>validateSpecificationSource(b,tuple(b),head),pattern));
check('same-length interior mutation fails original tuple',()=>{const b=Buffer.from(text.replace('Exactly 30','Exactly 31'));assert.equal(b.length,bytes.length);assert.throws(()=>validateSpecificationSource(b,tuple(bytes),head),/exact source bytes/);});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-independent-adoption-'));
cp.execFileSync('bash',['-o','pipefail','-c',`git archive ${base} | tar -x -C ${temp}`],{cwd:root,maxBuffer:64*1024*1024});
try {
 check('base verifier reproduced wrong one-LF rejection against exact supplied bytes',()=>{fs.writeFileSync(path.join(temp,spec),bytes);const r=run(temp,'verify-specification-governance.mjs');artifacts.baseVerifier=r;assert.equal(r.status,1);assert.match(r.stderr,/must end with exactly one LF/);});
 check('current source regression passes actual Node process',()=>{const r=run(root,'test-specification-source-adoption.mjs');artifacts.sourceRegression=r;assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).mutationCount,16);});
 const preserved=['specification/closed-loop-specification-manifest.json','specification/closed-loop-normative-requirements.json'];const before=preserved.map(p=>fs.readFileSync(path.join(root,p)));
 for(const script of ['verify-specification-governance.mjs','generate-specification-governance.mjs'])check(`frozen ${script} rejects historical source evidence and does not rewrite manifests`,()=>{const r=run(root,script);artifacts[script]=r;assert.equal(r.status,1);assert.match(r.stderr,script.startsWith('verify')?/manifest does not bind the exact source bytes/:/evidence bindings do not match the controlling specification/);preserved.forEach((p,i)=>assert.deepEqual(fs.readFileSync(path.join(root,p)),before[i]));});
 check('imported verifier remains active and fails closed',()=>{const r=run(root,'--input-type=module',['-e',"await import('./verify-specification-governance.mjs')"]);artifacts.importedVerifier=r;assert.equal(r.status,1);assert.match(r.stderr,/manifest does not bind the exact source bytes/);});
 // Independently test old source behavior with changed source-governance modules.
 fs.writeFileSync(path.join(temp,spec),historical);
 for(const p of ['generate-specification-governance.mjs','review-specification-coverage.mjs','specification-governance-core.mjs'])fs.copyFileSync(path.join(root,p),path.join(temp,p));
 check('historical governance core still executes all clarification/amendment/semantic negative gates',()=>{const r=run(temp,'specification-governance-core.mjs');artifacts.historicalCore=r;assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);assert.equal(report.sourceSha256,hash(historical));assert.equal(report.mutationCount,17);assert.equal(report.dispositionCounts.CONFORMANT_PROVEN,0);assert.ok(report.mutations.includes('approved-clarification-omission'));assert.ok(report.mutations.includes('approved-amendment-obligation-omission'));});
 // Forge only a local manifest tuple, retaining historical semantic evidence. This
 // is a hostile unit fixture, never acceptance or provenance evidence.
 fs.writeFileSync(path.join(temp,spec),bytes);
 for(const p of ['verify-specification-governance.mjs','test-specification-source-adoption.mjs'])fs.copyFileSync(path.join(root,p),path.join(temp,p));
 const mp=path.join(temp,preserved[0]), manifest=JSON.parse(fs.readFileSync(mp));Object.assign(manifest,tuple(bytes));fs.writeFileSync(mp,JSON.stringify(manifest));
 check('relabeling only manifest source tuple cannot renew historical semantic evidence',()=>{const r=run(temp,'verify-specification-governance.mjs');artifacts.relabeledManifest=r;assert.equal(r.status,1);assert.match(r.stderr,/evidence bindings do not match the controlling specification/);});
 const changedBytes=Buffer.from(text.replace('Exactly 30','Exactly 31'));fs.writeFileSync(path.join(temp,spec),changedBytes);Object.assign(manifest,tuple(changedBytes));fs.writeFileSync(mp,JSON.stringify(manifest));
 check('rehashed same-length altered source cannot pass current verifier regression',()=>{const r=run(temp,'verify-specification-governance.mjs');artifacts.rehashedChangedSource=r;assert.equal(r.status,1);assert.match(r.stderr,/regression fixture cannot silently follow a changed source/);});
 // Historical mechanical review behavior should be invariant except module identity.
 fs.writeFileSync(path.join(temp,spec),historical);
 const current=run(temp,'review-specification-coverage.mjs');fs.writeFileSync(path.join(temp,'review-specification-coverage.mjs'),git('show',`${base}:review-specification-coverage.mjs`));const previous=run(temp,'review-specification-coverage.mjs');
 check('reviewer extraction unchanged on historical source except source-code identity',()=>{assert.equal(current.status,0);assert.equal(previous.status,0);const a=JSON.parse(current.stdout),b=JSON.parse(previous.stdout);delete a.reviewerIdentitySha256;delete b.reviewerIdentitySha256;assert.deepEqual(a,b);});
} finally {fs.rmSync(temp,{recursive:true,force:true});}
const report={review:'FROZEN_SOURCE_ADOPTION_DELTA_ONLY',result:'ACCEPT',base,head,node:process.version,source:{byteLength:bytes.length,sha256:hash(bytes)},historical:{byteLength:historical.length,sha256:hash(historical)},checkCount:results.length,results,changed,artifacts,fullGovernanceAccepted:false,runtimeConformanceClaim:false,sourceReachabilityOnRemoteMainClaim:false};
fs.writeFileSync('/workspace/shared/clrt-source-adoption-independent-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,artifacts:Object.keys(artifacts)},null,2));
