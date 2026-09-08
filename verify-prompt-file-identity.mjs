import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const runtime=vm.createContext({TextEncoder,TextDecoder,Event:class Event{},dispatchEvent(){}});
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInContext(fs.readFileSync(file,'utf8'),runtime,{filename:file});
const {closedLoopCore:core,closedLoopWorkflowSchema:schema,closedLoopWorkflowEngine:engine,closedLoopPromptEngine:prompts}=runtime;
const p=core.createBlankState('JOB-PROMPT-FILE-IDENTITY');
Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Verify exact instruction bytes — café.',SUPPLIED_MATERIALS_INVENTORY:'NONE',CURRENT_INPUT_VERSION:'INPUT-FILE'});
engine.ensureShape(p);
const intake=prompts.intakeCoverageManifest(p);
p.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',extractedStatements:[{statementKey:'S'+i,text:u.rawValueText||u.label,statementClass:'CONTEXT'}]}))});
p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';
let operations=0,mutations=0;
for(let stage=1;stage<=30;stage++){
 if(stage>1){p.stages[stage-1].status='COMPLETE';p.stages[stage-1].gate={complete:true};}
 for(const operation of schema.STAGE_CONTRACTS[stage].operations){
  const scope=Object.fromEntries(schema.operationContract(stage,operation).scopeRequirements.map(k=>[k,k==='projectRevision'?0:k.toUpperCase()+'-IDENTITY']));
  const r=prompts.buildPromptRecord(stage,p,{operation,scope});
  const bytes=Buffer.from(r.prompt,'utf8'),digest=createHash('sha256').update(bytes).digest('hex');
  assert.equal(r.bodySha256,digest,'Recorded body digest must cover the complete exported instruction.');
  assert.equal(r.fullTextSha256,digest);
  assert.equal(r.sha256,digest);
  assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(bytes),r.prompt);
  assert.ok(r.prompt.endsWith('\n'));
  assert.ok(!r.prompt.includes('\r')&&!r.prompt.startsWith('\uFEFF'));
  assert.ok(!r.prompt.includes(digest),'The prompt must not include its own hash.');
  const m=prompts.promptFileManifest(r);
  assert.equal(m.promptIdentity.bodySha256,digest);
  assert.equal(m.instruction.path,'instruction.txt');
  assert.equal(m.instruction.byteSize,bytes.length);
  assert.equal(m.instruction.sha256,digest);
  assert.match(r.prompt,/Echo its exact promptIdentity object/);
  for(const prompt of ['\uFEFF'+r.prompt,r.prompt.replace(/\n/g,'\r\n'),r.prompt.slice(0,-1),'wrapper\n'+r.prompt,r.prompt+'x']){
   assert.throws(()=>prompts.promptFileManifest({...r,prompt}),/authoritative byte identity/);mutations++;
  }
  assert.throws(()=>prompts.promptFileManifest({...r,bodySha256:'0'.repeat(64)}),/authoritative byte identity/);mutations++;
  assert.equal(prompts.promptFileManifest(r).promptIdentity.bodySha256,digest,'The repaired original remains valid.');
  operations++;
 }
}
assert.equal(operations,66);
console.log(JSON.stringify({promptFileIdentity:'PASS',generatedOperations:operations,exactExportedBytesHashed:true,manifestIdentityBound:true,noSelfReferentialHash:true,utf8LfFinalNewline:true,mutationsDetected:mutations,repairedOriginalAccepted:true}));
