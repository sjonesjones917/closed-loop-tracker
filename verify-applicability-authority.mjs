import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {operatorPrefixFixture} from './operator-prefix-fixture.mjs';

// §26.5: reducing an obligation requires a current accepted independent review.
// These are application-authority cases using accepted synthetic responses.
// They do not establish the external truth of a semantic applicability finding.
const source=fs.readFileSync('workflow-engine.js','utf8');
const serialized=operatorPrefixFixture(5),cases=[];
function load(engineSource){
 const c=vm.createContext({console,TextEncoder,TextDecoder,Blob,crypto:globalThis.crypto,dispatchEvent(){},Event:class{}});
 for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
 vm.runInContext(engineSource,c,{filename:'workflow-engine.js'});
 return {engine:c.closedLoopWorkflowEngine,copy:text=>vm.runInContext('JSON.parse('+JSON.stringify(text)+')',c)};
}
function oracle(engineSource){
 const {engine:e,copy}=load(engineSource),base=copy(serialized),app=e.recordsForCurrentScope(base,'applicabilityRecords')[0],subject=e.recordValue(app,'SUBJECT_ID');
 const review=p=>e.recordsForCurrentScope(p,'semanticReviews').find(row=>Number(row.stage)===5),decision=p=>e.recordsForCurrentScope(p,'applicabilityRecords')[0];
 assert.equal(e.evaluateApplicability(base,subject),'APPLICABLE','The real accepted review fixture must establish its applicability before mutation');
 const supported=copy(serialized);review(supported).fields.INDEPENDENCE_DETERMINATION=review(supported).INDEPENDENCE_DETERMINATION='EXTERNALLY_SUPPORTED';assert.equal(e.evaluateApplicability(supported,subject),'APPLICABLE','A supported independence basis must remain admissible when its required application context checks pass');
 const set=(row,field,value,family)=>{row.fields[field]=value;row[field]=value;e.refreshRecordHashes(row,family);};
 const checks=[
  ['unregistered-reviewer',p=>{const ctx=e.recordValue(review(p),'REVIEWER_CONTEXT_ID');p.projectData.freshContexts=p.projectData.freshContexts.filter(row=>e.recordId(row,'freshContexts')!==ctx);}],
  ['unregistered-author',p=>{const ctx=e.recordValue(review(p),'AUTHOR_CONTEXT_ID');p.projectData.freshContexts=p.projectData.freshContexts.filter(row=>e.recordId(row,'freshContexts')!==ctx);}],
  ['missing-review-acceptance',p=>{const raw=review(p).rawResponseId;p.projectData.acceptedChanges=p.projectData.acceptedChanges.filter(row=>row.rawResponseId!==raw);}],
  ['missing-review-handoff',p=>{const raw=review(p).rawResponseId,change=e.acceptedChanges(p,5).find(row=>row.rawResponseId===raw);p.projectData.generatedPrompts=p.projectData.generatedPrompts.filter(row=>row.instructionId!==change.promptId);}],
  ['changed-applicability-after-review',p=>{set(decision(p),'PROPOSED_APPLICABILITY','NOT_APPLICABLE','applicabilityRecords');set(decision(p),'SELECTED_APPLICABILITY','NOT_APPLICABLE','applicabilityRecords');}],
  ['changed-reviewed-hash',p=>set(review(p),'REVIEWED_HASHES',['0'.repeat(64)],'semanticReviews')],
  ['contaminated-reviewer',p=>{const ctx=e.recordValue(review(p),'REVIEWER_CONTEXT_ID'),row=e.records(p,'freshContexts').find(row=>e.recordId(row,'freshContexts')===ctx);set(row,'CONTAMINATION_STATUS','CONTAMINATED','freshContexts');}],
  ['self-review',p=>set(review(p),'REVIEWER_CONTEXT_ID',e.recordValue(review(p),'AUTHOR_CONTEXT_ID'),'semanticReviews')]
 ];
 const results=[];
 for(const [caseId,violate] of checks){
  const p=copy(serialized);violate(p);
  assert.equal(e.evaluateApplicability(p,subject),'UNKNOWN','APPLICABILITY_AUTHORITY_ORACLE: '+caseId+' established an authoritative applicability decision');
  assert.equal(e.mandatoryRequirements(p).length,1,'Invalid review authority removed a mandatory requirement');
  assert.equal(e.evaluateApplicability(copy(serialized),subject),'APPLICABLE','Restoring the valid accepted review did not recover');
  results.push({caseId,result:'PASS',actual:'UNKNOWN',restored:'APPLICABLE'});
 }
 return results;
}
cases.push(...oracle(source));
for(const [caseId,before,after] of [
 ['bypassed-review-authority','function acceptedSemanticReview(p,targetId){','function acceptedSemanticReview(p,targetId){ return true;'],
 ['bypassed-reviewed-target-hash','if(target)return e0.refreshRecordHashes(e0.clone(target),family).recordSha256===hashes[index];','if(target)return true;']
]){
 assert(source.includes(before),'Missing production fault anchor');
 assert.throws(()=>oracle(source.replace(before,after)),/APPLICABILITY_AUTHORITY_ORACLE/,'The executed authority oracle must detect '+caseId);
 oracle(source);cases.push({caseId,result:'DETECTED',restored:'PASS'});
}

console.log(JSON.stringify({applicabilityAuthority:'PASS',evidenceClass:'production authority component with accepted synthetic response prefix',externalSemanticTruthEstablished:false,actualBrowserJourney:false,cases}));
