// Deliberately synthetic format/proof-consumer regression. No authored source
// extraction, independent review, execution receipt or release proof is claimed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atomicObligationSha256,validateAtomicRequirementRows,validateAtomicLineMembership,validateAtomicIdentityCrosswalk,loadReviewedAtomicExtraction} from '/workspace/shared/clrt-atomic-review/review-specification-coverage.mjs';
import {evaluateFullRequirementProof,coverageDeclarationSha256,sha,SPECIFICATION_PATH} from '/workspace/shared/clrt-atomic-review/verification-evidence.mjs';
import {verificationCatalog} from '/workspace/shared/clrt-atomic-review/verification-evidence-catalog.mjs';
const root='/workspace/shared/clrt-atomic-review',hash=globalThis.closedLoopHash.sha256Value,copy=structuredClone;
const source=Buffer.from('1. Synthetic governance fixture\n\nWhen the independent reviewer approves:\nThe worker MUST preserve α; the worker MUST reject β.\n');
const lines=source.toString('utf8').split('\n'),specificationSha256=sha(source),sections=[{sectionId:'1',startLine:1,endLine:5}],location=line=>({path:SPECIFICATION_PATH,startLine:line,endLine:line,lineSha256:sha(lines[line-1])});
const context={...location(3),controllingText:lines[2]},parentId='NREQ-'+ '1'.repeat(32),contextId='NREQ-'+ '2'.repeat(32);
const makeAtom=(key,statement,text)=>{
 const startByte=source.indexOf(Buffer.from(text)),sourceSpans=[{startByte,endByte:startByte+Buffer.byteLength(text),text,sha256:sha(text)}],scope={key,statement,sourceSpans,contextSourceLocations:[context]};scope.sha256=atomicObligationSha256(scope);
 const birthIdentity={sourceSha256:specificationSha256,sourceAnchor:{line:4,lineSha256:location(4).lineSha256},atomicKey:key};
 return {normativeRequirementId:'NREQ-'+hash(birthIdentity).slice(0,32),sectionId:'1',entryKind:'ATOMIC_OBLIGATION',sourceLocation:location(4),controllingText:lines[3],atomicObligation:scope,birthIdentity,schemaOrRegistryEntry:'SYNTHETIC_FIXTURE',requiredBrowserOrPhysicalDeviceProof:[]};
};
const atoms=[makeAtom('preserve.alpha','When the independent reviewer approves, the worker MUST preserve α.','The worker MUST preserve α'),makeAtom('reject.beta','When the independent reviewer approves, the worker MUST reject β.','the worker MUST reject β.')];
const retained={normativeRequirementId:contextId,sectionId:'1',entryKind:'SOURCE_CONTEXT',sourceLocation:location(3),controllingText:lines[2],contextClassification:{classification:'STRUCTURAL_REQUIREMENT_CONTEXT',reason:'Synthetic shared condition controls both child atoms.',governingNormativeRequirementIds:atoms.map(row=>row.normativeRequirementId),governingSourceRanges:[[4,4]]}};
const entries=[retained,...atoms];
const coverage=lines.map((text,index)=>({line:index+1,lineSha256:sha(text),status:index===2||index===3?'NORMATIVE_REQUIREMENT':text?'SECTION_HEADING':'BLANK',normativeRequirementIds:index===2?[contextId,...atoms.map(row=>row.normativeRequirementId)].sort():index===3?atoms.map(row=>row.normativeRequirementId).sort():[],reason:'Synthetic formatting/source context.'}));
const prior={schema:'closed-loop-normative-requirements/1',specificationSha256,requirements:[{normativeRequirementId:contextId,sectionId:'1',sourceLocation:location(3),controllingText:lines[2]},{normativeRequirementId:parentId,sectionId:'1',sourceLocation:location(4),controllingText:lines[3]}]};
const sourceInput={path:SPECIFICATION_PATH,sha256:specificationSha256};
const propositions=prefix=>[{propositionId:prefix+'-context',statement:'Synthetic list condition.',classification:'STRUCTURAL_REQUIREMENT_CONTEXT',reason:'Synthetic independent context classification.',primarySourceLine:3,sourceLineSha256:location(3).lineSha256,contextSourceLocations:[]},...atoms.map((row,i)=>({propositionId:prefix+'-'+i,statement:row.atomicObligation.statement,primarySourceLine:4,sourceLineSha256:location(4).lineSha256,contextSourceLocations:[context]}))];
const extraction=(prefix,role)=>({schema:'closed-loop-atomic-extraction-evidence/1',role,actorId:'SYNTHETIC-'+prefix,contextId:'SYNTHETIC-CONTEXT-'+prefix,specificationSha256,complete:true,inputs:[sourceInput],...(role==='INDEPENDENT_REVIEW'?{draftManifestReceived:false}:{}),propositions:propositions(prefix),sections:[{...sections[0],disposition:'COVERED',propositionIds:propositions(prefix).map(row=>row.propositionId),reason:'SYNTHETIC test input, never actual source review.'}]});
const draft=extraction('DRAFT','DRAFT'),review=extraction('REVIEW','INDEPENDENT_REVIEW');
const priorRef={path:'verification/synthetic-prior.json',sha256:sha(JSON.stringify(prior))};
const scopeMap=Object.fromEntries(atoms.map(row=>[row.normativeRequirementId,row.atomicObligation.sha256]));
const decisions=[{decisionId:'synthetic-context',reason:'Synthetic retained context mapping.',disposition:'MAPPED',draftPropositionIds:['DRAFT-context'],independentReviewPropositionIds:['REVIEW-context'],currentNormativeRequirementIds:[contextId],currentAtomicScopeSha256:{}},{decisionId:'synthetic-split',reason:'Synthetic split demonstrates distinct shared-line predicates, not actual review.',disposition:'MAPPED',draftPropositionIds:['DRAFT-0','DRAFT-1'],independentReviewPropositionIds:['REVIEW-0','REVIEW-1'],currentNormativeRequirementIds:atoms.map(row=>row.normativeRequirementId),currentAtomicScopeSha256:scopeMap}];
const crosswalk=prior.requirements.map(row=>({priorManifestSha256:priorRef.sha256,priorSpecificationSha256:specificationSha256,priorNormativeRequirementId:row.normativeRequirementId,priorSourceLocation:row.sourceLocation,relation:row.normativeRequirementId===contextId?'RETAINED_CONTEXT':'SPLIT_COMPOUND',currentNormativeRequirementIds:row.normativeRequirementId===contextId?[contextId]:atoms.map(row=>row.normativeRequirementId),reason:'Synthetic explicit historical identity relation.',reconciliationDecisionId:row.normativeRequirementId===contextId?'synthetic-context':'synthetic-split'}));
const reconciliation={schema:'closed-loop-atomic-reconciliation/1',actorId:'SYNTHETIC-RECONCILER',contextId:'SYNTHETIC-CONTEXT-RECONCILER',specificationSha256,status:'RECONCILED',complete:true,priorManifest:priorRef,entries,requirementIdentityCrosswalk:crosswalk,decisions,unresolvedMaterialDisagreements:[],sections:[{...sections[0],disposition:'COVERED',normativeRequirementIds:entries.map(row=>row.normativeRequirementId),reason:'Synthetic total fixture membership.'}]};
function evidence(d=draft,r=review,c=reconciliation){
 d=copy(d);r=copy(r);c=copy(c);const files=new Map(),pin=(p,value)=>{const bytes=Buffer.from(JSON.stringify(value));files.set(p,bytes);return {path:p,sha256:sha(bytes),actorId:value.actorId,contextId:value.contextId,specificationSha256};};
 const dd=pin('verification/synthetic-draft.json',d),rr=pin('verification/synthetic-review.json',r);rr.draftManifestReceived=false;
 c.inputs=[sourceInput,dd,rr,c.priorManifest];files.set(priorRef.path,Buffer.from(JSON.stringify(prior)));const cc=pin('verification/synthetic-reconciliation.json',c);
 return {files,descriptor:{status:'RECONCILED',draft:dd,independentReview:rr,reconciliation:cc},options:{sourceBytes:source,specificationPath:SPECIFICATION_PATH,sections,priorRequirements:prior.requirements,readFile:file=>{assert(files.has(file));return files.get(file);}}};
}
const run=(d=draft,r=review,c=reconciliation)=>{const {descriptor,options}=evidence(d,r,c);return loadReviewedAtomicExtraction(descriptor,options);};
const cases=[],reject=(name,operation,pattern)=>{assert.throws(operation,pattern,name);assert.equal(run().established,true);validateAtomicLineMembership(entries,coverage,source,SPECIFICATION_PATH,sections);cases.push(name);};
assert.equal(run().established,true);assert.equal(run().entries.filter(row=>row.entryKind==='ATOMIC_OBLIGATION').length,2);validateAtomicLineMembership(entries,coverage,source,SPECIFICATION_PATH,sections);
for(const [name,mutate,pattern] of [
 ['same-line-sibling-omitted',rows=>rows.pop(),/context references missing/],
 ['duplicate-atomic-id',rows=>rows.push(copy(rows[1])),/ID missing or duplicated/],
 ['duplicate-atomic-key',rows=>{rows[2].atomicObligation.key=rows[1].atomicObligation.key;rows[2].atomicObligation.sha256=atomicObligationSha256(rows[2].atomicObligation);},/key duplicated/],
 ['stale-scope-hash',rows=>rows[1].atomicObligation.sha256='0'.repeat(64),/scope digest mismatch/],
 ['qualifier-changed-with-old-digest',rows=>rows[1].atomicObligation.statement='The worker MUST preserve α, even without review.',/scope digest mismatch/],
 ['source-span-stale-hash',rows=>rows[1].atomicObligation.sourceSpans[0].sha256='0'.repeat(64),/span bytes\/hash mismatch/],
 ['source-span-outside-primary-line',rows=>rows[1].atomicObligation.sourceSpans[0].startByte=0,/outside primary line/],
 ['source-span-splits-utf8',rows=>{const span=rows[1].atomicObligation.sourceSpans[0];span.endByte--;},/splits UTF-8/],
 ['missing-required-context',rows=>{rows[1].atomicObligation.contextSourceLocations=[];rows[1].atomicObligation.sha256=atomicObligationSha256(rows[1].atomicObligation);},/omitted required context/],
 ['missing-governing-sibling',rows=>rows[0].contextClassification.governingNormativeRequirementIds.pop(),/range membership incomplete/],
 ['wrong-section',rows=>rows[1].sectionId='2',/section\/anchor mismatch/]
])reject(name,()=>{const rows=copy(entries);mutate(rows);validateAtomicRequirementRows(source,rows,SPECIFICATION_PATH,sections);},pattern);
reject('missing-context-reverse-membership',()=>{const rows=copy(coverage);rows[2].normativeRequirementIds.pop();validateAtomicLineMembership(entries,rows,source,SPECIFICATION_PATH,sections);},/reverse membership/);
reject('duplicate-line-membership',()=>{const rows=copy(coverage);rows[3].normativeRequirementIds.push(rows[3].normativeRequirementIds[0]);validateAtomicLineMembership(entries,rows,source,SPECIFICATION_PATH,sections);},/coverage IDs absent or duplicated/);
for(const [name,mutate,pattern] of [
 ['missing-reconciliation-decision',c=>c.decisions.pop(),/reconciliation or active entry coverage incomplete/],
 ['reconciled-sibling-omission',c=>{c.entries.pop();},/context references missing/],
 ['stale-crosswalk',c=>c.requirementIdentityCrosswalk[1].priorManifestSha256='0'.repeat(64),/historical identity stale/],
 ['duplicate-crosswalk-predecessor',c=>c.requirementIdentityCrosswalk[1]=copy(c.requirementIdentityCrosswalk[0]),/predecessor missing or duplicated/],
 ['missing-crosswalk-predecessor',c=>c.requirementIdentityCrosswalk.pop(),/predecessor universe incomplete/],
 ['parent-reused-for-narrower-child',c=>c.requirementIdentityCrosswalk[1].currentNormativeRequirementIds=[contextId,...atoms.map(row=>row.normativeRequirementId)],/unresolved or unknown target/],
 ['fake-complete-without-sections',c=>c.sections=[],/section coverage incomplete/],
 ['unresolved-material-disagreement',c=>c.unresolvedMaterialDisagreements=['Synthetic disagreement'],/disagreements unresolved/],
 ['wrong-reconciled-scope-digest',c=>c.decisions[1].currentAtomicScopeSha256[atoms[0].normativeRequirementId]='0'.repeat(64),/scope digest mismatch/],
 ['double-reconciled-proposition',c=>c.decisions[1].draftPropositionIds.push('DRAFT-context'),/reconciled twice/],
 ['context-omitted-and-rehashed',c=>{c.entries=c.entries.filter(row=>row.entryKind!=='SOURCE_CONTEXT');c.entries[0].atomicObligation.contextSourceLocations=[];c.entries[0].atomicObligation.sha256=atomicObligationSha256(c.entries[0].atomicObligation);c.sections[0].normativeRequirementIds=c.entries.map(row=>row.normativeRequirementId);c.decisions.shift();c.decisions[0].currentAtomicScopeSha256[c.entries[0].normativeRequirementId]=c.entries[0].atomicObligation.sha256;},/reviewed qualifier\/context omitted/]
])reject(name,()=>{const c=copy(reconciliation);mutate(c);run(draft,review,c);},pattern);
reject('reviewer-received-draft',()=>{const r=copy(review);r.inputs.push({path:'verification/synthetic-draft.json',sha256:'0'.repeat(64)});run(draft,r);},/input isolation false/);
reject('reconciler-reuses-review-context',()=>{const c=copy(reconciliation);c.contextId=review.contextId;run(draft,review,c);},/independence missing/);
reject('reviewer-sections-omitted',()=>{const r=copy(review);r.sections=[];run(draft,r);},/section coverage incomplete/);
reject('double-counted-crosswalk-target',()=>{
 const rows=copy(crosswalk),ds=new Map(copy(decisions).map(row=>[row.decisionId,row]));
 rows[0].relation='MERGED_EQUIVALENT';rows[0].currentNormativeRequirementIds=[atoms[0].normativeRequirementId];const decision=ds.get('synthetic-context');decision.currentNormativeRequirementIds=[atoms[0].normativeRequirementId];decision.equivalenceReason='Synthetic explicit duplicate merge challenge.';
 validateAtomicIdentityCrosswalk(rows,prior,priorRef,entries,ds,source);
},/target double counted/);
reject('missing-independent-context-classification',()=>{const r=copy(review);delete r.propositions[0].classification;run(draft,r);},/context lacks current independent classification/);
reject('forged-reviewer-context-anchor',()=>{const r=copy(review);r.propositions[1].contextSourceLocations[0].lineSha256='0'.repeat(64);run(draft,r);},/qualifier\/context source mismatch/);
const pending=loadReviewedAtomicExtraction({status:'PENDING',atomicRequirementCompletenessEstablished:true},{sourceBytes:source});assert.equal(pending.established,false);cases.push('pending-booleans-never-establish-completeness');
reject('complete-booleans-without-records',()=>loadReviewedAtomicExtraction({status:'RECONCILED',complete:true,atomicRequirementCompletenessEstablished:true},{sourceBytes:source,specificationPath:SPECIFICATION_PATH,sections}),/independence missing/);

