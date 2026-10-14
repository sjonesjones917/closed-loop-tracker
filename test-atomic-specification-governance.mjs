// Deliberately synthetic format/proof-consumer regression. No authored source
// extraction, independent review, execution receipt or release proof is claimed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atomicContributorIdentity,atomicEvidenceReferences,isAtomicEvidencePath,readAtomicEvidenceBytes,atomicObligationSha256,validateAtomicRequirementRows,validateAtomicLineMembership,validateAtomicIdentityCrosswalk,loadReviewedAtomicExtraction} from './review-specification-coverage.mjs';
import {evaluateFullRequirementProof,coverageDeclarationSha256,sha,SPECIFICATION_PATH} from './verification-evidence.mjs';
import {verificationCatalog} from './verification-evidence-catalog.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),hash=globalThis.closedLoopHash.sha256Value,copy=structuredClone;
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

// An independent extraction can add a primary duty on a source line that the
// old line-level inventory treated as context. Exercise the actual generator
// mapping, including its unchanged candidate-default helpers.
const untracedScope={key:'new.reviewed-primary',statement:'SYNTHETIC reviewed new primary requirement.',sourceSpans:[{startByte:0,endByte:Buffer.byteLength(lines[0]),text:lines[0],sha256:sha(lines[0])}],contextSourceLocations:[]};untracedScope.sha256=atomicObligationSha256(untracedScope);
const untracedBirth={sourceSha256:specificationSha256,sourceAnchor:{line:1,lineSha256:location(1).lineSha256},atomicKey:untracedScope.key};
const untraced={normativeRequirementId:'NREQ-'+hash(untracedBirth).slice(0,32),sectionId:'1',entryKind:'ATOMIC_OBLIGATION',sourceLocation:location(1),controllingText:lines[0],atomicObligation:untracedScope,birthIdentity:untracedBirth};
const newDraft=copy(draft),newReview=copy(review),newReconciliation=copy(reconciliation);
for(const [record,prefix] of [[newDraft,'DRAFT'],[newReview,'REVIEW']]){const p={propositionId:prefix+'-new',statement:untracedScope.statement,primarySourceLine:1,sourceLineSha256:location(1).lineSha256,contextSourceLocations:[]};record.propositions.push(p);record.sections[0].propositionIds.push(p.propositionId);}
newReconciliation.entries.push(untraced);newReconciliation.sections[0].normativeRequirementIds.push(untraced.normativeRequirementId);newReconciliation.decisions.push({decisionId:'new-primary',reason:'Synthetic genuinely new primary discovered in independent review.',disposition:'MAPPED',draftPropositionIds:['DRAFT-new'],independentReviewPropositionIds:['REVIEW-new'],currentNormativeRequirementIds:[untraced.normativeRequirementId],currentAtomicScopeSha256:{[untraced.normativeRequirementId]:untracedScope.sha256}});
const newlyReviewed=run(newDraft,newReview,newReconciliation);assert.equal(newlyReviewed.entries.length,4);
assert.equal(oldCore.activatedMapperSha256,'6bdad21117ef61bd78e1a6777d6de16d182c2e4aa86ba1cc0d492f9377ccedf0');assert.equal(sha(oldCore.activatedMapperSource),oldCore.activatedMapperSha256);
assert.throws(()=>new Function('req','atomic',oldCore.activatedMapperSource+';return req;')(copy(prior.requirements),newlyReviewed),/no independently reviewed source trace/);
const generator=fs.readFileSync(path.join(root,'generate-specification-governance.mjs'),'utf8'),helpers=generator.slice(generator.indexOf('const fileOwner='),generator.indexOf('let req=[...by.values()]')),mapper=generator.slice(generator.indexOf(' const sourceRows=new Map(req.map('),generator.indexOf('\n}\nconst bound=',generator.indexOf(' const sourceRows=new Map(req.map(')));
const mapped=new Function('req','atomic',helpers+mapper+';return req;')(copy(prior.requirements),newlyReviewed),newRow=mapped.find(row=>row.normativeRequirementId===untraced.normativeRequirementId);
assert(newRow);assert.equal(newRow.currentDisposition,'UNKNOWN');assert.equal(newRow.atomicObligation.sha256,untracedScope.sha256);assert.equal(newRow.productionOwnerStatus,'CANDIDATE_MODULE_MAPPING');assert.equal(newRow.testTraceStatus,'CANDIDATE_FILE_MAPPING');assert(newRow.deterministicTestIds.length&&newRow.deterministicTestIds.every(file=>fs.existsSync(path.join(root,file))));assert.equal(Object.hasOwn(newRow,'executedEvidence'),false);assert.equal(Object.hasOwn(newRow,'fullCoverage'),false);cases.push('reviewed-new-primary-before-after-production-mapper');

// The loader and receipt fingerprint share the same nested-path policy.
const nested=evidence(),nestedRecord=JSON.parse(nested.files.get(nested.descriptor.reconciliation.path));
for(const [file,bytes] of [...nested.files])nested.files.set(file.replace('verification/','verification/nested/'),bytes);
for(const ref of [nested.descriptor.draft,nested.descriptor.independentReview,nested.descriptor.reconciliation,nestedRecord.priorManifest,...nestedRecord.inputs.filter(ref=>ref.path.startsWith('verification/'))])ref.path=ref.path.replace('verification/','verification/nested/');
Object.assign(nested.descriptor.reconciliation,pinExtra(nested,nested.descriptor.reconciliation.path,nestedRecord));assert.equal(loadReviewedAtomicExtraction(nested.descriptor,nested.options).established,true);cases.push('nested-atomic-evidence-loader-path');
const pathRoot=fs.mkdtempSync(path.join(os.tmpdir(),'atomic-path-root-')),outside=fs.mkdtempSync(path.join(os.tmpdir(),'atomic-path-outside-'));
try{
 const file='verification/nested/fixture.json';fs.mkdirSync(path.dirname(path.join(pathRoot,file)),{recursive:true});fs.writeFileSync(path.join(pathRoot,file),'{}');assert.equal(readAtomicEvidenceBytes(file,pathRoot).toString(),'{}');assert.equal(isAtomicEvidencePath(file),true);cases.push('nested-atomic-evidence-shared-fingerprint-path');
 for(const file of ['../fixture.json','verification/../fixture.json','verification/nested/../../fixture.json','verification//fixture.json','/verification/fixture.json','verification/./fixture.json']){assert.equal(isAtomicEvidencePath(file),false);assert.throws(()=>readAtomicEvidenceBytes(file,pathRoot),/file path invalid/);}cases.push('atomic-evidence-traversal-paths-rejected');
 fs.writeFileSync(path.join(outside,'fixture.json'),'{}');fs.symlinkSync(path.join(outside,'fixture.json'),path.join(pathRoot,'verification/nested/escape.json'));assert.throws(()=>readAtomicEvidenceBytes('verification/nested/escape.json',pathRoot),/escapes first-party source root/);cases.push('atomic-evidence-symlink-escape-rejected');
}finally{fs.rmSync(pathRoot,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});}

