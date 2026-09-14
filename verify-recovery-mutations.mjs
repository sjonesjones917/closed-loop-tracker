import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'recovery-mutations-')),digest=text=>createHash('sha256').update(text).digest('hex'),originals=new Map();
for(const name of fs.readdirSync(root).filter(name=>/\.(?:m?js|json)$/.test(name))){const content=fs.readFileSync(name);originals.set(name,content);fs.writeFileSync(path.join(scratch,name),content);}
fs.symlinkSync(path.join(root,'node_modules'),path.join(scratch,'node_modules'),'dir');
const variants=[
 {id:'context-validation-bypassed',file:'workflow-engine.js',needle:'function stageContextProject(project,stage){',replacement:'function stageContextProject(project,stage){return project;',test:'verify-stage-context-boundary.mjs',reason:/Subsequent-stage information escaped/},
 {id:'ownership-validation-bypassed',file:'response-ingestion.js',needle:"if(!schema.authorizeMutation({fieldDefinition:definition,actor:'AGENT',mutationType:'RESPONSE_INGESTION'}).authorized)",replacement:'if(false)',test:'verify-recoverable-history.mjs',reason:/Ownership bypass was not detected/},
 {id:'confirmation-skipped',file:'response-ingestion.js',needle:'if(impact.requiresConfirmation&&confirmationHash!==impact.confirmationHash)',replacement:'if(false)',test:'verify-recoverable-history.mjs',reason:/Missing expected exception/},
 {id:'incomplete-invalidation',file:'workflow-engine.js',needle:'for(const number of dependentStages(stage)){const state=project.stages[number];',replacement:'for(const number of dependentStages(stage).slice(0,-1)){const state=project.stages[number];',test:'verify-dependency-invalidation.mjs',reason:/Incomplete dependent invalidation/},
 {id:'incorrect-byte-comparison',file:'project-store.js',needle:'row.blob.size!==expected.byteSize||await hash.sha256Bytes(row.blob)!==expected.sha256)',replacement:'row.blob.size!==expected.byteSize)',within:'async function restoreVersion(',test:'verify-recoverable-history.mjs',reason:/Missing expected rejection/},
 {id:'retained-checkpoint-mutated',file:'project-store.js',needle:'const next=clone(checkpoint.project);next.revision=',replacement:"saved.value.label='MUTATED RETAINED HISTORY';meta.put(saved);const next=clone(checkpoint.project);next.revision=",test:'verify-recoverable-history.mjs',reason:/RECOVERY_CHECKPOINT_CORRUPT|saved version failed its integrity check/},
 {id:'incompatible-versions-combined',file:'project-store.js',needle:'const next=clone(checkpoint.project);next.revision=',replacement:'const next=clone(checkpoint.project);next.stages=clone(prior.project.stages);next.revision=',test:'verify-recoverable-history.mjs',reason:/AssertionError/},
 {id:'proposal-plan-validation-bypassed',file:'response-ingestion.js',needle:'function assertProposalPlan(project,proposal,promptRecord,rawRecord){',replacement:'function assertProposalPlan(project,proposal,promptRecord,rawRecord){return;',test:'verify-recoverable-history.mjs',reason:/Missing expected exception/}
];
function run(test){const r=spawnSync(process.execPath,[test],{cwd:scratch,encoding:'utf8',timeout:240000,maxBuffer:4*1024*1024,env:{...process.env,BASELINE_COMMIT:''}});return {status:r.status,signal:r.signal,output:r.stdout+'\n'+r.stderr,error:r.error?.message};}
const results=[];
try{
 for(const test of new Set(variants.map(v=>v.test))){const result=run(test);assert.equal(result.status,0,'Unmodified '+test+' failed:\n'+result.output);console.log(JSON.stringify({baseline:test,result:'PASS'}));}
 for(const variant of variants){const source=originals.get(variant.file).toString(),start=variant.within?source.indexOf(variant.within):0,index=source.indexOf(variant.needle,start);assert(index>=0,'Mutation target is absent: '+variant.id);assert.equal(source.indexOf(variant.needle,index+variant.needle.length),-1,'Mutation target is ambiguous: '+variant.id);const modified=source.slice(0,index)+variant.replacement+source.slice(index+variant.needle.length);fs.writeFileSync(path.join(scratch,variant.file),modified);
  const result=run(variant.test),detected=result.status!==0&&!result.signal&&!result.error&&variant.reason.test(result.output);fs.writeFileSync(path.join(scratch,variant.id+'.log'),result.output);results.push({mutation:variant.id,test:variant.test,detected,status:result.status,signal:result.signal,expectedFailure:variant.reason.source});console.log(JSON.stringify(results.at(-1)));fs.writeFileSync(path.join(scratch,variant.file),source);assert(detected,'The intended behavioral failure was not detected for '+variant.id+':\n'+result.output);
 }
 for(const [name,content] of originals)assert.equal(digest(fs.readFileSync(path.join(root,name))),digest(content),'Mutation verification changed the working source: '+name);
 console.log(JSON.stringify({mutationVerification:'PASS',mutations:results.length,workspaceImplementationRestored:true,logs:scratch,results}));
}finally{for(const [name,content] of originals)if(fs.existsSync(path.join(scratch,name)))fs.writeFileSync(path.join(scratch,name),content);}
