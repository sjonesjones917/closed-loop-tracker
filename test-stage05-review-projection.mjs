import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {healthyFullCyclePrerequisiteSource} from './full-cycle-prerequisite.mjs';

const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'];
const plain=value=>JSON.parse(JSON.stringify(value));
const summary={TRUTH_VALUE:'truthValue',STATUS:'status',CONTRADICTION_STATUS:'contradictionStatus',CURRENT_SCOPE_STATUS:'currentScopeStatus',EPISTEMIC_BASIS:'epistemicBasis',FRESHNESS_STATUS:'freshnessStatus',REASONS:'reasons',SUPPORTING_EVIDENCE_IDS:'supportingEvidenceIds',DERIVATION_OR_REVIEW_IDS:'derivationOrReviewIds'};
const assign=(row,name,value)=>{row[name]=plain(value);row.fields[name]=plain(value);};

// The input here is captured in memory after real accepted Stage 01–06 work.
// Synthetic annotations below exercise context selection only, not admission,
// native execution, accepted observation provenance, or complete stage claims.
export function verifyStage05ReviewProjection(project,runtime=globalThis){
 const engine=runtime.closedLoopWorkflowEngine,schema=runtime.closedLoopWorkflowSchema,prompts=runtime.closedLoopPromptEngine,cases=[];
 const snapshot=JSON.stringify(project),propositionId=project.projectData.propositions[0].id,requirementsVersion=project.job.CURRENT_REQUIREMENTS_VERSION;
 const proposition=p=>p.projectData.propositions.find(row=>row.id===propositionId);
 const laterReview=project.projectData.semanticReviews.find(row=>Number(row.stage)===6);
 assert(laterReview,'The prerequisite must contain the actually accepted Stage06 proof review.');
 const actual=engine.stageContext(project,5);
 assert.equal(actual.job.CURRENT_REQUIREMENTS_VERSION,requirementsVersion,'STAGE05_ACCEPTED_VERSION_PROJECTION_ORACLE');
 assert(proposition(actual),'STAGE05_ACCEPTED_PROPOSITION_PROJECTION_ORACLE');
 assert.deepEqual(plain(engine.recordsForCurrentScope(actual,'requirements').map(row=>row.id)),plain(engine.recordsForCurrentScope(project,'requirements').map(row=>row.id)));
 const candidate=engine.clone(project),prepared=engine.preparePromptContext(candidate,5,{operation:'SEMANTIC_REVIEW'}),prompt=prompts.buildPromptRecord(5,candidate,prepared.options);
 assert.equal(prompt.scope.requirementsVersion,requirementsVersion);
 for(const key of ['inputVersion','sourceSetVersion','researchVersion','requirementsVersion'])assert(prompt.scope[key],key+' must remain bound.');
 for(const key of ['testSuiteVersion','instructionVersion','iterationId','productId'])assert(!Object.hasOwn(prompt.scope,key),key+' must not bind the upstream review.');
 assert.equal(prompt.contextManifest.semanticReviewBinding.bindingStatus,'BOUND');
 assert(prompt.contextManifest.semanticReviewBinding.reviewedRecordIds.length);
 assert.notEqual(prompt.contextManifest.semanticReviewBinding.authorContextId,prompt.contextManifest.semanticReviewBinding.reviewerContextId);
 assert(!JSON.stringify(prompt).includes(laterReview.id),'STAGE05_LATER_REVIEW_HANDOFF_EXCLUSION_ORACLE');
 assert.equal(JSON.stringify(project),snapshot,'STAGE05_CANONICAL_BYTES_IMMUTABLE_ORACLE');
 cases.push('actual-accepted-stage01-through06-review-subject-and-upstream-scope');

 const synthetic=(relations)=>{
  const p=engine.clone(project),pr=proposition(p),scope={...pr.scope};
  for(const [stage,relation] of relations){
   const suffix=stage+'-'+relation,evidence='EVIDENCE-CONTEXT-'+suffix,observation='OBSERVATION-CONTEXT-'+suffix,review='ENTAILMENT-CONTEXT-'+suffix;
   p.projectData.evidenceRecords.push({id:evidence,stage,active:true,scope,fields:{EVIDENCE_ID:evidence,STATUS:'PRESERVED',APPLICATION_EVIDENCE_CONTENT:'context-selection-only-'+suffix}});
   p.projectData.observationRecords.push({id:observation,stage,active:true,scope,source:'SYNTHETIC_CONTEXT_SELECTION',evidenceRefs:[evidence],fields:{OBSERVATION_ID:observation,SUBJECT_ID:propositionId,EPISTEMIC_BASIS:'EXTERNALLY_SUPPORTED',FRESHNESS_STATUS:'CURRENT',RAW_OR_NATIVE_PROVENANCE:'SYNTHETIC_CONTEXT_SELECTION'}});
   p.projectData.entailmentReviews.push({id:review,stage,active:true,scope,source:'APPLICATION_TEST_RUNTIME',fields:{ENTAILMENT_ID:review,OBSERVATION_ID:observation,TARGET_PROPOSITION_ID:propositionId,ACCEPTED_STATUS:'ACCEPTED',ACCEPTED_RELATION:relation}});
  }
  const state=engine.evaluatePropositionState(p,pr);for(const [name,key]of Object.entries(summary))assign(pr,name,state[key]);
  return p;
 };
 const check=(p,stage)=>{const before=JSON.stringify(p),context=engine.stageContext(p,stage);assert.equal(JSON.stringify(p),before,'Projection must not mutate shared fields, responses, or provenance.');assert.strictEqual(engine.stageContext(context,stage),context,'Completed projection remains idempotent.');return context;};
 for(const stage of [4,5,6]){
  const p=synthetic([[4,'REFUTES'],[5,'REFUTES'],[6,'REFUTES']]),pr=proposition(p);
  // Deliberately use a nonsorted valid order; filtering cannot sort retained links.
  for(const name of ['SUPPORTING_EVIDENCE_IDS','DERIVATION_OR_REVIEW_IDS'])assign(pr,name,[...pr.fields[name]].reverse());
  const context=check(p,stage),out=proposition(context),future=new Set([5,6].filter(n=>n>stage).flatMap(n=>['EVIDENCE-CONTEXT-'+n+'-REFUTES','ENTAILMENT-CONTEXT-'+n+'-REFUTES']));
  assert(out);assert.equal(out.fields.TRUTH_VALUE,'FALSE');assert.equal(out.fields.STATUS,'VIOLATED');
  assert.equal(out.fields.EPISTEMIC_BASIS,'EXTERNALLY_SUPPORTED');
  for(const name of ['SUPPORTING_EVIDENCE_IDS','DERIVATION_OR_REVIEW_IDS']){
   assert.deepEqual(plain(out.fields[name]),plain(pr.fields[name].filter(id=>!future.has(id))),'Retain earlier/current references in original order.');
   assert.deepEqual(plain(out[name]),plain(out.fields[name]),'Both registered field aliases agree.');
  }
  for(const id of future)assert(!JSON.stringify(out).includes(id),'Later support must not survive in coupled reasons.');
  cases.push('mixed-refutation-links-at-stage-'+stage);
 }
 {
  const p=synthetic([[4,'ESTABLISHES'],[5,'REFUTES'],[6,'REFUTES']]),out=proposition(check(p,5));
  assert.equal(out.fields.TRUTH_VALUE,'UNKNOWN');assert.equal(out.fields.STATUS,'CONTRADICTED');assert.equal(out.fields.CONTRADICTION_STATUS,'CONTRADICTED');assert.equal(out.fields.SUPPORTING_EVIDENCE_IDS.length,2);
  cases.push('current-direct-contradiction-remains-blocking');
 }
 {
  const p=synthetic([[5,'REFUTES']]),before=proposition(p),out=proposition(check(p,5));
  for(const name of Object.keys(summary))assert.deepEqual(plain(out.fields[name]),plain(before.fields[name]));
  cases.push('current-only-projection-remains-exact');
 }
 {
  const p=synthetic([[6,'REFUTES']]),pr=proposition(p);
  for(const [name,value]of Object.entries({TRUTH_VALUE:'TRUE',STATUS:'SATISFIED',EPISTEMIC_BASIS:'APPLICATION_OBSERVED',REASONS:['LATER_FAVORABLE_CONCLUSION_WITHOUT_AN_ID']}))assign(pr,name,value);
  const out=proposition(check(p,5));assert.equal(out.fields.TRUTH_VALUE,'UNKNOWN');assert.equal(out.fields.STATUS,'UNDETERMINED');assert.equal(out.fields.EPISTEMIC_BASIS,'NONE');assert(!JSON.stringify(out).includes('LATER_FAVORABLE_CONCLUSION'));assert.deepEqual(plain(out.fields.SUPPORTING_EVIDENCE_IDS),[]);assert.deepEqual(plain(out.fields.DERIVATION_OR_REVIEW_IDS),[schema.PROJECT_PROJECTION_DERIVATION_CONTRACT.id]);
  cases.push('future-only-support-withholds-entire-favorable-summary');
 }
 for(const [name,change]of [
  ['authored-text',pr=>assign(pr,'PROPOSITION_TEXT',laterReview.id)],
  ['authored-relationship',pr=>pr.relationships.UNREGISTERED_FUTURE_LINK=laterReview.id],
  ['unknown-field',pr=>pr.fields.UNKNOWN_EXTENSION={copy:[laterReview.id]}],
  ['unknown-copy',pr=>pr.unknownCopy={fields:{DERIVATION_OR_REVIEW_IDS:[laterReview.id]}}],
  ['authored-evidence',pr=>pr.evidenceRefs.push(laterReview.id)]
 ]){
  const p=engine.clone(project);change(proposition(p));assert(!proposition(check(p,5)),'Future authored '+name+' must still be excluded.');cases.push('future-'+name+'-still-blocks');
 }
 {
  const p=synthetic([[5,'REFUTES']]),evidence=p.projectData.evidenceRecords.find(row=>row.id==='EVIDENCE-CONTEXT-5-REFUTES');evidence.unknownCopy={source:laterReview.id};
  assert(!proposition(check(p,5)),'A current support record copied from future authored work must still poison its dependent.');cases.push('transitive-future-authored-copy-still-blocks');
 }
 for(const missing of ['null','future-authored-version']){
  const p=engine.clone(project);
  if(missing==='null')p.job.CURRENT_REQUIREMENTS_VERSION=null;
  else p.projectData.artifactVersions.find(row=>row.version===requirementsVersion).unknownDependency=laterReview.id;
  assert.throws(()=>{const prepared=engine.preparePromptContext(p,5,{operation:'SEMANTIC_REVIEW'});prompts.buildPromptRecord(5,p,prepared.options);},error=>error.code==='MISSING_REQUIRED_PROMPT_SCOPE','Invalid current requirement scope must not be repaired from caller guesses: '+missing);cases.push('missing-required-version-'+missing+'-fails');
 }
 const source=fs.readFileSync('workflow-engine.js','utf8'),anchor='record=propositionEvidenceProjection(record,family);';
 assert.equal(source.split(anchor).length-1,1,'STAGE05_PROJECTION_FAULT_ANCHOR_ORACLE');
 const mutant=createVerifierRuntime({Event:globalThis.Event,dispatchEvent:()=>true});for(const file of files)createVerifierRuntime.loadScript(mutant,file==='workflow-engine.js'?source.replace(anchor,''):fs.readFileSync(file,'utf8'),{filename:file});
 assert.throws(()=>assert.equal(mutant.closedLoopWorkflowEngine.stageContext(mutant.structuredClone(project),5).job.CURRENT_REQUIREMENTS_VERSION,requirementsVersion,'STAGE05_ACCEPTED_VERSION_PROJECTION_ORACLE'),/STAGE05_ACCEPTED_VERSION_PROJECTION_ORACLE/);
 cases.push('removed-new-projection-owner-detected-on-actual-accepted-state');
 console.log(JSON.stringify({case:'stage05-calculated-evidence-projection',status:'PASS',cases,fixture:'Actual accepted Stage01–06 for scope/review/mutation controls; explicitly synthetic evidence rows for selection and refutation controls.'},null,2));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let source=healthyFullCyclePrerequisiteSource(fs.readFileSync('verify-full-cycle.mjs','utf8'));
 const before='// Reopening an upstream review after test design must not bind that review to',after='// Saved legacy definitions must get an operation-specific correction package.';
 for(const anchor of [before,after])assert.equal(source.split(anchor).length-1,1,'STAGE05_BOUNDED_PREREQUISITE_ANCHOR_ORACLE');
 assert.equal(source.split('verifyStage05ReviewProjection(p);').length-1,1,'STAGE05_REQUIRED_FULL_CYCLE_OWNER_ORACLE');
 source=source.replace(after,"console.log(JSON.stringify({case:'stage05-real-review-reopen-accept-and-stage06-rebuild',status:'PASS'}));process.exit(0);\n"+after);
 const temporary='.stage05-review-projection-prerequisite-'+process.pid+'.mjs';fs.writeFileSync(temporary,source);
 try{const child=spawnSync(process.execPath,[temporary],{encoding:'utf8',maxBuffer:32*1024*1024,timeout:120000,env:{...process.env,NODE_OPTIONS:''}});process.stdout.write(child.stdout||'');process.stderr.write(child.stderr||'');if(child.error)throw child.error;assert.equal(child.status,0,'STAGE05_BOUNDED_PREREQUISITE_ORACLE');}
 finally{fs.unlinkSync(temporary);}
}