// Synthetic changed-singleton context removal mirrors the real historical
// amendment-removal case without asserting any real requirement equivalence.
const changedSource=Buffer.from('The same primary duty remains.\n'),oldSource=Buffer.from('The same primary duty remains.\nOld exception extends the duty.\n'),oldSha=sha(oldSource),changedSha=sha(changedSource),oldDutyId='NREQ-'+'a'.repeat(32),oldExceptionId='NREQ-'+'b'.repeat(32),dutyLocation={path:SPECIFICATION_PATH,startLine:1,endLine:1,lineSha256:sha('The same primary duty remains.')},exceptionLocation={path:SPECIFICATION_PATH,startLine:2,endLine:2,lineSha256:sha('Old exception extends the duty.')},oldContext={...exceptionLocation,controllingText:'Old exception extends the duty.'};
const changedScope={key:'changed.singleton',statement:'The duty applies without the removed exception.',sourceSpans:[{startByte:0,endByte:changedSource.length-1,text:'The same primary duty remains.',sha256:dutyLocation.lineSha256}],contextSourceLocations:[]};changedScope.sha256=atomicObligationSha256(changedScope);
const changedBirth={sourceSha256:changedSha,sourceAnchor:{line:1,lineSha256:dutyLocation.lineSha256},atomicKey:changedScope.key},changedId='NREQ-'+hash(changedBirth).slice(0,32),changedAtom={normativeRequirementId:changedId,entryKind:'ATOMIC_OBLIGATION',sourceLocation:dutyLocation,controllingText:'The same primary duty remains.',atomicObligation:changedScope,birthIdentity:changedBirth};
const changedPrior={schema:'closed-loop-normative-requirements/1',specificationSha256:oldSha,requirements:[{normativeRequirementId:oldDutyId,sourceLocation:dutyLocation,controllingText:'The same primary duty remains.'},{normativeRequirementId:oldExceptionId,sourceLocation:exceptionLocation,controllingText:oldContext.controllingText}]},changedPriorRef={sha256:sha(JSON.stringify(changedPrior))};
const scopeChange={priorNormativeRequirementId:oldDutyId,currentNormativeRequirementId:changedId,priorStatement:'The duty applies with the old exception.',currentStatement:changedScope.statement,currentAtomicObligationSha256:changedScope.sha256,reason:'Synthetic old exception removal changes the singleton semantic scope.',authority:{kind:'CONTROLLING_SOURCE_REPLACEMENT',priorSpecificationSha256:oldSha,currentSpecificationSha256:changedSha,reason:'Synthetic exact replacement source omits the prior exception.'},priorContextSourceLocations:[oldContext],currentContextSourceLocations:[],contextChanges:[{kind:'REMOVED',priorContextSourceLocation:oldContext,reason:'Exact old exception text is absent from the replacement source.'}]};
const changedDecisions=new Map([['changed',{decisionId:'changed',priorWasSingleObligation:true,currentNormativeRequirementIds:[changedId],scopeChange}],['removed',{decisionId:'removed',currentNormativeRequirementIds:[],removalAuthority:'Synthetic exact replacement removes the old exception.'}]]);
const changedCrosswalk=changedPrior.requirements.map((row,i)=>({priorManifestSha256:changedPriorRef.sha256,priorSpecificationSha256:oldSha,priorNormativeRequirementId:row.normativeRequirementId,priorSourceLocation:row.sourceLocation,relation:i?'REMOVED_FROM_CONTROLLING_SOURCE':'CHANGED_SINGLETON_SCOPE',currentNormativeRequirementIds:i?[]:[changedId],reason:i?'Synthetic removed exception.':'Synthetic reviewed singleton scope change.',reconciliationDecisionId:i?'removed':'changed'}));
const changedCheck=(cw=changedCrosswalk,rows=[changedAtom],ds=changedDecisions,bytes=changedSource)=>validateAtomicIdentityCrosswalk(cw,changedPrior,changedPriorRef,rows,ds,bytes,null,oldSource);
changedCheck();cases.push('changed-singleton-fresh-identity-with-retired-context');
const crosswalkBaseline=JSON.parse(fs.readFileSync(path.join(root,'verification/atomic-proof-regression-baseline-20261014.json')));assert.equal(crosswalkBaseline.identityCrosswalkSha256,'25ed70c0c4e7cec7d0d10dcb146742cac0b9d2e67f19e02dbb7726ae3b7ac3b2');assert.equal(sha(crosswalkBaseline.identityCrosswalkSource),crosswalkBaseline.identityCrosswalkSha256);
const oldCrosswalk=new Function('atomicList','assert','atomicText','atomicEqual','sha256','atomicHash',crosswalkBaseline.identityCrosswalkSource.replace('export function','function')+';return validateAtomicIdentityCrosswalk;')((values,label)=>{assert(Array.isArray(values)&&new Set(values).size===values.length,label);return values;},(value,message)=>assert(value,message),value=>typeof value==='string'&&value.trim().length>0,(a,b)=>hash(a)===hash(b),sha,hash);
assert.throws(()=>oldCrosswalk(changedCrosswalk,changedPrior,changedPriorRef,[changedAtom],changedDecisions,changedSource),/crosswalk relation invalid/);cases.push('changed-singleton-executed-pre-correction-crosswalk-failure');
for(const [name,edit,pattern] of [
 ['changed-singleton-copied-parent-proof',(cw,rows)=>rows[0].executedEvidence=[{normativeRequirementId:oldDutyId}],/cannot inherit predecessor proof/],
 ['changed-singleton-old-id-reused',(cw,rows,ds)=>{rows[0].normativeRequirementId=oldDutyId;cw[0].currentNormativeRequirementIds=[oldDutyId];ds.get('changed').currentNormativeRequirementIds=[oldDutyId];},/retire its predecessor/],
 ['changed-singleton-ancestor-still-active',(cw,rows)=>rows.push({...changedAtom,normativeRequirementId:oldDutyId}),/retire its predecessor/],
 ['changed-singleton-two-children',(cw,rows,ds)=>{cw[0].currentNormativeRequirementIds.push(oldDutyId);rows.push({...changedAtom,normativeRequirementId:oldDutyId});ds.get('changed').currentNormativeRequirementIds.push(oldDutyId);},/retire its predecessor/],
 ['changed-singleton-unchanged-mislabel',cw=>cw[0].relation='UNCHANGED_ATOMIC',/changed scope cannot be labeled/],
 ['changed-singleton-equivalent-merge-mislabel',cw=>cw[0].relation='MERGED_EQUIVALENT',/changed scope cannot be labeled/],
 ['changed-singleton-missing-review',(cw,rows,ds)=>delete ds.get('changed').scopeChange,/scope review incomplete/],
 ['changed-singleton-no-singleton-review',(cw,rows,ds)=>delete ds.get('changed').priorWasSingleObligation,/scope review incomplete/],
 ['changed-singleton-stale-prior-authority',(cw,rows,ds)=>ds.get('changed').scopeChange.authority.priorSpecificationSha256='0'.repeat(64),/source authority mismatch/],
 ['changed-singleton-stale-current-authority',(cw,rows,ds)=>ds.get('changed').scopeChange.authority.currentSpecificationSha256='0'.repeat(64),/source authority mismatch/],
 ['changed-singleton-stale-current-scope',(cw,rows,ds)=>ds.get('changed').scopeChange.currentAtomicObligationSha256='0'.repeat(64),/scope review incomplete/],
 ['changed-singleton-fabricated-old-context',(cw,rows,ds)=>ds.get('changed').scopeChange.priorContextSourceLocations[0].lineSha256='0'.repeat(64),/historical context not in pinned/],
 ['changed-singleton-missing-context-inventory',(cw,rows,ds)=>delete ds.get('changed').scopeChange.priorContextSourceLocations,/context inventory incomplete/],
 ['changed-singleton-unresolved-context-difference',(cw,rows,ds)=>ds.get('changed').scopeChange.contextChanges=[],/context difference unresolved/],
 ['changed-singleton-duplicate-context-change',(cw,rows,ds)=>ds.get('changed').scopeChange.contextChanges.push(copy(ds.get('changed').scopeChange.contextChanges[0])),/removed context missing or duplicated/],
 ['changed-singleton-missing-authority-reason',(cw,rows,ds)=>ds.get('changed').scopeChange.authority.reason='',/source authority mismatch/]
]){const cw=copy(changedCrosswalk),rows=copy([changedAtom]),ds=copy(changedDecisions);edit(cw,rows,ds);assert.throws(()=>changedCheck(cw,rows,ds),pattern,name);changedCheck();cases.push(name);}

assert.throws(()=>validateAtomicIdentityCrosswalk(changedCrosswalk,changedPrior,changedPriorRef,[changedAtom],changedDecisions,changedSource),/exact historical source bytes required/);cases.push('changed-singleton-historical-source-archive-missing');
assert.throws(()=>validateAtomicIdentityCrosswalk(changedCrosswalk,changedPrior,changedPriorRef,[changedAtom],changedDecisions,changedSource,null,Buffer.from('tampered source')),/exact historical source bytes required/);cases.push('changed-singleton-historical-source-archive-tampered');