// Historical source relocation does not reallocate old singleton/context IDs.
const relocated=evidence(),oldPrior=copy(prior);oldPrior.specificationSha256='9'.repeat(64);for(const row of oldPrior.requirements){row.sourceLocation.startLine+=10;row.sourceLocation.endLine+=10;}
const pinExtra=(e,file,record)=>{const bytes=Buffer.from(JSON.stringify(record));e.files.set(file,bytes);return {path:file,sha256:sha(bytes)};};
const c=JSON.parse(relocated.files.get(relocated.descriptor.reconciliation.path));c.sourceTraceManifest=pinExtra(relocated,'verification/synthetic-current-source-prior.json',prior);c.priorManifest=pinExtra(relocated,'verification/synthetic-prior.json',oldPrior);
const relocation={schema:'closed-loop-source-relocation-crosswalk/1',priorManifestFileSha256:c.priorManifest.sha256,priorSpecificationSha256:oldPrior.specificationSha256,targetSpecificationSha256:specificationSha256,semanticAtomicEquivalenceEstablished:false,implementationConformanceClaim:false,crosswalk:oldPrior.requirements.map((row,i)=>({priorNormativeRequirementId:row.normativeRequirementId,priorSourceLocation:row.sourceLocation,priorControllingText:row.controllingText,priorRawLineSha256:row.sourceLocation.lineSha256,relation:'EXACT_SOURCE_LINE_RELOCATION',targetSourceLine:prior.requirements[i].sourceLocation.startLine,targetRawLineSha256:row.sourceLocation.lineSha256,targetSourceTraceIds:[row.normativeRequirementId]}))};
c.historicalSourceRelocationCrosswalk=pinExtra(relocated,'verification/synthetic-relocation.json',relocation);
for(const row of c.requirementIdentityCrosswalk){row.priorManifestSha256=c.priorManifest.sha256;row.priorSpecificationSha256=oldPrior.specificationSha256;row.priorSourceLocation=oldPrior.requirements.find(old=>old.normativeRequirementId===row.priorNormativeRequirementId).sourceLocation;}
c.inputs=[sourceInput,relocated.descriptor.draft,relocated.descriptor.independentReview,c.priorManifest,c.sourceTraceManifest,c.historicalSourceRelocationCrosswalk];Object.assign(relocated.descriptor.reconciliation,pinExtra(relocated,relocated.descriptor.reconciliation.path,c));
assert.equal(loadReviewedAtomicExtraction(relocated.descriptor,relocated.options).entries[0].normativeRequirementId,contextId);cases.push('historical-relocation-retains-reviewed-id');
const saved=copy(c),bad=copy(relocation);bad.crosswalk[0].targetRawLineSha256='0'.repeat(64);c.historicalSourceRelocationCrosswalk=pinExtra(relocated,'verification/synthetic-relocation.json',bad);c.inputs[c.inputs.length-1]=c.historicalSourceRelocationCrosswalk;Object.assign(relocated.descriptor.reconciliation,pinExtra(relocated,relocated.descriptor.reconciliation.path,c));
reject('stale-historical-relocation',()=>loadReviewedAtomicExtraction(relocated.descriptor,relocated.options),/relocation source bytes changed/);
// Execute the historical row validator against valid trace-shaped siblings.
const oldCore=JSON.parse(fs.readFileSync(path.join(root,'verification/atomic-proof-regression-baseline-20261014.json')));
assert.equal(oldCore.rowValidationSha256,'1f255e5b12c084ba7133d9033017e8e1548b34720d2d7cf130571941bc049787');assert.equal(sha(oldCore.rowValidationSource),oldCore.rowValidationSha256);
const oldRows=new Function('nm','SP','lines','sh','fs','allowed','A',oldCore.rowValidationSource);
const traceRows=atoms.map(row=>({...row,responsibleImplementationOwner:'test-runtime.js',deterministicTestIds:['verify-test-runtime-v3.mjs'],semanticTestIds:[],mutationTestIds:[],acceptanceReportField:'normativeRequirementTrace.'+row.normativeRequirementId,currentDisposition:'UNKNOWN'}));
assert.throws(()=>oldRows({requirements:traceRows},SPECIFICATION_PATH,lines,sha,fs,new Set(['UNKNOWN']),(value,message)=>assert(value,message)),/Duplicated normative line/);validateAtomicRequirementRows(source,traceRows,SPECIFICATION_PATH,sections);cases.push('executed-pre-correction-one-row-per-line-regression');

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atomic-proof-fixture-')),cwd=process.cwd(),reviewPath='verification/synthetic-atomic-proof.json',suite='verify-test-runtime-v3.mjs',checkId='test-ir.unknown-operation';
try{
 fs.mkdirSync(path.join(directory,'specification'));fs.mkdirSync(path.join(directory,'verification'));fs.writeFileSync(path.join(directory,SPECIFICATION_PATH),source);
 const fingerprint={specificationSha256,inputSha256:{[SPECIFICATION_PATH]:specificationSha256}};
 const inputs=[suite,'verification-evidence-catalog.mjs',...(verificationCatalog[suite].sourceInputs||[]),'test-runtime.js'];for(const file of new Set(inputs))fingerprint.inputSha256[file]=sha(fs.readFileSync(path.join(root,file)));
 const observations=new Map([[checkId,{checkId,suite,passed:true,evidenceBasis:'EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS',receiptSha256:'3'.repeat(64)}]]);
 const bindingFor=row=>({normativeRequirementId:row.normativeRequirementId,sourceLineSha256:row.sourceLocation.lineSha256,atomicObligationSha256:row.atomicObligation.sha256,checkIds:[checkId],fullCoverage:{schema:'closed-loop-full-requirement-coverage/1',sourceLineSha256:row.sourceLocation.lineSha256,atomicObligationSha256:row.atomicObligation.sha256,reviewedAtomicStatement:row.atomicObligation.statement,contextSourceLocations:row.atomicObligation.contextSourceLocations,sourceSpans:row.atomicObligation.sourceSpans,schemaOrRegistryEntry:row.schemaOrRegistryEntry,productionOwners:[{path:'test-runtime.js',symbol:'validateSpec',sha256:fingerprint.inputSha256['test-runtime.js']}],obligations:[{id:'synthetic-atomic-case',sourceText:row.atomicObligation.sourceSpans[0].text,expectedBehavior:row.atomicObligation.statement,checks:{deterministic:[{suite,checkId}],semantic:[],mutation:[]},nonapplicable:{semantic:'Synthetic format test only.',mutation:'Synthetic format test only.'},evidenceKinds:['EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS']}],unresolvedObligations:[]}});
 const bindReview=(row,binding,mutate=()=>{})=>{const coverage=binding.fullCoverage,record={schema:'closed-loop-requirement-coverage-review/1',normativeRequirementId:row.normativeRequirementId,sourceLineSha256:row.sourceLocation.lineSha256,specificationSha256,declarationSha256:coverageDeclarationSha256(coverage),atomicObligationSha256:row.atomicObligation.sha256,reviewedAtomicStatement:row.atomicObligation.statement,contextSourceLocations:row.atomicObligation.contextSourceLocations,decision:'COMPLETE_COVERAGE',evidenceBasis:'EXTERNALLY_SUPPORTED',method:'SYNTHETIC proof consumer gate input only.',author:{actor:'SYNTHETIC-AUTHOR',contextId:'SYNTHETIC-AUTHOR'},reviewer:{actor:'SYNTHETIC-REVIEWER',contextId:'SYNTHETIC-REVIEWER'},reviewedInputs:[...Object.entries(fingerprint.inputSha256).filter(([file])=>file!==reviewPath).map(([path,sha256])=>({path,sha256})),{declarationSha256:coverageDeclarationSha256(coverage)}],findings:[],reviewPerformed:true,syntheticFixture:true};mutate(record);fs.writeFileSync(reviewPath,JSON.stringify(record));fingerprint.inputSha256[reviewPath]=sha(fs.readFileSync(reviewPath));coverage.review={path:reviewPath,sha256:fingerprint.inputSha256[reviewPath]};};
 process.chdir(directory);const row=atoms[0],binding=bindingFor(row);bindReview(row,binding);assert.equal(evaluateFullRequirementProof(row,[binding],observations,fingerprint).disposition,'CONFORMANT_PROVEN');cases.push('synthetic-current-atomic-proof-positive');
 const partial=copy(binding);partial.fullCoverage.obligations[0].sourceText='MUST';bindReview(row,partial);const partialResult=evaluateFullRequirementProof(row,[partial],observations,fingerprint);console.error(JSON.stringify({independentChallenge:'single-token-source-decomposition',sourceSpan:row.atomicObligation.sourceSpans[0].text,declaredProofSourceText:'MUST',result:partialResult}));bindReview(row,binding);
 const rejectProof=(name,change,reason)=>{const r=copy(row),b=copy(binding);change(r,b);bindReview(r,b);const actual=evaluateFullRequirementProof(r,[b],observations,fingerprint);assert.equal(actual.disposition,'UNKNOWN',name);assert(actual.reasons.includes(reason),`${name}: ${actual.reasons}`);bindReview(row,binding);assert.equal(evaluateFullRequirementProof(row,[binding],observations,fingerprint).disposition,'CONFORMANT_PROVEN');cases.push(name);};
 rejectProof('copied-parent-whole-line-proof',(_,b)=>{delete b.atomicObligationSha256;delete b.fullCoverage.atomicObligationSha256;b.fullCoverage.obligations[0].sourceText=lines[3];},'ATOMIC_PROOF_SCOPE_BINDING_MISMATCH');
 rejectProof('copied-sibling-proof-same-source-hash',(_,b)=>{b.atomicObligationSha256=atoms[1].atomicObligation.sha256;},'ATOMIC_PROOF_SCOPE_BINDING_MISMATCH');
 rejectProof('proof-old-scope-after-qualifier-change',(r)=>{r.atomicObligation.statement='Synthetic changed condition';r.atomicObligation.sha256=atomicObligationSha256(r.atomicObligation);},'ATOMIC_PROOF_SCOPE_BINDING_MISMATCH');
 rejectProof('proof-context-removed',(_,b)=>b.fullCoverage.contextSourceLocations=[],'ATOMIC_PROOF_PROPOSITION_OR_CONTEXT_MISMATCH');
 rejectProof('proof-current-hash-wrong-statement',(_,b)=>b.fullCoverage.reviewedAtomicStatement='Weaker statement','ATOMIC_PROOF_PROPOSITION_OR_CONTEXT_MISMATCH');
 const wrongReview=copy(binding);bindReview(row,wrongReview,r=>r.atomicObligationSha256=atoms[1].atomicObligation.sha256);assert(evaluateFullRequirementProof(row,[wrongReview],observations,fingerprint).reasons.includes('ATOMIC_COVERAGE_REVIEW_SCOPE_OR_CONTEXT_MISMATCH'));cases.push('coverage-review-sibling-scope');
 // Execute the actual pre-correction evaluator, not an imitation. It rejects
 // this otherwise complete per-atom source slice because it demands the entire
 // compound parent line, demonstrating the old cardinality/proof defect.
 const baseline=JSON.parse(fs.readFileSync(path.join(root,'verification/atomic-proof-regression-baseline-20261014.json'),'utf8'));
 assert.equal(baseline.sourceCommit,'46a3c55ec5a2776f1ca6dd921aa41d54677c4633');assert.equal(baseline.functionSha256,'198d61338df39acfb94d37fcd3973e47e4c60aa3f82528b96337235e04c74d02');assert.equal(sha(baseline.functionSource),baseline.functionSha256);
 const body=baseline.functionSource.replace('export function','function');
 const {isDeepStrictEqual}=await import('node:util');const oldEvaluate=new Function('isDeepStrictEqual','plain','nonempty','readJson','coverageDeclarationSha256','SPECIFICATION_PATH','verificationCatalog','browserVerificationCatalog',body+'; return evaluateFullRequirementProof;')(isDeepStrictEqual,v=>v!==null&&typeof v==='object'&&!Array.isArray(v),v=>typeof v==='string'&&v.trim().length>0,file=>JSON.parse(fs.readFileSync(file)),coverageDeclarationSha256,SPECIFICATION_PATH,verificationCatalog,{});
 bindReview(row,binding);const before=oldEvaluate(row,[binding],observations,fingerprint);assert(before.reasons.includes('INCOMPLETE_SOURCE_OBLIGATION_DECOMPOSITION'));assert.equal(evaluateFullRequirementProof(row,[binding],observations,fingerprint).disposition,'CONFORMANT_PROVEN');cases.push('executed-pre-correction-whole-line-proof-regression');
}finally{process.chdir(cwd);fs.rmSync(directory,{recursive:true,force:true});}
console.log(JSON.stringify({schema:'closed-loop-atomic-governance-format-regression/1',passed:true,syntheticFixture:true,atomicCompletenessEstablished:false,implementationConformanceEstablished:false,caseCount:cases.length,cases},null,2));
