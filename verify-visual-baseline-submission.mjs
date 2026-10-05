import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {visualBaselineFixture} from './test-fixtures.mjs';
import {runtimePaths} from './verified-site.mjs';
import {resolveVisualBaselineSubmission as resolve,resolveVisualBaselineResourceGraph} from './visual-baseline-submission.mjs';
// Isolated synthetic fixtures test transport only; they are not acceptance evidence.
const commit='a'.repeat(40);
let clock=Date.parse('2026-10-05T00:00:00Z');
const advancingDate=class extends Date{constructor(...args){super(...(args.length?args:[clock++]));}};
const evidence=visualBaselineFixture(projectStoreRuntime({environment:{Date:advancingDate}}),{commit});
assert.notEqual(evidence.authorityRecord.fields.VALID_FROM,evidence.authorityReceipt.createdAt,'Production decision and receipt use separate clock captures.');
const context={inputJson:JSON.stringify(evidence),ledgerVisualBaseline:{status:'OPEN'},eventName:'workflow_dispatch',ref:'refs/heads/main',submitter:'DISPOSABLE-ACTOR',commit,deploymentManifestDigest:evidence.comparison.deploymentManifest.manifestDigest.digest,baselineResourceGraph:{sourceCommit:commit,paths:runtimePaths}};
function verifyTransport(implementation){
 const accepted=implementation(context),observations=[];
 assert.deepEqual(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(accepted).filter(([key])=>key!=='submission')))),evidence);
 assert.deepEqual(JSON.parse(JSON.stringify(accepted.submission)),{method:'AUTHENTICATED_WORKFLOW_INPUT',submitter:context.submitter,commit,eventName:'workflow_dispatch',ref:'refs/heads/main'});
 function reject(id,change,name,message){
  const input=structuredClone(context);change(input);let observed=null;
  try{implementation(input);}catch(error){observed={name:error.name,message:error.message};}
  assert.deepEqual(observed,{name,message},'VISUAL_REJECTION_REASON_ORACLE: '+id);
  assert.equal(implementation(context).comparedCommit,commit,'VISUAL_REJECTION_CONTROL_ORACLE: '+id);
  observations.push({caseId:id,result:'PASS',expected:{name,message},actual:observed});
 }
 const authentication='Visual evidence requires authenticated workflow dispatch on exact main.';
 for(const eventName of ['push','pull_request',''])reject('event-'+(eventName||'missing'),input=>input.eventName=eventName,'Error',authentication);
 for(const ref of ['refs/heads/other','refs/tags/acceptance',''])reject('ref-'+(ref||'missing'),input=>input.ref=ref,'Error',authentication);
 reject('missing-submitter',input=>input.submitter='','Error',authentication);
 reject('invalid-commit',input=>input.commit='short','Error',authentication);
 reject('nontext-input',input=>input.inputJson={},'TypeError','Visual evidence input must be JSON text.');
 reject('malformed-json',input=>input.inputJson='{','Error','Visual evidence input is not valid JSON.');
 for(const inputJson of ['null','[]','true','"approved"'])reject('nonobject-'+inputJson,input=>input.inputJson=inputJson,'Error','Visual evidence must be an object.');
 const classes=[
  ['status',e=>e.status='OPEN','Visual evidence must bind a passing comparison to the exact submitted commit.'],
  ['source-commit',e=>e.sourceCommit='short','Visual evidence must bind a passing comparison to the exact submitted commit.'],
  ['foreign-compared-commit',e=>e.comparedCommit='c'.repeat(40),'Visual evidence must bind a passing comparison to the exact submitted commit.'],
  ['missing-compared-commit',e=>delete e.comparedCommit,'Visual evidence must bind a passing comparison to the exact submitted commit.'],
  ['comparison-result',e=>e.comparisonResult='FAIL','Visual evidence must bind a passing comparison to the exact submitted commit.'],
  ['authority-kind',e=>e.authority='SAFARI_FEEDBACK','Visual evidence requires the actual approved-predecessor or human-authorization record identity.'],
  ['authority-id',e=>delete e.authorityRecordId,'Visual evidence requires the actual approved-predecessor or human-authorization record identity.'],
  ['empty-references',e=>e.evidenceReferences=[],'Visual evidence must reference actual approval and before/after comparison artifacts.'],
  ['blank-reference',e=>e.evidenceReferences=[''],'Visual evidence must reference actual approval and before/after comparison artifacts.']
 ];
 for(const [id,change,message] of classes)reject(id,input=>{const value=structuredClone(evidence);change(value);input.inputJson=JSON.stringify(value);},'Error',message);
 const tuple='Visual evidence requires the complete frozen baseline tuple.',comparison='Visual evidence requires a complete comparison bound to the frozen tuple and exact deployed artifact.',decision='Visual evidence requires an actual current human-decision record bound to this frozen tuple.',receipt='Visual evidence requires the matching recorded human-decision receipt.';
 const tupleCases=[
  ['missing-frozen-tuple',e=>delete e.baseline,tuple],['tuple-not-object',e=>e.baseline=[],tuple],['missing-baseline-id',e=>delete e.baseline.VISUAL_BASELINE_ID,tuple],['tuple-source-mismatch',e=>e.baseline.sourceCommit='b'.repeat(40),tuple],
  ['missing-manifest',e=>delete e.baseline.deploymentManifest,'Visual evidence requires an exact-source deployment manifest and complete resource hashes.'],
  ['corrupt-manifest',e=>e.baseline.deploymentManifest.runtimeResources[0].byteSize=2,'Visual evidence deployment manifest identity does not match the supplied source or final deployed artifact.'],
  ['resource-type',e=>{e.baseline.deploymentManifest.runtimeResources[0].byteSize='1';const unsigned={...e.baseline.deploymentManifest};delete unsigned.manifestDigest;e.baseline.deploymentManifest.manifestDigest.digest=globalThis.closedLoopHash.sha256Value(unsigned);},'Visual evidence contains an invalid or duplicate deployment resource.'],
  ['missing-resource',e=>{e.baseline.deploymentManifest.runtimeResources.pop();const unsigned={...e.baseline.deploymentManifest};delete unsigned.manifestDigest;e.baseline.deploymentManifest.manifestDigest.digest=globalThis.closedLoopHash.sha256Value(unsigned);},'Visual evidence requires the complete registered deployment resource graph.'],
  ['missing-viewport',e=>e.baseline.viewports.pop(),tuple],['viewport-wrong-type',e=>e.baseline.viewports[0].width='320',tuple],['viewport-duplicate',e=>e.baseline.viewports[1].id=e.baseline.viewports[0].id,tuple],
  ['prompt-dimension-type',e=>e.baseline.viewports[0].promptBox.height='120px',tuple],['missing-style',e=>e.baseline.viewports[0].promptBox.computedStyles={},tuple],['style-nested',e=>e.baseline.viewports[0].promptBox.computedStyles.width={},tuple],['screenshot-missing',e=>delete e.baseline.viewports[0].referenceScreenshot,tuple],['screenshot-hash-array',e=>e.baseline.viewports[0].referenceScreenshot.sha256=[e.baseline.viewports[0].referenceScreenshot.sha256],tuple],
  ['missing-dynamic-inventory',e=>delete e.baseline.dynamicRegions,tuple],['region-wrong-viewport',e=>e.baseline.dynamicRegions[0].viewportId='OTHER',tuple],['missing-normative-ui-reference',e=>delete e.baseline.allowedChangeRegions[0].normativeRequirementReference,tuple],
  ['missing-comparison',e=>delete e.comparison,comparison],['comparison-wrong-tuple',e=>e.comparison.baselineSha256='f'.repeat(64),comparison],['comparison-wrong-commit',e=>e.comparison.comparedCommit='b'.repeat(40),comparison],['comparison-viewport-missing',e=>e.comparison.viewportIds.pop(),comparison],['comparison-screenshot-missing',e=>e.comparison.screenshots.pop(),comparison],['comparison-screenshot-duplicate',e=>e.comparison.screenshots[1].viewportId=e.comparison.screenshots[0].viewportId,comparison],
  ['ignored-unknown-region',e=>e.comparison.ignoredDynamicRegionIds=['UNREGISTERED'],'Visual evidence cannot change or ignore a region outside the frozen inventory.'],['changed-unknown-region',e=>e.comparison.changedRegionIds=['UNREGISTERED'],'Visual evidence cannot change or ignore a region outside the frozen inventory.'],
  ['missing-authority-record',e=>delete e.authorityRecord,decision],['claim-only-authority',e=>e.authorityRecord.source='AGENT_REPORT',decision],['wrong-human-purpose',e=>{e.authorityRecord.fields.PURPOSE=e.authorityRecord.PURPOSE='INTENT_CONFIRMATION';},decision],['wrong-human-target',e=>{e.authorityRecord.fields.TARGET_ID=e.authorityRecord.TARGET_ID='OTHER-JOB';},decision],['unknown-human-assurance',e=>{e.authorityRecord.fields.IDENTITY_ASSURANCE=e.authorityRecord.IDENTITY_ASSURANCE='UNKNOWN';},decision],['negative-human-value',e=>{e.authorityRecord.fields.VALUE.authorized=e.authorityRecord.VALUE.authorized=false;},decision],['expired-human-decision',e=>{e.authorityRecord.fields.VALID_UNTIL=e.authorityRecord.VALID_UNTIL='2000-01-01T00:00:00Z';},decision],['noncanonical-decision-time',e=>{e.authorityRecord.fields.VALID_FROM=e.authorityRecord.VALID_FROM='1';},decision],['authority-alias-disagreement',e=>e.authorityRecord.PURPOSE='INTENT_CONFIRMATION',decision],['missing-human-receipt',e=>delete e.authorityReceipt,receipt],['unrelated-human-receipt',e=>e.authorityReceipt.recordId='OTHER',receipt],['agent-labelled-human-receipt',e=>e.authorityReceipt.type='AGENT_REPORT',receipt],['noncanonical-receipt-time',e=>e.authorityReceipt.createdAt='2026-10-05',receipt]
 ];
 for(const [id,change,message] of tupleCases)reject(id,input=>{const value=structuredClone(evidence);change(value);input.inputJson=JSON.stringify(value);},'Error',message);
 for(const [id,change] of [['unknown-extension-surrogate',value=>value.unknownExtension='\ud800'],['nested-extension-surrogate',value=>value.baseline.extension='\ud800']])reject(id,input=>{const value=structuredClone(evidence);change(value);input.inputJson=JSON.stringify(value);},'Error','Visual evidence contains data outside the canonical JSON contract.');
 reject('json-number-overflow',input=>input.inputJson=input.inputJson.slice(0,-1)+',"unknownExtension":1e400}','Error','Visual evidence contains data outside the canonical JSON contract.');
 const fractional=visualBaselineFixture(projectStoreRuntime(),{commit,promptBoxWidth:'298.75'});assert.equal(implementation({...context,inputJson:JSON.stringify(fractional)}).baseline.viewports[0].promptBox.width,'298.75','Fractional measured geometry must survive canonical hashing without rounding.');
 // 397.59375 is retained from the immutable base browser geometry capture;
 // only this producer encoding is tested, never approval of that real capture.
 const measured=visualBaselineFixture(projectStoreRuntime(),{commit,promptBoxHeight:'397.59375'});assert.equal(implementation({...context,inputJson:JSON.stringify(measured)}).baseline.viewports[0].promptBox.height,'397.59375');
 const tiny=visualBaselineFixture(projectStoreRuntime(),{commit,promptBoxWidth:'0.'+'0'.repeat(330)+'1'});assert.equal(implementation({...context,inputJson:JSON.stringify(tiny)}).baseline.viewports[0].promptBox.width,tiny.baseline.viewports[0].promptBox.width,'Exact positivity must not underflow through Number coercion.');
 for(const value of ['0','-0','-1','+1','01','1e400','Infinity','1.2px'])reject('invalid-decimal-dimension-'+value,input=>{const candidate=structuredClone(evidence);candidate.baseline.viewports[0].promptBox.width=value;input.inputJson=JSON.stringify(candidate);},'Error',tuple);
 for(const claimed of ['VERIFIED_EXTERNAL','AUTHENTICATED'])reject('unavailable-human-assurance-'+claimed,input=>{const value=structuredClone(evidence);value.authorityRecord.fields.IDENTITY_ASSURANCE=value.authorityRecord.IDENTITY_ASSURANCE=value.authorityReceipt.identityAssurance=claimed;input.inputJson=JSON.stringify(value);},'Error',decision);
 reject('different-final-artifact',input=>input.deploymentManifestDigest='f'.repeat(64),'Error','Visual evidence deployment manifest identity does not match the supplied source or final deployed artifact.');
 const extension={...evidence,unknownExtension:{retained:['exact','bytes metadata']}};assert.deepEqual(implementation({...context,inputJson:JSON.stringify(extension)}).unknownExtension,extension.unknownExtension);
 const intentional=structuredClone(evidence);intentional.comparison.changedRegionIds=['DISPOSABLE-ALLOWED'];assert.equal(implementation({...context,inputJson:JSON.stringify(intentional)}).comparison.changedRegionIds.length,1,'Current human-authorized frozen tuple must permit its specific normative UI change.');
 const prior=visualBaselineFixture(projectStoreRuntime(),{commit,sourceCommit:'b'.repeat(40),decisionPurpose:'TRADEOFF_OR_SCOPE_DECISION'}),predecessor={...prior,authority:'APPROVED_PREDECESSOR',authorityRecordId:'DISPOSABLE-PREDECESSOR',predecessorRecord:{recordId:'DISPOSABLE-PREDECESSOR',VISUAL_BASELINE_ID:prior.baseline.VISUAL_BASELINE_ID,baselineSha256:prior.comparison.baselineSha256,candidates:[{sourceCommit:prior.sourceCommit,approvalRecordId:prior.authorityRecordId,approvalRecord:prior.authorityRecord,approvalReceipt:prior.authorityReceipt,approvalEvidenceReferences:['DISPOSABLE-ACTUAL-APPROVAL'],historyEvidenceReferences:['DISPOSABLE-HISTORY']} ]}};delete predecessor.authorityRecord;delete predecessor.authorityReceipt;
 const priorGraph={sourceCommit:prior.sourceCommit,paths:runtimePaths};
 assert.equal(implementation({...context,baselineResourceGraph:priorGraph,inputJson:JSON.stringify(predecessor)}).authority,'APPROVED_PREDECESSOR');
 for(const [id,change,message] of [
  ['predecessor-label-only',e=>delete e.predecessorRecord.candidates[0].approvalRecord,decision],['predecessor-unrelated-purpose',e=>{const candidate=e.predecessorRecord.candidates[0];candidate.approvalRecord.fields.PURPOSE=candidate.approvalRecord.PURPOSE=candidate.approvalReceipt.purpose='BACKUP_POLICY_SELECTION';},decision],['predecessor-ambiguous',e=>e.predecessorRecord.candidates.push(structuredClone(e.predecessorRecord.candidates[0])),'Visual evidence requires one mechanically established approved predecessor bound to this frozen tuple.'],['old-baseline-cannot-authorize-change',e=>e.comparison.changedRegionIds=['DISPOSABLE-ALLOWED'],'Intentional visual changes require a new human-authorized baseline for the exact compared commit.']
 ])reject(id,input=>{const value=structuredClone(predecessor);change(value);input.baselineResourceGraph=priorGraph;input.inputJson=JSON.stringify(value);},'Error',message);
 // A historical graph may legitimately differ from the current graph. The
 // trusted fixture context, rather than supplied evidence, selects its paths.
 const historicalPaths=runtimePaths.filter(path=>path!=='.nojekyll'),different=visualBaselineFixture(projectStoreRuntime(),{commit,sourceCommit:'b'.repeat(40),baselineResourcePaths:historicalPaths});
 assert.equal(implementation({...context,baselineResourceGraph:{sourceCommit:different.sourceCommit,paths:historicalPaths},inputJson:JSON.stringify(different)}).status,'PROVEN','Different complete historic/current resource graphs must remain usable.');
 reject('producer-cannot-override-source-graph',input=>{const value=structuredClone(evidence);value.baselineResourceGraph={sourceCommit:commit,paths:['index.html']};value.baseline.deploymentManifest.runtimeResources=value.baseline.deploymentManifest.runtimeResources.filter(row=>row.path==='index.html');const unsigned={...value.baseline.deploymentManifest};delete unsigned.manifestDigest;value.baseline.deploymentManifest.manifestDigest.digest=globalThis.closedLoopHash.sha256Value(unsigned);input.inputJson=JSON.stringify(value);},'Error','Visual evidence requires the complete registered deployment resource graph.');
 const spoof=implementation({...context,inputJson:JSON.stringify({...evidence,submission:{submitter:'SPOOFED'}})});assert.equal(spoof.submission.submitter,context.submitter);
 const ledger={status:'OPEN',basis:'Approval not yet established'},fallback=implementation({inputJson:'',ledgerVisualBaseline:ledger});
 assert.deepEqual(JSON.parse(JSON.stringify(fallback)),ledger);assert.notEqual(fallback,ledger);assert.equal(implementation(),null);
 return observations;
}
const observations=verifyTransport(resolve),faults=[];
const checkedOutCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),historical=resolveVisualBaselineResourceGraph(checkedOutCommit);assert.equal(historical.sourceCommit,checkedOutCommit);assert.equal(historical.sourcePath,'verified-site.mjs');assert.deepEqual(historical.paths,runtimePaths);assert.match(historical.sourceDefinitionSha256,/^[0-9a-f]{64}$/);
assert.throws(()=>resolveVisualBaselineResourceGraph('f'.repeat(40)),/baseline resource graph is unavailable/);
const source=fs.readFileSync('visual-baseline-submission.mjs','utf8');
// Controlled source lookup tests parsing only; producer code is never executed.
const graphRuntime=createVerifierRuntime({runtimePaths,process,dispatchEvent(){},Event:class Event{},execFileSync:()=>graphRuntime.controlledSource});for(const file of ['workbook.js','workflow-schema.js','test-runtime.js'])createVerifierRuntime.loadScript(graphRuntime,fs.readFileSync(file,'utf8'),{filename:file});createVerifierRuntime.loadScript(graphRuntime,source.replace(/^import .*;\n/gm,'').replace(/const humanDecisionPolicy=\(\(\)=>\{[\s\S]*?\}\)\(\);/,'const humanDecisionPolicy={...globalThis.closedLoopWorkflowSchema,exactDecimalParts:globalThis.closedLoopTestRuntime.exactDecimalParts};').replace(/export function /g,'function '),{filename:'visual-baseline-submission.mjs:controlled-source-lookup'});
graphRuntime.controlledSource="export const runtimePaths=(()=>{throw new Error('UNTRUSTED_SOURCE_EXECUTED');})();";assert.throws(()=>graphRuntime.resolveVisualBaselineResourceGraph('1'.repeat(40)),/baseline resource graph is not mechanically recognized/);
graphRuntime.controlledSource="export const runtimePaths=['index.html','historical-extra.js'];";assert.deepEqual(JSON.parse(JSON.stringify(graphRuntime.resolveVisualBaselineResourceGraph('2'.repeat(40)).paths)),['index.html','historical-extra.js']);
for(const [id,before,after] of [
 ['unrelated-crash',"  if(typeof inputJson!=='string')","  if(eventName==='push')throw new ReferenceError('CONTROLLED_UNRELATED_VISUAL_CRASH');\n  if(typeof inputJson!=='string')"],
 ['wrong-rejection-reason',"throw new Error('Visual evidence requires authenticated workflow dispatch on exact main.')","throw new Error('Unrelated fixture error.')"]
]){
 assert.equal(source.split(before).length,2,'VISUAL_FAULT_ANCHOR_ORACLE: '+id);
 const runtime=createVerifierRuntime({runtimePaths,process,dispatchEvent(){},Event:class Event{}});for(const file of ['workbook.js','workflow-schema.js','test-runtime.js'])createVerifierRuntime.loadScript(runtime,fs.readFileSync(file,'utf8'),{filename:file});createVerifierRuntime.loadScript(runtime,source.replace(before,after).replace(/^import .*;\n/gm,'').replace(/const humanDecisionPolicy=\(\(\)=>\{[\s\S]*?\}\)\(\);/,'const humanDecisionPolicy={...globalThis.closedLoopWorkflowSchema,exactDecimalParts:globalThis.closedLoopTestRuntime.exactDecimalParts};').replace(/export function /g,'function '),{filename:'visual-baseline-submission.mjs:disposable-fault'});
 assert.throws(()=>verifyTransport(runtime.resolveVisualBaselineSubmission),error=>error.code==='ERR_ASSERTION'&&error.message.startsWith('VISUAL_REJECTION_REASON_ORACLE'),'VISUAL_FAULT_DETECTION_ORACLE: '+id);
 verifyTransport(resolve);faults.push({id,result:'DETECTED',restored:'PASS'});
}
for(const [id,before,after,caseId] of [
 ['missing-tuple-accepted','  const tuple=evidence.baseline,comparison=evidence.comparison;','  if(!evidence.baseline)return {valid:true,issues:[]};\n  const tuple=evidence.baseline,comparison=evidence.comparison;','missing-frozen-tuple'],
 ['resource-type-accepted',"!Number.isSafeInteger(row.byteSize)||row.byteSize<0||",'', 'resource-type'],
 ['unknown-ignored-region-accepted','||comparison[key].some(id=>!inventory.has(id))','', 'ignored-unknown-region'],
 ['human-label-accepted',"record.source!=='HUMAN_DECISION_COMMAND'||",'', 'claim-only-authority']
]){
 assert.equal(source.split(before).length,2,'VISUAL_FAULT_ANCHOR_ORACLE: '+id);
 const runtime=createVerifierRuntime({runtimePaths,process,dispatchEvent(){},Event:class Event{}});for(const file of ['workbook.js','workflow-schema.js','test-runtime.js'])createVerifierRuntime.loadScript(runtime,fs.readFileSync(file,'utf8'),{filename:file});createVerifierRuntime.loadScript(runtime,source.replace(before,after).replace(/^import .*;\n/gm,'').replace(/const humanDecisionPolicy=\(\(\)=>\{[\s\S]*?\}\)\(\);/,'const humanDecisionPolicy={...globalThis.closedLoopWorkflowSchema,exactDecimalParts:globalThis.closedLoopTestRuntime.exactDecimalParts};').replace(/export function /g,'function '),{filename:'visual-baseline-submission.mjs:disposable-fault'});
 assert.throws(()=>verifyTransport(runtime.resolveVisualBaselineSubmission),error=>error.code==='ERR_ASSERTION'&&error.message.startsWith('VISUAL_REJECTION_REASON_ORACLE: '+caseId),'VISUAL_FAULT_DETECTION_ORACLE: '+id);
 verifyTransport(resolve);faults.push({id,result:'DETECTED',owningCase:caseId,restored:'PASS'});
}
const workflow=fs.readFileSync(new URL('./.github/workflows/pages.yml',import.meta.url),'utf8');
for(const token of ['visual_baseline_evidence_json:','VISUAL_BASELINE_EVIDENCE_JSON:','node verify-visual-baseline-submission.mjs','const visualBaseline=resolveVisualBaselineSubmission(','inputJson:process.env.VISUAL_BASELINE_EVIDENCE_JSON','submitter:process.env.GITHUB_ACTOR','ref:process.env.GITHUB_REF','commit:report.commit'])assert(workflow.includes(token),`Missing visual evidence wiring: ${token}`);
console.log(JSON.stringify({visualBaselineSubmission:'PASS',negativeCases:observations.length,observations,faults,exactCommitRequired:true,authenticatedSubmitterBound:true,unapprovedLedgerPreserved:true,repairRestoresProgression:true,physicalDeviceEvidenceClaimed:false,visualApprovalClaimed:false}));