// Cross-source legacy identity is never inferred from primary bytes alone.
for(const relation of ['UNCHANGED_ATOMIC','MERGED_EQUIVALENT']){
 const cw=copy(changedCrosswalk),rows=copy([changedAtom]),ds=copy(changedDecisions);delete ds.get('changed').scopeChange;cw[0].relation=relation;ds.get('changed').equivalenceReason='Synthetic equivalence claim cannot replace scoped review.';
 if(relation==='UNCHANGED_ATOMIC'){rows[0].normativeRequirementId=oldDutyId;cw[0].currentNormativeRequirementIds=[oldDutyId];ds.get('changed').currentNormativeRequirementIds=[oldDutyId];}
 assert.throws(()=>changedCheck(cw,rows,ds),/cross-source scope equivalence review required/);cases.push('unannotated-cross-source-'+relation+'-requires-scoped-equivalence');
}
const equivalentPrior={...changedPrior,requirements:[changedPrior.requirements[0]]},equivalentPriorRef={sha256:sha(JSON.stringify(equivalentPrior))};
for(const relation of ['UNCHANGED_ATOMIC','MERGED_EQUIVALENT']){
 const rows=copy([changedAtom]);if(relation==='UNCHANGED_ATOMIC')rows[0].normativeRequirementId=oldDutyId;
 const target=rows[0],equivalence={priorNormativeRequirementId:oldDutyId,currentNormativeRequirementId:target.normativeRequirementId,priorSpecificationSha256:oldSha,currentSpecificationSha256:changedSha,priorStatement:target.atomicObligation.statement,currentStatement:target.atomicObligation.statement,currentAtomicObligationSha256:target.atomicObligation.sha256,priorContextSourceLocations:[],currentContextSourceLocations:[],reason:'Synthetic reviewed unchanged scope with unrelated removed source text.'};
 const d={decisionId:'equivalent',currentNormativeRequirementIds:[target.normativeRequirementId],priorWasSingleObligation:true,equivalenceReason:'Synthetic scoped equivalence reviewed.',scopeEquivalences:[equivalence]},cw=[{...changedCrosswalk[0],priorManifestSha256:equivalentPriorRef.sha256,relation,currentNormativeRequirementIds:[target.normativeRequirementId],reconciliationDecisionId:d.decisionId}];
 validateAtomicIdentityCrosswalk(cw,equivalentPrior,equivalentPriorRef,rows,new Map([[d.decisionId,d]]),changedSource,null,oldSource);cases.push('genuine-scoped-cross-source-'+relation+'-positive');
 const forgedPrior=copy(equivalentPrior);forgedPrior.requirements[0].sourceLocation.startLine=99;forgedPrior.requirements[0].sourceLocation.endLine=99;const forgedCw=copy(cw);forgedCw[0].priorSourceLocation=forgedPrior.requirements[0].sourceLocation;
 assert.throws(()=>validateAtomicIdentityCrosswalk(forgedCw,forgedPrior,equivalentPriorRef,rows,new Map([[d.decisionId,d]]),changedSource,new Map([[oldDutyId,{targetSourceLine:1}]]),oldSource),/exact historical source/);cases.push('forged-historical-primary-'+relation+'-rejected');
}
const annotatedPrior=copy(changedPrior);annotatedPrior.requirements[0].clarificationSourceLocations=[{path:SPECIFICATION_PATH,startLine:2,endLine:2,textSha256:sha(oldContext.controllingText+'\n')}];
const annotatedRef={sha256:sha(JSON.stringify(annotatedPrior))},annotatedCw=copy(changedCrosswalk);for(const row of annotatedCw)row.priorManifestSha256=annotatedRef.sha256;
for(const relation of ['UNCHANGED_ATOMIC','MERGED_EQUIVALENT']){const cw=copy(annotatedCw),rows=copy([changedAtom]),ds=copy(changedDecisions);delete ds.get('changed').scopeChange;cw[0].relation=relation;ds.get('changed').equivalenceReason='Counterfeit';if(relation==='UNCHANGED_ATOMIC'){rows[0].normativeRequirementId=oldDutyId;cw[0].currentNormativeRequirementIds=[oldDutyId];ds.get('changed').currentNormativeRequirementIds=[oldDutyId];}assert.throws(()=>validateAtomicIdentityCrosswalk(cw,annotatedPrior,annotatedRef,rows,ds,changedSource,null,oldSource),/lost predecessor context/);cases.push('recorded-context-'+relation+'-cannot-be-erased');}

// Two explicitly reviewed duplicate historical predicates may both change
// into one fresh atom; neither ancestor becomes an extra proof denominator row.
const duplicatePrior=copy(changedPrior),duplicateOldId='NREQ-'+'c'.repeat(32);duplicatePrior.requirements.push({...copy(duplicatePrior.requirements[0]),normativeRequirementId:duplicateOldId});const duplicateRef={sha256:sha(JSON.stringify(duplicatePrior))},duplicateCw=copy(changedCrosswalk),duplicateDecisions=copy(changedDecisions);
for(const row of duplicateCw)row.priorManifestSha256=duplicateRef.sha256;
const secondDecision=copy(duplicateDecisions.get('changed'));secondDecision.decisionId='changed-duplicate';secondDecision.scopeChange.priorNormativeRequirementId=duplicateOldId;duplicateDecisions.set(secondDecision.decisionId,secondDecision);duplicateCw.push({...copy(duplicateCw[0]),priorNormativeRequirementId:duplicateOldId,reconciliationDecisionId:secondDecision.decisionId});
const duplicateGroup={groupId:'synthetic-changed-duplicate-group',priorEquivalenceReason:'Synthetic explicit review establishes equivalent old predicates before applying their same withdrawn-context change.',currentNormativeRequirementId:changedId,priorNormativeRequirementIds:[oldDutyId,duplicateOldId].sort(),scopeChangeSha256ByPriorId:{[oldDutyId]:hash(duplicateDecisions.get('changed').scopeChange),[duplicateOldId]:hash(secondDecision.scopeChange)}};
for(const id of ['changed','changed-duplicate'])duplicateDecisions.get(id).changedDuplicateGroup=copy(duplicateGroup);
const duplicateCheck=(cw=duplicateCw,ds=duplicateDecisions)=>validateAtomicIdentityCrosswalk(cw,duplicatePrior,duplicateRef,[changedAtom],ds,changedSource,null,oldSource);
duplicateCheck();cases.push('explicit-changed-duplicate-convergence-positive');
for(const [name,edit] of [
 ['changed-duplicate-group-missing',ds=>{for(const id of ['changed','changed-duplicate'])delete ds.get(id).changedDuplicateGroup;}],
 ['changed-duplicate-one-group-missing',ds=>delete ds.get('changed-duplicate').changedDuplicateGroup],
 ['changed-duplicate-group-member-omitted',ds=>{for(const id of ['changed','changed-duplicate'])ds.get(id).changedDuplicateGroup.priorNormativeRequirementIds.pop();}],
 ['changed-duplicate-group-stale-scope',ds=>{for(const id of ['changed','changed-duplicate'])ds.get(id).changedDuplicateGroup.scopeChangeSha256ByPriorId[oldDutyId]='0'.repeat(64);}],
 ['changed-duplicate-unreviewed-equivalence',ds=>{for(const id of ['changed','changed-duplicate'])ds.get(id).changedDuplicateGroup.priorEquivalenceReason='';}]
]){const ds=copy(duplicateDecisions);edit(ds);assert.throws(()=>duplicateCheck(duplicateCw,ds),/double counted|group incomplete or stale/,name);duplicateCheck();cases.push(name);}

const sharedChangedCw=copy(duplicateCw),sharedChangedDs=copy(duplicateDecisions),sharedChanged=sharedChangedDs.get('changed');sharedChanged.scopeChanges=[sharedChanged.scopeChange,sharedChangedDs.get('changed-duplicate').scopeChange];delete sharedChanged.scopeChange;sharedChangedDs.delete('changed-duplicate');sharedChangedCw.find(row=>row.priorNormativeRequirementId===duplicateOldId).reconciliationDecisionId='changed';duplicateCheck(sharedChangedCw,sharedChangedDs);cases.push('changed-duplicates-one-distinct-decision-per-predecessor-scopes');
for(const [name,mutate,pattern] of [
 ['changed-shared-decision-missing-one-scope',d=>d.get('changed').scopeChanges.pop(),/scope review incomplete/],
 ['changed-shared-decision-duplicate-old-scope',d=>d.get('changed').scopeChanges.push(copy(d.get('changed').scopeChanges[0])),/duplicated or ambiguous/],
 ['changed-shared-decision-singular-array-ambiguous',d=>d.get('changed').scopeChange=copy(d.get('changed').scopeChanges[0]),/duplicated or ambiguous/]
]){const d=copy(sharedChangedDs);mutate(d);assert.throws(()=>duplicateCheck(sharedChangedCw,d),pattern);cases.push(name);}

