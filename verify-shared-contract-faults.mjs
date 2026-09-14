import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Specification oracles: Sections 8/14 (producer authority), 36.1
// (conservative invalidation), and 42 (actual byte equality). All projects,
// sentinels and faulted module instances are disposable in-memory fixtures.
const sources=Object.fromEntries(['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'].map(file=>[file,fs.readFileSync(file,'utf8')]));
function runtime(fault){
  const c=vm.createContext({console,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,Blob,structuredClone,crypto:globalThis.crypto,Event:class Event{},dispatchEvent(){}});
  for(const [file,original] of Object.entries(sources)){
    let source=original;
    if(fault?.file===file){assert.ok(source.includes(fault.before),`Fault anchor disappeared: ${fault.id}`);source=source.replaceAll(fault.before,fault.after);}
    vm.runInContext(source,c,{filename:file});
  }
  return c;
}
function into(c,value){c.fixtureJson=JSON.stringify(value);return vm.runInContext("JSON.parse(fixtureJson)",c);}
const cases=[];
function record(id,details={}){cases.push({caseId:id,...details,result:'PASS'});}
function ownership(c){
  const engine=c.closedLoopWorkflowEngine,prompts=c.closedLoopPromptEngine,ingestion=c.closedLoopResponseIngestion,schema=c.closedLoopWorkflowSchema;
  const p=c.closedLoopCore.createBlankState('DISPOSABLE-AUTHORITY');p.job.EXACT_USER_OBJECTIVE_VERBATIM='Return a text file containing VERIFIED and one LF.';engine.ensureShape(p);engine.recalculate(p);
  const pr=prompts.buildPromptRecord(1,p);
  const base={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:1,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'capability-unavailable',kind:'MISSING_CAPABILITY',description:'Required external observation is unavailable in this disposable fixture.',whyBlocking:'The required observation has not occurred.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
  const validate=e=>ingestion.validateEnvelope(p,into(c,e),{stage:1,promptRecord:pr,rawSha256:c.closedLoopHash.sha256Text(JSON.stringify(e)),files:[]});
  const good=validate(base);assert.equal(good.valid,true,JSON.stringify(good.issues));
  const before=JSON.stringify(p);
  for(const [field,value] of [['JOB_TITLE','Agent changed human input'],['JOB_RECORD_STATUS','COMPLETE']]){
    const bad=structuredClone(base);bad.stageData[field]=value;
    const result=validate(bad);
    assert.ok(result.issues.some(i=>i.code==='FIELD_OWNERSHIP_VIOLATION'),`OWNERSHIP_ORACLE: ${field} was not rejected for its producer violation.`);
    assert.equal(JSON.stringify(p),before,'Ownership rejection changed canonical input.');
    assert.equal(validate(base).valid,true,'Removing only the ownership violation did not restore validation.');
    record(`OWNERSHIP-${field}`,{stage:1,expectedRejection:'FIELD_OWNERSHIP_VIOLATION',repairedResult:'VALID'});
  }
}
function invalidation(c){
  const e=c.closedLoopWorkflowEngine;
  for(let upstream=1;upstream<=30;upstream++){
    const p=c.closedLoopCore.createBlankState(`DISPOSABLE-INVALIDATION-${upstream}`);e.ensureShape(p);
    // Sentinel state tests invalidation, never stage acceptance or a journey.
    for(let stage=1;stage<=30;stage++){
      p.stages[stage].status='COMPLETE';
      p.projectData.generatedPrompts.push(into(c,{instructionId:`PROMPT-${stage}`,stage,validity:'CURRENT',invalidatedBy:null}));
      p.projectData.acceptedChanges.push(into(c,{changeId:`ACCEPTED-${stage}`,stage,invalidatedBy:null}));
    }
    const derivedOwners={convergenceRecords:18,releaseRecords:27,artifactIdentities:28,evidenceChains:29,deliveryRecords:30};
    for(const [family,stage] of Object.entries(derivedOwners))p.projectData[family].push(into(c,{id:`${family}-SENTINEL`,stage,fields:{},active:true,validity:'CURRENT',invalidatedBy:null}));
    e.invalidateDownstream(p,upstream,'UPSTREAM-CORRECTION','Disposable correction fixture');
    for(const [family,stage] of Object.entries(derivedOwners)){const record=p.projectData[family].find(x=>x.id===`${family}-SENTINEL`);assert.equal(Boolean(record.invalidatedBy),stage>upstream,`INVALIDATION_ORACLE: ${family} owned at ${stage} changed incorrectly after ${upstream}.`);if(stage<=upstream){assert.equal(record.active,true,`INVALIDATION_ORACLE: ${family} lost activity at its own or a later stage.`);assert.equal(record.validity,'CURRENT',`INVALIDATION_ORACLE: ${family} lost validity at its own or a later stage.`);}}
    for(let stage=1;stage<=30;stage++){
      const invalid=stage>upstream;
      assert.equal(Boolean(p.stages[stage].invalidatedBy),invalid,`INVALIDATION_ORACLE: correction at ${upstream} left stage ${stage} wrong.`);
      assert.equal(Boolean(p.projectData.generatedPrompts.find(x=>x.stage===stage).invalidatedBy),invalid,`INVALIDATION_ORACLE: prompt at ${stage} retained incorrect authority.`);
      assert.equal(Boolean(p.projectData.acceptedChanges.find(x=>x.stage===stage).invalidatedBy),invalid,`INVALIDATION_ORACLE: accepted change at ${stage} retained incorrect authority.`);
    }
    record(`INVALIDATION-FROM-${String(upstream).padStart(2,'0')}`,{upstream,checkedStages:30,fixture:'synthetic authority sentinels'});
  }
}
async function byteEquality(c){
  const r=c.closedLoopTestRuntime;
  const spec={version:r.SPEC_VERSION,languageVersion:r.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:r.OPERATION_REGISTRY_VERSION,operationRegistrySha256:r.OPERATION_REGISTRY_SHA256,steps:[{stepId:'S001',op:'BYTE_COMPARE',inputs:{left:{bindingRef:'LEFT'},right:{bindingRef:'RIGHT'}}},{stepId:'S002',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S001',output:'comparison'},expected:{literal:true}}}],result:{stepRef:'S002',output:'assertion'}};
  const left=Uint8Array.of(0,65,13,10,255);
  for(let position=-1;position<left.length;position++){
    const right=left.slice();if(position>=0)right[position]^=1;
    const run=await r.execute({spec:into(c,spec),artifacts:{LEFT:{artifactId:'LEFT',bytes:left},RIGHT:{artifactId:'RIGHT',bytes:right}}});
    assert.equal(run.determination,position<0?'SATISFIED':'VIOLATED',`BYTE_EQUALITY_ORACLE: byte ${position} produced ${run.determination}.`);
    record(position<0?'BYTES-EQUAL':`BYTES-MODIFIED-${position}`,{expected:position<0?'SATISFIED':'VIOLATED',actual:run.determination});
  }
}
const faults=[
  {id:'BYPASS-PRODUCER-VALIDATION',file:'response-ingestion.js',before:"if(!schema.authorizeMutation({fieldDefinition:definition,actor:'AGENT',mutationType:'RESPONSE_INGESTION'}).authorized)",after:'if(false)',check:ownership,error:/OWNERSHIP_ORACLE/},
  {id:'SKIP-DOWNSTREAM-INVALIDATION',file:'workflow-engine.js',before:"function invalidateDownstream(project,stage,changeId,reason='Material upstream change'){",after:"function invalidateDownstream(project,stage,changeId,reason='Material upstream change'){return [];",check:invalidation,error:/INVALIDATION_ORACLE/},
  {id:'SELF-INVALIDATE-TERMINAL',file:'workflow-engine.js',before:"for(const d of Number(n)<30?scoped(p,'deliveryRecords'):[])",after:"for(const d of scoped(p,'deliveryRecords'))",check:invalidation,error:/INVALIDATION_ORACLE/},
  {id:'COMPARE-LENGTH-ONLY',file:'test-runtime.js',before:'if(left[i]!==right[i]){comparison=false;break;}',after:'if(false){comparison=false;break;}',check:byteEquality,error:/BYTE_EQUALITY_ORACLE/}
];
const faultResults=[];
for(const fault of faults){
  await fault.check(runtime());
  const count=cases.length;
  await assert.rejects(async()=>fault.check(runtime(fault)),fault.error,`${fault.id}: the targeted implementation fault survived.`);
  cases.length=count;
  await fault.check(runtime());
  faultResults.push({faultId:fault.id,productionFile:fault.file,detectedBy: fault.error.source,result:'DETECTED',restoredImplementation:'PASS'});
}
// Repaired reruns may execute the same case; publish each ID once with run count.
const executed=[...new Set(cases.map(x=>x.caseId))].map(id=>({...cases.find(x=>x.caseId===id),executions:cases.filter(x=>x.caseId===id).length}));
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,environment:'Node VM; production modules; no disk or user-project mutations',cases:executed,implementationFaults:faultResults},null,2));
