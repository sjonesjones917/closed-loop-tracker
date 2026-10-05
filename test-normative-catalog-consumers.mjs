import assert from 'node:assert/strict';
import {verificationCatalog,browserVerificationCatalog} from './verification-evidence-catalog.mjs';
import {verifyStage01SpecificationControls} from './test-stage01-specification-controls.mjs';
// These mutations test publication of owning assertions. They never stand for
// additional ingestion executions or complete source-clause conformance.
export async function verifyNormativeCatalogConsumers(){
 const cases=[],checks=verificationCatalog['verify-ingestion.mjs'].checks.filter(row=>row.id.startsWith('ingestion.invalid.'));
 assert.equal(checks.length,14);
 for(const check of checks){
  const name=check.assertionReference.slice('verify-ingestion.mjs: negativeAt '.length);
  // The owning literal diagnostic is observed through a conforming selector
  // control, independently specified here for these14 frozen cases.
  const expectedCodes={"malformed JSON":"MALFORMED_JSON","truncated JSON":"TRUNCATED_RESPONSE","markdown wrapped":"NON_JSON_WRAPPER","oversized response":"OVERSIZED_RESPONSE","duplicate JSON member":"DUPLICATE_JSON_MEMBER","wrong root type":"INVALID_ROOT","unknown top-level property":"UNKNOWN_PROPERTY","wrong stage":"WRONG_STAGE","wrong operation":"WRONG_OPERATION","stale prompt id":"STALE_PROMPT_IDENTITY","stale contract hash":"STALE_CONTRACT_HASH","stale context signature":"STALE_CONTEXT_SIGNATURE","unresolved relationship":"UNRESOLVED_RELATIONSHIP","wrong relationship cardinality":"INVALID_RELATIONSHIP_REFERENCE"};
  // IDs/codes for actual known report rows are supplied below if the retained
  // owner uses a more specific name; no pass is inferred from this table alone.
  assert(expectedCodes[name],'INDEPENDENT_CATALOG_CASE_NAME_ORACLE');
  const row={name,checkId:check.id,expectedCode:expectedCodes[name],observedCodes:[expectedCodes[name]],accepted:false,acceptedChanges:0};
  assert.equal(check.condition([row]),true,'INDEPENDENT_CATALOG_CONTROL_ORACLE: '+name);
  for(const [fault,rows]of [['missing',[]],['duplicate',[row,row]],['accepted',[{...row,accepted:true}]],['wrong-code',[{...row,observedCodes:['OTHER']}]]]){assert.equal(check.condition(rows),false);cases.push(check.id+':'+fault);}
 }
 const setCheck=verificationCatalog['verify-hash.mjs'].checks.find(row=>row.id==='canonical.registered-set-semantics');
 assert.equal(setCheck.expected,true);assert.equal(setCheck.marker,'sha256Vectors');assert.equal(setCheck.path,'registeredSetSemantics');
 const report=await verifyStage01SpecificationControls(),check=verificationCatalog['verify-stage01-agent-contract-alignment.mjs'].checks.find(row=>row.id==='stage01.specification-controls');
 assert.equal(check.condition(report.verificationObservations,report),true);
 for(const [name,change]of [['missing-case',r=>r.observations.pop()],['duplicate-case',r=>r.observations[0]=r.observations[1]],['accepted-negative',r=>r.observations[0].accepted=true],['wrong-diagnostic',r=>r.observations[0].actualCodes=['OTHER']],['false-completion',r=>r.observations[0].stageComplete=true],['missing-file-custody',r=>r.packages[0].actualSavedZip=false],['missing-intended-fault',r=>r.faults.pop()]]){const changed=structuredClone(report);change(changed);assert.equal(check.condition(changed.verificationObservations,changed),false,name);cases.push('stage01:'+name);}
 const fallbackChecks=browserVerificationCatalog['verify-mobile-capability-journey.mjs'].checks.filter(row=>row.id.startsWith('verify-mobile-capability-journey.fallback:'));
 const answerTypes=['TEXT','LONG_TEXT','BOOLEAN','NUMBER','CHOICE','MULTI_CHOICE','DATE','FILE_REFERENCE'];
 assert.deepEqual(fallbackChecks.map(row=>row.id),answerTypes.map(type=>'verify-mobile-capability-journey.fallback:'+type));
 for(const answerType of answerTypes){
  const check=fallbackChecks.find(row=>row.id.endsWith(':'+answerType)),row={name:`human fallback ${answerType} control saves and reloads typed answer`,result:'PASS',observation:{answerType,accessibleQuestion:true,nativeControl:true,typedAnswerPreserved:true,actualResponseFile:true,stageCompleted:false,syntheticHumanInformation:true}};
  assert.equal(check.condition([row]),true);
  const faults=[['missing',[]],['duplicate',[row,row]],['failed',[{...row,result:'FAIL'}]],['wrong-answer-type',[{...row,observation:{...row.observation,answerType:'OTHER'}}]]];
  for(const field of ['accessibleQuestion','nativeControl','typedAnswerPreserved','actualResponseFile','syntheticHumanInformation'])faults.push([field,[{...row,observation:{...row.observation,[field]:false}}]]);
  faults.push(['false-completion',[{...row,observation:{...row.observation,stageCompleted:true}}]]);
  for(const [fault,rows]of faults){assert.equal(check.condition(rows),false,answerType+':'+fault);cases.push('fallback:'+answerType+':'+fault);}
 }
 return {passed:true,cases,stage01OwningFocusedExecution:true,ingestionCasesAreConsumerOnly:true,browserFallbackCasesAreConsumerOnly:true,fullClauseConformanceEstablished:false};
}