const pluralChangedDs=copy(sharedChangedDs);pluralChangedDs.get('changed').changedDuplicateGroups=[pluralChangedDs.get('changed').changedDuplicateGroup];delete pluralChangedDs.get('changed').changedDuplicateGroup;duplicateCheck(sharedChangedCw,pluralChangedDs);cases.push('changed-duplicates-per-target-group-array');
for(const [name,mutate] of [
 ['changed-group-array-duplicate-target',d=>d.get('changed').changedDuplicateGroups.push(copy(d.get('changed').changedDuplicateGroups[0]))],
 ['changed-group-array-unrelated-target',d=>d.get('changed').changedDuplicateGroups[0].currentNormativeRequirementId='NREQ-'+'f'.repeat(32)],
 ['changed-group-array-singular-ambiguous',d=>d.get('changed').changedDuplicateGroup=copy(d.get('changed').changedDuplicateGroups[0])]
]){const d=copy(pluralChangedDs);mutate(d);assert.throws(()=>duplicateCheck(sharedChangedCw,d),/groups duplicated, unrelated or ambiguous/);cases.push(name);}

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atomic-proof-fixture-')),cwd=process.cwd(),reviewPath='verification/synthetic-atomic-proof.json',suite='verify-test-runtime-v3.mjs',checkId='test-ir.unknown-operation';
try{
 fs.mkdirSync(path.join(directory,'specification'));fs.mkdirSync(path.join(directory,'verification'));fs.writeFileSync(path.join(directory,SPECIFICATION_PATH),source);
 const fingerprint={specificationSha256,inputSha256:{[SPECIFICATION_PATH]:specificationSha256}};
 const inputs=[suite,'verification-evidence-catalog.mjs',...(verificationCatalog[suite].sourceInputs||[]),'test-runtime.js'];for(const file of new Set(inputs))fingerprint.inputSha256[file]=sha(fs.readFileSync(path.join(root,file)));
 const observations=new Map([[checkId,{checkId,suite,passed:true,evidenceBasis:'EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS',receiptSha256:'3'.repeat(64)}]]);
 const bindingFor=row=>({normativeRequirementId:row.normativeRequirementId,sourceLineSha256:row.sourceLocation.lineSha256,atomicObligationSha256:row.atomicObligation.sha256,checkIds:[checkId],fullCoverage:{schema:'closed-loop-full-requirement-coverage/1',sourceLineSha256:row.sourceLocation.lineSha256,atomicObligationSha256:row.atomicObligation.sha256,reviewedAtomicStatement:row.atomicObligation.statement,contextSourceLocations:row.atomicObligation.contextSourceLocations,sourceSpans:row.atomicObligation.sourceSpans,schemaOrRegistryEntry:row.schemaOrRegistryEntry,productionOwners:[{path:'test-runtime.js',symbol:'validateSpec',sha256:fingerprint.inputSha256['test-runtime.js']}],obligations:[{id:'synthetic-atomic-case',sourceText:row.atomicObligation.sourceSpans[0].text,expectedBehavior:row.atomicObligation.statement,checks:{deterministic:[{suite,checkId}],semantic:[],mutation:[]},nonapplicable:{semantic:'Synthetic format test only.',mutation:'Synthetic format test only.'},evidenceKinds:['EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS']}],unresolvedObligations:[]}});
 const bindReview=(row,binding,mutate=()=>{})=>{const coverage=binding.fullCoverage,record={schema:'closed-loop-requirement-coverage-review/1',normativeRequirementId:row.normativeRequirementId,sourceLineSha256:row.sourceLocation.lineSha256,specificationSha256,declarationSha256:coverageDeclarationSha256(coverage),atomicObligationSha256:row.atomicObligation.sha256,reviewedAtomicStatement:row.atomicObligation.statement,contextSourceLocations:row.atomicObligation.contextSourceLocations,decision:'COMPLETE_COVERAGE',evidenceBasis:'EXTERNALLY_SUPPORTED',method:'SYNTHETIC proof consumer gate input only.',author:{actor:'SYNTHETIC-AUTHOR',contextId:'SYNTHETIC-AUTHOR'},reviewer:{actor:'SYNTHETIC-REVIEWER',contextId:'SYNTHETIC-REVIEWER'},reviewedInputs:[...Object.entries(fingerprint.inputSha256).filter(([file])=>file!==reviewPath).map(([path,sha256])=>({path,sha256})),{declarationSha256:coverageDeclarationSha256(coverage)}],findings:[],reviewPerformed:true,syntheticFixture:true};mutate(record);fs.writeFileSync(reviewPath,JSON.stringify(record));fingerprint.inputSha256[reviewPath]=sha(fs.readFileSync(reviewPath));coverage.review={path:reviewPath,sha256:fingerprint.inputSha256[reviewPath]};};
 process.chdir(directory);const row=atoms[0],binding=bindingFor(row);bindReview(row,binding);assert.equal(evaluateFullRequirementProof(row,[binding],observations,fingerprint).disposition,'CONFORMANT_PROVEN');cases.push('synthetic-current-atomic-proof-positive');
 const rejectProof=(name,change,reason)=>{const r=copy(row),b=copy(binding);change(r,b);bindReview(r,b);const actual=evaluateFullRequirementProof(r,[b],observations,fingerprint);assert.equal(actual.disposition,'UNKNOWN',name);assert(actual.reasons.includes(reason),`${name}: ${actual.reasons}`);bindReview(row,binding);assert.equal(evaluateFullRequirementProof(row,[binding],observations,fingerprint).disposition,'CONFORMANT_PROVEN');cases.push(name);};
 rejectProof('atomic-proof-arbitrary-substring',(_,b)=>b.fullCoverage.obligations[0].sourceText='MUST','INCOMPLETE_SOURCE_OBLIGATION_DECOMPOSITION');
 rejectProof('atomic-proof-duplicate-source-coverage',(_,b)=>{const duplicate=copy(b.fullCoverage.obligations[0]);duplicate.id='duplicate-source';b.fullCoverage.obligations.push(duplicate);},'INCOMPLETE_SOURCE_OBLIGATION_DECOMPOSITION');
 const multiRow=copy(row),whole=multiRow.atomicObligation.sourceSpans[0],split=Buffer.byteLength('The worker ');
 multiRow.atomicObligation.sourceSpans=[{startByte:whole.startByte,endByte:whole.startByte+split,text:'The worker ',sha256:sha('The worker ')},{startByte:whole.startByte+split,endByte:whole.endByte,text:'MUST preserve α',sha256:sha('MUST preserve α')}];multiRow.atomicObligation.sha256=atomicObligationSha256(multiRow.atomicObligation);
 const multiBinding=bindingFor(multiRow),one=copy(multiBinding.fullCoverage.obligations[0]);multiBinding.fullCoverage.obligations=[{...one,id:'first-span',sourceText:'The worker '},{...one,id:'second-span-a',sourceText:'MUST '},{...one,id:'second-span-b',sourceText:'preserve α'}];
 bindReview(multiRow,multiBinding);assert.equal(evaluateFullRequirementProof(multiRow,[multiBinding],observations,fingerprint).disposition,'CONFORMANT_PROVEN');cases.push('atomic-proof-complete-multiple-span-decomposition');
 const omitted=copy(multiBinding);omitted.fullCoverage.obligations.pop();bindReview(multiRow,omitted);assert(evaluateFullRequirementProof(multiRow,[omitted],observations,fingerprint).reasons.includes('INCOMPLETE_SOURCE_OBLIGATION_DECOMPOSITION'));cases.push('atomic-proof-omitted-source-span');
 const repeated=copy(multiBinding);repeated.fullCoverage.obligations[2].sourceText='MUST ';bindReview(multiRow,repeated);assert(evaluateFullRequirementProof(multiRow,[repeated],observations,fingerprint).reasons.includes('INCOMPLETE_SOURCE_OBLIGATION_DECOMPOSITION'));cases.push('atomic-proof-repeated-source-span');
 bindReview(row,binding);
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
// Disagreement is retained verbatim and resolved by a third pinned source pass.
{
 const d=copy(draft),r=copy(review);d.propositions[0].classification='NORMATIVE_PROPOSITION';
 assert.throws(()=>run(d,r),/context lacks current independent classification/);cases.push('context-disagreement-before-distinct-resolution');
 const author={actorId:'SYNTHETIC-CONTEXT-AUTHOR',contextId:'SYNTHETIC-CONTEXT-AUTHOR-PASS',role:'DRAFT_CONTEXT',specificationSha256,inputs:[sourceInput],classifications:[{line:3,sourceLineSha256:context.lineSha256,rawLine:lines[2],classification:'NORMATIVE_PROPOSITION',reason:'Synthetic original author predicate interpretation.',contextSourceLocations:[]}]};
 const blind={actorId:'SYNTHETIC-CONTEXT-BLIND',contextId:'SYNTHETIC-CONTEXT-BLIND-PASS',role:'INDEPENDENT_CONTEXT_REVIEW',specificationSha256,inputs:[sourceInput],draftManifestReceived:false,implementationRead:false,classifications:[{line:3,sourceLineSha256:context.lineSha256,rawSourceText:lines[2],classification:'STRUCTURAL_REQUIREMENT_CONTEXT',reason:'Synthetic original blind governing condition interpretation.',contextSourceLocations:[],governingSourceRanges:[[4,4]]}]};
 const resolved={schema:'closed-loop-source-context-reconciliation/1',actorId:'SYNTHETIC-DISTINCT-CONTEXT-RECONCILER',contextId:'SYNTHETIC-DISTINCT-CONTEXT-RECONCILER-PASS',role:'DISTINCT_SOURCE_ONLY_RECONCILIATION',specificationSha256,method:{sourceOnly:true,implementationInspected:false,originalInputsModified:false},unresolvedDisagreements:[],mappings:[{line:3,sourceLineSha256:context.lineSha256,rawSourceText:lines[2],authorClassification:'NORMATIVE_PROPOSITION',reviewClassification:'STRUCTURAL_REQUIREMENT_CONTEXT',resolvedClassification:'STRUCTURAL_REQUIREMENT_CONTEXT',reason:'Synthetic distinct source reconciliation preserves the condition in both child duties.',governingSourceRanges:[[4,4]],additionalSupportingSourceRanges:[],originalAuthorGoverningSourceRanges:[],originalReviewGoverningSourceRanges:[[4,4]],originalAuthorContextSourceLocations:[],originalReviewContextSourceLocations:[],resolutionMode:'SOURCE_CLASSIFICATION_RECONCILIATION',unresolved:false,normativeForcePreserved:true,exactSourceAnchors:[{startLine:3,endLine:4,exactText:lines.slice(2,4).join('\n'),sha256Utf8WithoutTrailingLf:sha(lines.slice(2,4).join('\n'))}]}]};
 const fixture=(mutate=()=>{})=>{
  const e=evidence(d,r),a=copy(author),b=copy(blind),z=copy(resolved),c=JSON.parse(e.files.get(e.descriptor.reconciliation.path));mutate({a,b,z,c});
  const pin=(name,value)=>{const bytes=Buffer.from(JSON.stringify(value)),path='verification/'+name+'.json';e.files.set(path,bytes);return {path,sha256:sha(bytes)};};
  const ar=pin('synthetic-context-author',a),br=pin('synthetic-context-blind',b);z.inputs=[sourceInput,ar,br];const zr=pin('synthetic-context-resolution',z);c.contextReconciliation={...zr,author:ar,independentReview:br};c.inputs.push(zr);e.descriptor.reconciliation={...e.descriptor.reconciliation,...pin('synthetic-reconciliation',c)};return e;
 };
 const invoke=e=>loadReviewedAtomicExtraction(e.descriptor,e.options);
 assert.equal(invoke(fixture()).established,true);cases.push('context-disagreement-distinct-source-resolution');
 for(const [name,mutate,pattern] of [
  ['context-resolution-unresolved',({z})=>z.mappings[0].unresolved=true,/source or decision invalid/],
  ['context-resolution-unresolved-list',({z})=>z.unresolvedDisagreements.push('Synthetic unresolved'),/disagreement unresolved/],
  ['context-resolution-self-reconciled',({a,z})=>z.contextId=a.contextId,/independence missing/],
  ['context-resolution-original-rewritten',({z})=>z.mappings[0].authorClassification='STRUCTURAL_REQUIREMENT_CONTEXT',/original context decision changed/],
  ['context-resolution-wrong-governing-range',({z})=>z.mappings[0].governingSourceRanges=[[3,4]],/current context differs/],
  ['context-resolution-stale-anchor',({z})=>z.mappings[0].exactSourceAnchors[0].sha256Utf8WithoutTrailingLf='0'.repeat(64),/anchor bytes mismatch/],
  ['context-resolution-missing-original-member',({a})=>a.classifications=[],/original context decision changed/],
 ]){assert.throws(()=>invoke(fixture(mutate)),pattern);cases.push(name);}
 const missing=fixture();missing.files.delete('verification/synthetic-context-author.json');assert.throws(()=>invoke(missing));cases.push('context-resolution-unpinned-original');
 const stale=fixture();stale.files.set('verification/synthetic-context-resolution.json',Buffer.from('{}'));assert.throws(()=>invoke(stale),/digest mismatch/);cases.push('context-resolution-stale-input-hash');
 const deps=atomicEvidenceReferences(fixture().descriptor,fixture().options.readFile);assert(deps.some(ref=>ref.path==='verification/synthetic-context-author.json')&&deps.some(ref=>ref.path==='verification/synthetic-context-blind.json'));cases.push('context-resolution-fingerprint-dependencies');
}

// Multiple real contributor contexts are represented by a set, never an alias
// purporting to be one new author. These authored passes are entirely synthetic.
{
 const fixture=(mutate=()=>{})=>{
  const d=copy(draft),r=copy(review),c=copy(reconciliation),files=new Map();
  const pin=(name,value)=>{const bytes=Buffer.from(JSON.stringify(value)),path='verification/'+name+'.json';files.set(path,bytes);return {path,sha256:sha(bytes)};};
  const originals=[];
  for(const [record,label] of [[d,'DRAFT'],[r,'REVIEW']]){
   const constituents=[];
   for(let i=0;i<2;i++){
    const original={schema:'closed-loop-atomic-extraction-evidence/1',role:record.role,actorId:`SYNTHETIC-${label}-CONTRIBUTOR-${i}`,contextId:`SYNTHETIC-${label}-ACTUAL-CONTEXT-${i}`,specificationSha256,inputs:[sourceInput],...(label==='REVIEW'?{draftManifestReceived:false}:{}),propositions:copy(i?record.propositions.slice(1):record.propositions.slice(0,1))};
    const name=`synthetic-${label.toLowerCase()}-constituent-${i}`,ref=pin(name,original),member={...ref,role:record.role,actorId:original.actorId,contextId:original.contextId,actorIdentityPointer:'/actorId',contextIdentityPointer:'/contextId',sourceIdentityPointer:'/specificationSha256',declaredInputsPointer:'/inputs',declaredInputs:copy(original.inputs),memberCollectionPointer:'/propositions',members:original.propositions.map((p,j)=>({originalPointer:'/propositions/'+j,normalizedPropositionId:p.propositionId,statementPointer:'/statement',primarySourceLinePointer:'/primarySourceLine'}))};
    originals.push({original,member,name});constituents.push(member);
   }
   record.mechanicalProjection={schema:'closed-loop-evidence-projection/1',semanticContribution:false,adapter:{actorId:c.actorId,contextId:c.contextId},constituents,normalizations:[]};
  }
  mutate({d,r,c,originals,files});
  for(const {original,member,name} of originals)Object.assign(member,pin(name,original));
  for(const record of [d,r])Object.assign(record,atomicContributorIdentity(record.role,record.mechanicalProjection.constituents));
  const e=evidence(d,r,c);for(const [p,b] of files)e.files.set(p,b);return e;
 };
 const invoke=e=>loadReviewedAtomicExtraction(e.descriptor,e.options);
 assert.equal(invoke(fixture()).established,true);cases.push('multi-contributor-disjoint-real-contexts');
 for(const [name,mutate,pattern] of [
  ['multi-contributor-cross-role-hidden-context',({originals})=>{originals[2].original.contextId=originals[0].original.contextId;originals[2].member.contextId=originals[0].member.contextId;},/actual contributor roles are not independent/],
  ['multi-contributor-reconciler-reuses-draft-context',({originals,c})=>{originals[0].original.contextId=c.contextId;originals[0].member.contextId=c.contextId;},/adapter counted/],
  ['multi-contributor-pointer-alias',({originals})=>{const {original,member}=originals[0];original.alias='FAKE-CONTEXT';member.contextId='FAKE-CONTEXT';member.contextIdentityPointer='/alias';},/pointer aliases actual/],
  ['multi-contributor-missing-member',({originals})=>originals[1].member.members.pop(),/source membership incomplete/],
  ['multi-contributor-duplicate-member',({originals})=>originals[1].member.members[1]=copy(originals[1].member.members[0]),/member missing or duplicated/],
  ['multi-contributor-missing-constituent',({d})=>d.mechanicalProjection.constituents.pop(),/lacks frozen constituent/],
  ['multi-contributor-duplicate-constituent',({d})=>d.mechanicalProjection.constituents.push(copy(d.mechanicalProjection.constituents[0])),/role invalid or duplicated/],
  ['multi-contributor-wrong-frozen-role',({originals})=>originals[0].original.role='INDEPENDENT_REVIEW',/frozen constituent role mismatch/],
  ['multi-contributor-wrong-declared-role',({originals})=>originals[0].member.role='INDEPENDENT_REVIEW',/constituent role invalid/],
  ['multi-contributor-blind-received-draft',({originals})=>originals[2].original.draftManifestReceived=true,/blind isolation false/],
  ['multi-contributor-stale-source',({originals})=>originals[0].original.specificationSha256='0'.repeat(64),/identity\/source\/actual inputs mismatch/],
  ['multi-contributor-hidden-actual-inputs',({originals})=>originals[0].original.inputs.push({path:'verification/other.json',sha256:'0'.repeat(64)}),/identity\/source\/actual inputs mismatch/],
  ['multi-contributor-invented-original-classification',({d})=>d.propositions[1].classification='HISTORICAL_NONNORMATIVE_CONTEXT',/original classification changed/],
  ['multi-contributor-rewritten-statement',({d})=>d.propositions[1].statement='Synthetic weakened normalized statement',/projected proposition changed/],
  ['multi-contributor-dropped-qualifier',({d})=>d.propositions[1].contextSourceLocations=[],/qualifier\/context membership changed/],
  ['multi-contributor-new-semantic-contribution',({d})=>d.mechanicalProjection.semanticContribution=true,/adapter or semantic contribution invalid/],
 ]){assert.throws(()=>invoke(fixture(mutate)),pattern);cases.push(name);}
 const stripped=fixture(),strippedDraft=JSON.parse(stripped.files.get(stripped.descriptor.draft.path));delete strippedDraft.mechanicalProjection;const strippedBytes=Buffer.from(JSON.stringify(strippedDraft));stripped.files.set(stripped.descriptor.draft.path,strippedBytes);stripped.descriptor.draft.sha256=sha(strippedBytes);assert.throws(()=>invoke(stripped),/aggregate identity lacks constituent projection/);cases.push('multi-contributor-stripped-projection-reserved-alias');
 assert.throws(()=>invoke(fixture(({originals})=>originals[0].original.mechanicalProjection={schema:'closed-loop-evidence-projection/1',constituents:[]})),/nested projection/);cases.push('multi-contributor-nested-projection-rejected');
 const missing=fixture();missing.files.delete('verification/synthetic-draft-constituent-0.json');assert.throws(()=>invoke(missing));cases.push('multi-contributor-missing-file');
 const tampered=fixture();tampered.files.set('verification/synthetic-review-constituent-0.json',Buffer.from('{}'));assert.throws(()=>invoke(tampered),/digest mismatch/);assert.throws(()=>atomicEvidenceReferences(tampered.descriptor,tampered.options.readFile),/dependency digest mismatch/);cases.push('multi-contributor-tampered-file-and-receipt');
 const withAttestation=(alter=()=>{})=>fixture(({originals,files})=>{
  const item=originals[2],old=copy(item.original),actor='/root/synthetic-original-blind';
  for(const key of Object.keys(item.original))delete item.original[key];
  Object.assign(item.original,{artifact_kind:'independent-source-only-candidate-review',source:{sha256:specificationSha256},candidates:old.propositions.map(p=>({proposition:p.statement,source_lines:[p.primarySourceLine,p.primarySourceLine],supporting_context_lines:p.contextSourceLocations.map(c=>[c.startLine,c.startLine]),...(p.classification?{classification:p.classification}:{})}))});
  const attestation={attestation_kind:'original_reviewer_provenance_attestation',attestor:{actual_canonical_task_name:actor},normative_source_input:{sha256:specificationSha256},frozen_review_artifact:{sha256:sha(JSON.stringify(item.original))},other_original_file_inputs:[{path:'SYNTHETIC own prior helper',historical_hash:null}],limitations:['SYNTHETIC actual unknown historical hash remains unknown.']};alter(attestation);
  const bytes=Buffer.from(JSON.stringify(attestation)),path='verification/synthetic-original-blind-attestation.json';files.set(path,bytes);
  Object.assign(item.member,{actorId:actor,contextId:actor,memberCollectionPointer:'/candidates',declaredInputs:copy(attestation),identityEvidence:{path,sha256:sha(bytes),actorIdentityPointer:'/attestor/actual_canonical_task_name',contextIdentityPointer:'/attestor/actual_canonical_task_name',sourceIdentityPointer:'/normative_source_input/sha256',artifactSha256Pointer:'/frozen_review_artifact/sha256',declaredInputsPointer:''},members:old.propositions.map((p,i)=>({originalPointer:'/candidates/'+i,normalizedPropositionId:p.propositionId,statementPointer:'/proposition',primarySourceLinePointer:'/source_lines/0'}))});
 });
 assert.equal(invoke(withAttestation()).established,true);cases.push('multi-contributor-genuine-identity-attestation-disclosures');
 assert.throws(()=>invoke(withAttestation(a=>a.frozen_review_artifact.sha256='0'.repeat(64))),/provenance does not bind/);cases.push('multi-contributor-attestation-wrong-frozen-artifact');
 const attested=withAttestation();assert(atomicEvidenceReferences(attested.descriptor,attested.options.readFile).some(r=>r.path==='verification/synthetic-original-blind-attestation.json'));cases.push('multi-contributor-attestation-fingerprint');
 attested.files.set('verification/synthetic-original-blind-attestation.json',Buffer.from('{}'));assert.throws(()=>invoke(attested),/digest mismatch/);cases.push('multi-contributor-tampered-attestation');
 const valid=fixture(),deps=atomicEvidenceReferences(valid.descriptor,valid.options.readFile);assert.equal(deps.filter(ref=>ref.path.includes('-constituent-')).length,4);cases.push('multi-contributor-fingerprint-all-constituents');
}

// Synthetic mixed split/merge and closed-contract components preserve actual
// containment relationships without pretending a component is the whole duty.
{
 const bytes=Buffer.from('Worker MUST preserve alpha; worker MUST reject beta.\nWorker MUST reject beta.\n'),text=bytes.toString().split('\n'),sourceHash=sha(bytes),loc=n=>({path:SPECIFICATION_PATH,startLine:n,endLine:n,lineSha256:sha(text[n-1])}),ctx={...loc(1),controllingText:text[0]},ids=['NREQ-'+'a'.repeat(32),'NREQ-'+'b'.repeat(32)];
 const span=value=>{const startByte=bytes.indexOf(value);return {startByte,endByte:startByte+Buffer.byteLength(value),text:value,sha256:sha(value)};};
 const make=(key,statement,line,value,contexts=[])=>{const scope={key,statement,sourceSpans:[span(value)],contextSourceLocations:contexts};scope.sha256=atomicObligationSha256(scope);const birthIdentity={sourceSha256:sourceHash,sourceAnchor:{line,lineSha256:loc(line).lineSha256},atomicKey:key};return {normativeRequirementId:'NREQ-'+hash(birthIdentity).slice(0,32),entryKind:'ATOMIC_OBLIGATION',sourceLocation:loc(line),controllingText:text[line-1],atomicObligation:scope,birthIdentity};};
 const rows=[make('synthetic.alpha','Worker MUST preserve alpha.',1,'Worker MUST preserve alpha'),make('synthetic.beta','Worker MUST reject beta.',2,'Worker MUST reject beta.',[ctx])],p={specificationSha256:sourceHash,requirements:ids.map((id,i)=>({normativeRequirementId:id,sourceLocation:loc(i+1),controllingText:text[i]}))},ref={sha256:sha(JSON.stringify(p))};
 const component=(target,value)=>({currentNormativeRequirementId:target.normativeRequirementId,currentAtomicObligationSha256:target.atomicObligation.sha256,priorStatement:target.atomicObligation.statement,sourceSpans:[span(value)],priorContextSourceLocations:[],currentContextSourceLocations:target.atomicObligation.contextSourceLocations,relationship:'EQUIVALENT_COMPONENT',equivalenceReason:'Synthetic exact predicate equivalence, with source owner retained.'});
 const parts=[{priorNormativeRequirementId:ids[0],priorSpecificationSha256:sourceHash,currentSpecificationSha256:sourceHash,priorSourceLocation:loc(1),complete:true,reason:'Synthetic independently reviewed complete conjunction partition.',components:[component(rows[0],'Worker MUST preserve alpha'),component(rows[1],'worker MUST reject beta.')]},{priorNormativeRequirementId:ids[1],priorSpecificationSha256:sourceHash,currentSpecificationSha256:sourceHash,priorSourceLocation:loc(2),complete:true,reason:'Synthetic complete singleton component.',components:[component(rows[1],'Worker MUST reject beta.')]}];
 const group={kind:'EQUIVALENT_COMPONENTS',groupId:'synthetic-beta-convergence',currentNormativeRequirementId:rows[1].normativeRequirementId,currentAtomicObligationSha256:rows[1].atomicObligation.sha256,priorNormativeRequirementIds:[...ids].sort(),componentSha256ByPriorId:Object.fromEntries(parts.map(part=>[part.priorNormativeRequirementId,hash(part.components.at(-1))])),complete:true,reason:'Synthetic equivalent beta component occurs alone and in conjunction.'};
 const ds=new Map(parts.map((part,i)=>['component-'+i,{decisionId:'component-'+i,currentNormativeRequirementIds:part.components.map(c=>c.currentNormativeRequirementId),equivalenceReason:'Synthetic reviewed equivalent singleton.',componentPartitions:[part],componentConvergenceGroups:[copy(group)]}]));
 const cw=ids.map((id,i)=>({priorManifestSha256:ref.sha256,priorSpecificationSha256:sourceHash,priorNormativeRequirementId:id,priorSourceLocation:loc(i+1),relation:i?'MERGED_EQUIVALENT':'SPLIT_COMPOUND',currentNormativeRequirementIds:ds.get('component-'+i).currentNormativeRequirementIds,reason:'Synthetic reviewed historical component relation.',reconciliationDecisionId:'component-'+i}));
 const check=(cross=cw,targets=rows,dec=ds,oldBytes=bytes)=>validateAtomicIdentityCrosswalk(cross,p,ref,targets,dec,bytes,null,oldBytes);
 assert.throws(()=>oldCrosswalk(cw,p,ref,rows,ds,bytes),/target double counted/);check();cases.push('mixed-split-component-convergence-before-after');
 const synchronize=dec=>{const g=copy(dec.get('component-0').componentConvergenceGroups[0]);g.componentSha256ByPriorId=Object.fromEntries([...dec.values()].map(d=>{const part=d.componentPartitions[0];return [part.priorNormativeRequirementId,hash(part.components.find(c=>c.currentNormativeRequirementId===g.currentNormativeRequirementId))];}));for(const d of dec.values())d.componentConvergenceGroups=[copy(g)];};
 for(const [name,edit,pattern] of [
  ['component-convergence-orphan-group',(c,r,d)=>d.get('component-0').componentConvergenceGroups.push({...copy(group),currentNormativeRequirementId:'NREQ-'+'f'.repeat(32)}),/no actual decision edge/],
  ['component-convergence-orphan-partition',(c,r,d)=>d.get('component-0').componentPartitions.push({...copy(parts[0]),priorNormativeRequirementId:'NREQ-'+'f'.repeat(32)}),/no actual convergence edge/],
  ['component-convergence-no-group',(c,r,d)=>{for(const v of d.values())delete v.componentConvergenceGroups;},/no actual convergence edge|target double counted/],
  ['component-convergence-one-sided-group',(c,r,d)=>delete d.get('component-1').componentConvergenceGroups,/no actual convergence edge|group incomplete/],
  ['component-convergence-missing-partition',(c,r,d)=>d.get('component-0').componentPartitions=[],/one reviewed partition/],
  ['component-convergence-missing-split-child',(c,r,d)=>d.get('component-0').componentPartitions[0].components.shift(),/target universe incomplete/],
  ['component-convergence-stale-old-span',(c,r,d)=>d.get('component-0').componentPartitions[0].components[1].sourceSpans[0].sha256='0'.repeat(64),/source bytes\/hash mismatch/],
  ['component-convergence-outside-old-primary',(c,r,d)=>d.get('component-0').componentPartitions[0].components[1].sourceSpans=[span('Worker MUST reject beta.')],/outside primary/],
  ['component-convergence-missing-reason',(c,r,d)=>d.get('component-0').componentPartitions[0].components[1].equivalenceReason='',/scope binding incomplete/],
  ['component-convergence-stale-target-scope',(c,r,d)=>d.get('component-0').componentPartitions[0].components[1].currentAtomicObligationSha256='0'.repeat(64),/scope binding incomplete/],
  ['component-convergence-stale-group-scope',(c,r,d)=>{for(const v of d.values())v.componentConvergenceGroups[0].currentAtomicObligationSha256='0'.repeat(64);},/group incomplete/],
  ['component-convergence-missing-incoming-member',(c,r,d)=>{for(const v of d.values())v.componentConvergenceGroups[0].priorNormativeRequirementIds.pop();},/group incomplete/],
  ['component-convergence-copied-proof',(c,r)=>r[1].fullCoverage={prior:ids[0]},/cannot inherit predecessor proof/],
  ['component-convergence-wrong-group-kind',(c,r,d)=>{for(const v of d.values())v.componentConvergenceGroups[0].kind='CONTRACT_COMPONENTS';},/group incomplete/],
 ]){const cross=copy(cw),targets=copy(rows),dec=copy(ds);edit(cross,targets,dec);assert.throws(()=>check(cross,targets,dec),pattern,name);cases.push(name);}
 const stale=copy(ds);stale.get('component-0').componentPartitions[0].components[1].priorStatement='Different reviewed component';assert.throws(()=>check(cw,rows,stale),/source\/scope binding mismatch/);cases.push('component-convergence-unbound-partition-change');
 // One historical label is contained in the complete contract. It is retired,
 // while the actual whole-contract predecessor may retain its reviewed ID.
 const contract=copy(rows[0]);contract.normativeRequirementId=ids[0];contract.atomicObligation.statement='Worker MUST preserve alpha and reject beta.';contract.atomicObligation.sourceSpans=[span(text[0])];contract.atomicObligation.contextSourceLocations=[{...loc(2),controllingText:text[1]}];contract.atomicObligation.sha256=atomicObligationSha256(contract.atomicObligation);
 const target=contract.normativeRequirementId,containedParts=parts.map((part,i)=>({...copy(part),components:[{...component(contract,text[i]),relationship:i?'CONTAINED_COMPONENT':'EQUIVALENT_COMPONENT',...(i?{containmentReason:'Synthetic beta predicate is one required component of the closed alpha-and-beta contract.'}:{}),priorStatement:i?'Worker MUST reject beta.':contract.atomicObligation.statement}]}));
 const containedGroup={kind:'CONTRACT_COMPONENTS',groupId:'synthetic-closed-contract',currentNormativeRequirementId:target,currentAtomicObligationSha256:contract.atomicObligation.sha256,priorNormativeRequirementIds:ids,componentSha256ByPriorId:Object.fromEntries(containedParts.map(part=>[part.priorNormativeRequirementId,hash(part.components[0])])),complete:true,reason:'Synthetic retained whole-contract identity with one retired contained predicate.'};
 const containedDs=new Map(containedParts.map((part,i)=>['component-'+i,{decisionId:'component-'+i,currentNormativeRequirementIds:[target],priorWasSingleObligation:true,containmentReason:'Synthetic explicit containment review.',componentPartitions:[part],componentConvergenceGroups:[copy(containedGroup)]}])),containedCw=cw.map((row,i)=>({...row,relation:i?'COMPONENT_OF_CONTRACT':'UNCHANGED_ATOMIC',currentNormativeRequirementIds:[target]}));
 check(containedCw,[contract],containedDs);cases.push('contained-component-retired-whole-contract-id-retained');
 for(const [name,edit,pattern] of [
  ['contained-component-orphan-group',(c,r,d)=>d.get('component-0').componentConvergenceGroups.push({...copy(containedGroup),currentNormativeRequirementId:'NREQ-'+'f'.repeat(32)}),/no actual decision edge/],
  ['contained-component-orphan-partition',(c,r,d)=>d.get('component-0').componentPartitions.push({...copy(containedParts[0]),priorNormativeRequirementId:'NREQ-'+'f'.repeat(32)}),/no actual convergence edge/],
  ['contained-component-no-reviewed-group',(c,r,d)=>delete d.get('component-1').componentConvergenceGroups,/retirement\/review incomplete/],
  ['contained-component-false-whole-equivalence',(c,r,d)=>d.get('component-1').componentPartitions[0].components[0].relationship='EQUIVALENT_COMPONENT',/scope binding incomplete/],
  ['contained-component-missing-containment-reason',(c,r,d)=>delete d.get('component-1').containmentReason,/retirement\/review incomplete/],
  ['contained-component-old-id-active',(c,r)=>r.push({...copy(rows[1]),normativeRequirementId:ids[1]}),/retirement\/review incomplete/],
  ['contained-component-copied-parent-proof',(c,r)=>r[0].executedEvidence=[{old:ids[1]}],/cannot inherit predecessor proof/],
 ]){const cross=copy(containedCw),targets=copy([contract]),dec=copy(containedDs);edit(cross,targets,dec);assert.throws(()=>check(cross,targets,dec),pattern,name);cases.push(name);}
}

// A shared condition is contained in two contracts without becoming two duties.
{
 const targets=copy(atoms),old=copy(prior),ref={sha256:sha(JSON.stringify(old))},conditionStart=source.indexOf(lines[2]),conditionSpan={startByte:conditionStart,endByte:conditionStart+Buffer.byteLength(lines[2]),text:lines[2],sha256:sha(lines[2])};
 const partitions=old.requirements.map(before=>({priorNormativeRequirementId:before.normativeRequirementId,priorSpecificationSha256:specificationSha256,currentSpecificationSha256:specificationSha256,priorSourceLocation:before.sourceLocation,complete:true,reason:'Synthetic complete shared-condition and distinct-predicate mapping.',components:targets.map(target=>({currentNormativeRequirementId:target.normativeRequirementId,currentAtomicObligationSha256:target.atomicObligation.sha256,priorStatement:before.normativeRequirementId===contextId?lines[2]:target.atomicObligation.statement,sourceSpans:before.normativeRequirementId===contextId?[conditionSpan]:target.atomicObligation.sourceSpans,priorContextSourceLocations:[],currentContextSourceLocations:target.atomicObligation.contextSourceLocations,relationship:before.normativeRequirementId===contextId?'CONTAINED_COMPONENT':'EQUIVALENT_COMPONENT',containmentReason:'The same condition qualifies each distinct predicate.',equivalenceReason:'Each original predicate is separately preserved.'}))}));
 const groups=targets.map(target=>({kind:'CONTRACT_COMPONENTS',groupId:'synthetic-shared-'+target.atomicObligation.key,currentNormativeRequirementId:target.normativeRequirementId,currentAtomicObligationSha256:target.atomicObligation.sha256,priorNormativeRequirementIds:old.requirements.map(r=>r.normativeRequirementId).sort(),componentSha256ByPriorId:Object.fromEntries(partitions.map(p=>[p.priorNormativeRequirementId,hash(p.components.find(c=>c.currentNormativeRequirementId===target.normativeRequirementId))])),complete:true,reason:'One source condition qualifies two distinct obligations, and is not independently duplicated.'}));
 const ds=new Map(partitions.map((partition,i)=>['shared-'+i,{decisionId:'shared-'+i,currentNormativeRequirementIds:targets.map(t=>t.normativeRequirementId),containmentReason:'Shared condition preserved in all governed contracts.',componentPartitions:[partition],componentConvergenceGroups:copy(groups)}])),cw=old.requirements.map((before,i)=>({priorManifestSha256:ref.sha256,priorSpecificationSha256:specificationSha256,priorNormativeRequirementId:before.normativeRequirementId,priorSourceLocation:before.sourceLocation,relation:i?'SPLIT_COMPOUND':'COMPONENT_OF_CONTRACT',currentNormativeRequirementIds:targets.map(t=>t.normativeRequirementId),reason:'Synthetic source relationship retained.',reconciliationDecisionId:'shared-'+i}));
 validateAtomicIdentityCrosswalk(cw,old,ref,targets,ds,source);cases.push('shared-component-qualifies-multiple-distinct-contracts');
 const missing=copy(ds);missing.get('shared-0').componentConvergenceGroups.pop();assert.throws(()=>validateAtomicIdentityCrosswalk(cw,old,ref,targets,missing,source),/retirement\/review incomplete/);cases.push('shared-component-missing-one-target-group');
 const dropped=copy(ds);dropped.get('shared-0').componentPartitions[0].components.pop();assert.throws(()=>validateAtomicIdentityCrosswalk(cw,old,ref,targets,dropped,source),/target universe incomplete/);cases.push('shared-component-incomplete-target-partition');
}

// Repeated identical text at different historical anchors remains two source
// occurrences. Scope changes account for each occurrence, not just its content.
{
 const repeatedSource=Buffer.concat([oldSource,Buffer.from(oldContext.controllingText+'\n')]),repeatedSha=sha(repeatedSource),second={...copy(oldContext),startLine:3,endLine:3},before={...copy(changedPrior.requirements[0]),clarificationSourceLocations:[{path:SPECIFICATION_PATH,startLine:2,endLine:3,textSha256:sha(oldContext.controllingText+'\n'+oldContext.controllingText+'\n')}]},p={...copy(changedPrior),specificationSha256:repeatedSha,requirements:[before]},ref={sha256:sha(JSON.stringify(p))},change={...copy(scopeChange),authority:{...copy(scopeChange.authority),priorSpecificationSha256:repeatedSha},priorContextSourceLocations:[copy(oldContext),second],contextChanges:[{kind:'REMOVED',priorContextSourceLocation:copy(oldContext),reason:'Synthetic first withdrawn occurrence.'},{kind:'REMOVED',priorContextSourceLocation:second,reason:'Synthetic second withdrawn occurrence.'}]},d={decisionId:'repeated-context',priorWasSingleObligation:true,currentNormativeRequirementIds:[changedId],scopeChange:change},cw=[{...copy(changedCrosswalk[0]),priorManifestSha256:ref.sha256,priorSpecificationSha256:repeatedSha,reconciliationDecisionId:d.decisionId}];
 const check=decision=>validateAtomicIdentityCrosswalk(cw,p,ref,[changedAtom],new Map([[decision.decisionId,decision]]),changedSource,null,repeatedSource);
 check(d);cases.push('changed-scope-identical-content-distinct-source-occurrences');
 const omitted=copy(d);omitted.scopeChange.priorContextSourceLocations.pop();assert.throws(()=>check(omitted),/omits recorded predecessor context/);cases.push('changed-scope-repeated-occurrence-not-deduplicated');
 const missingDelta=copy(d);missingDelta.scopeChange.contextChanges.pop();assert.throws(()=>check(missingDelta),/context difference unresolved/);cases.push('changed-scope-repeated-occurrence-delta-missing');
 const duplicated=copy(d);duplicated.scopeChange.priorContextSourceLocations.push(copy(oldContext));assert.throws(()=>check(duplicated),/historical context duplicated/);cases.push('changed-scope-duplicate-exact-anchor-rejected');
 const quotedSource=Buffer.concat([changedSource,Buffer.from('Unrelated synthetic historical quotation:\n'+oldContext.controllingText+'\n')]),quotedHash=sha(quotedSource),target=copy(changedAtom);target.birthIdentity.sourceSha256=quotedHash;target.normativeRequirementId='NREQ-'+hash(target.birthIdentity).slice(0,32);const quoted=copy(d);quoted.currentNormativeRequirementIds=[target.normativeRequirementId];Object.assign(quoted.scopeChange,{currentNormativeRequirementId:target.normativeRequirementId,authority:{...quoted.scopeChange.authority,currentSpecificationSha256:quotedHash}});const qcw=copy(cw);qcw[0].currentNormativeRequirementIds=[target.normativeRequirementId];
 const quoteCheck=decision=>validateAtomicIdentityCrosswalk(qcw,p,ref,[target],new Map([[decision.decisionId,decision]]),quotedSource,null,repeatedSource);
 assert.throws(()=>quoteCheck(quoted),/survives elsewhere without scoped occurrence review/);cases.push('changed-scope-identical-text-elsewhere-needs-occurrence-review');
 for(const delta of quoted.scopeChange.contextChanges)delta.occurrenceRemovalReason='Both exact old scoped occurrences are withdrawn; identical current text is in the unrelated synthetic historical quotation.';
 quoteCheck(quoted);cases.push('changed-scope-identical-unrelated-text-explicit-occurrence-review');
 const oneSource=Buffer.concat([changedSource,Buffer.from(oldContext.controllingText+'\n')]),oneHash=sha(oneSource),oneTarget=copy(changedAtom);oneTarget.atomicObligation.statement='Synthetic duty with one retained occurrence of the exception.';oneTarget.atomicObligation.contextSourceLocations=[copy(oldContext)];oneTarget.atomicObligation.sha256=atomicObligationSha256(oneTarget.atomicObligation);oneTarget.birthIdentity.sourceSha256=oneHash;oneTarget.normativeRequirementId='NREQ-'+hash(oneTarget.birthIdentity).slice(0,32);
 const one=copy(d);one.currentNormativeRequirementIds=[oneTarget.normativeRequirementId];Object.assign(one.scopeChange,{currentNormativeRequirementId:oneTarget.normativeRequirementId,currentStatement:oneTarget.atomicObligation.statement,currentAtomicObligationSha256:oneTarget.atomicObligation.sha256,currentContextSourceLocations:oneTarget.atomicObligation.contextSourceLocations,authority:{...one.scopeChange.authority,currentSpecificationSha256:oneHash},contextChanges:[{kind:'REMOVED',priorContextSourceLocation:second,reason:'Synthetic second old occurrence withdrawn.',occurrenceRemovalReason:'Only the first old scoped occurrence is retained at current line2.'}]});const ocw=copy(cw);ocw[0].currentNormativeRequirementIds=[oneTarget.normativeRequirementId];const oneCheck=decision=>validateAtomicIdentityCrosswalk(ocw,p,ref,[oneTarget],new Map([[decision.decisionId,decision]]),oneSource,null,repeatedSource);
 oneCheck(one);cases.push('changed-scope-two-old-one-current-needs-one-delta');const noDelta=copy(one);noDelta.scopeChange.contextChanges=[];assert.throws(()=>oneCheck(noDelta),/context difference unresolved/);cases.push('changed-scope-multiplicity-cannot-collapse-silently');
 const paired=copy(one);paired.scopeChange.contextRetentions=[{priorContextSourceLocation:second,currentContextSourceLocation:copy(oldContext),reason:'Synthetic explicit retained occurrence relocation.'}];paired.scopeChange.contextChanges[0].priorContextSourceLocation=copy(oldContext);oneCheck(paired);cases.push('changed-scope-explicit-retained-occurrence-pairing');paired.scopeChange.contextRetentions.push({priorContextSourceLocation:copy(oldContext),currentContextSourceLocation:copy(oldContext),reason:'Invalid repeated current match.'});assert.throws(()=>oneCheck(paired),/retention pairing invalid/);cases.push('changed-scope-retention-pair-cannot-reuse-occurrence');

}

console.log(JSON.stringify({schema:'closed-loop-atomic-governance-format-regression/1',passed:true,syntheticFixture:true,atomicCompletenessEstablished:false,implementationConformanceEstablished:false,caseCount:cases.length,cases},null,2));
