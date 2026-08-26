from pathlib import Path
import re

def rep(path, old, new, count=1):
    p=Path(path); s=p.read_text()
    if s.count(old)<count: raise SystemExit(f'missing patch anchor in {path}: {old[:100]}')
    p.write_text(s.replace(old,new,count))

# 1. Never advertise application-derived convergence records as agent-writable.
rep('workflow-schema.js',"  18:['convergenceRecords'],","  18:[],")
# Stage 24 declares the exact attack set and uses the existing regression-execution collection.
rep('workflow-schema.js',"  24:['adversarialResults'],","  24:['adversarialResults','regressionExecutions'],")
rep('workflow-schema.js',"  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})})\n});","  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})}),\n  '24':Object.freeze({ATTACKS_EXECUTED:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})})\n});")

# 2. Preserve explicitly selected resource identities in prompt regeneration; versions/revision remain freshly derived.
p=Path('prompt-engine.js'); s=p.read_text(); pat=r"function scopeFor\(stage,state,overrides=\{\}\)\{.*?\n return value;\n\}"
m=re.search(pat,s,re.S)
if not m: raise SystemExit('scopeFor anchor missing')
new="""function scopeFor(stage,state,overrides={}){\n const j=state?.job||{},has=key=>Object.prototype.hasOwnProperty.call(overrides,key),pick=(key,fallback)=>has(key)?overrides[key]:fallback;\n const value={projectRevision:Number(state?.revision||0),inputVersion:j.CURRENT_INPUT_VERSION||null,sourceSetVersion:j.CURRENT_SOURCE_SET_VERSION||null,requirementsVersion:j.CURRENT_REQUIREMENTS_VERSION||null,testSuiteVersion:j.CURRENT_TEST_SUITE_VERSION||null,instructionVersion:j.CURRENT_INSTRUCTION_VERSION||null,iterationId:pick('iterationId',j.CURRENT_ITERATION||null),candidateId:pick('candidateId',state?.projectData?.candidateFreezes?.filter(x=>x?.active!==false&&!x?.invalidatedBy).at(-1)?.id||null),runId:pick('runId',null),contextId:pick('contextId',null),baselineId:pick('baselineId',j.CURRENT_BASELINE_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_BASELINE_ID))?j.CURRENT_BASELINE_ID:null),productId:pick('productId',j.CURRENT_PRODUCT_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_PRODUCT_ID))?j.CURRENT_PRODUCT_ID:null)};\n return value;\n}"""
s=s[:m.start()]+new+s[m.end():]
old="24:'Perform adversarial verification on the finished product. Test applicable missing material, prohibited material, contradictions, impossible logic, unsupported facts, external-source misrepresentation, wrong versions, broken references, hidden assumptions, partial completion, nonsensical meaning, terminology inconsistency, unhandled exceptions, stale facts, malformed files, hidden content, export corruption, superficial keyword compliance, historical regressions, and domain-specific failure modes. Preserve attack, method, expected behavior, actual result, defect, severity, and evidence. Do not claim attacks that were not actually executed.',"
new24="24:'Perform adversarial verification on the finished product. First declare the complete applicable attack-category set in ATTACKS_EXECUTED. Test applicable missing material, prohibited material, contradictions, impossible logic, unsupported facts, external-source misrepresentation, wrong versions, broken references, hidden assumptions, partial completion, nonsensical meaning, terminology inconsistency, unhandled exceptions, stale facts, malformed files, hidden content, export corruption, superficial keyword compliance, historical regressions, and domain-specific failure modes. Return exactly one evidenced adversarialResults record for each declared attack category. Execute every active historical permanent regression against the current product and return exactly one current regressionExecutions record for each active REG_ID. Preserve attack, method, expected behavior, actual result, defect, severity, determination, and evidence. Do not claim attacks or regressions that were not actually executed.',"
if old not in s: raise SystemExit('Stage24 prompt anchor missing')
s=s.replace(old,new24,1); p.write_text(s)

# 3. UI binds run prompts to exact iteration/candidate and uses existing same-stage authority invalidation.
p=Path('app-core.js'); s=p.read_text()
repold="function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}"
repnew="function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||''),iterationId=String(run.scope?.iterationId||recordValue(run,'ITERATION_ID')||current.job.CURRENT_ITERATION||''),candidateId=String(run.scope?.candidateId||recordValue(run,'CANDIDATE_ID')||'');options.scope={iterationId,candidateId,runId,contextId};}}return options;}"
if repold not in s: raise SystemExit('promptOptions anchor missing')
s=s.replace(repold,repnew,1)
old="function stageConfirmationMarkup(n,locked){if(n!==1||current.isRetainedTestProject||current.stages[1].status==='COMPLETE')return '';const accepted=engine.acceptedChanges(current,1).length>0,confirmed=safe(current.projectData.stageConfirmations).some(x=>Number(x.stage)===1&&x.confirmed&&!x.invalidatedBy);if(!accepted||confirmed)return '';"
new="function stageConfirmationMarkup(n,locked){if(n!==1||current.isRetainedTestProject)return '';const latest=engine.acceptedChanges(current,1).at(-1),accepted=Boolean(latest),confirmed=safe(current.projectData.stageConfirmations).some(x=>Number(x.stage)===1&&x.confirmed&&!x.invalidatedBy&&x.acceptedChangeId===latest?.changeId&&x.inputVersion===current.job.CURRENT_INPUT_VERSION);if(current.stages[1].status==='COMPLETE'&&confirmed)return '';if(!accepted||confirmed)return '';"
if old not in s: raise SystemExit('stage confirmation anchor missing')
s=s.replace(old,new,1)
old="if(next.stages[1].status==='COMPLETE'&&!next.isRetainedTestProject){const id=engine.allocateInfrastructureId(next,'HUMAN-INPUT-CHANGE','changes');engine.invalidateDownstream(next,1,id,'User Job Input changed after Stage 01 completion.');}"
new="if(next.stages[1].status==='COMPLETE'&&!next.isRetainedTestProject)engine.invalidateStageForAuthorityChange(next,{stage:1,reason:'User Job Input changed after Stage 01 completion.',operatorLabel:'HUMAN_OPERATOR'});"
if old not in s: raise SystemExit('saveJob invalidation anchor missing')
s=s.replace(old,new,1)
old="if(current.stages[stage].status==='COMPLETE'){const id=engine.allocateInfrastructureId(next,'HUMAN-STAGE-CHANGE','changes');engine.invalidateDownstream(next,stage,id,'Human-owned stage input changed after completion.');}"
new="if(current.stages[stage].status==='COMPLETE')engine.invalidateStageForAuthorityChange(next,{stage,reason:'Human-owned stage input changed after completion.',operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});"
if old not in s: raise SystemExit('human stage invalidation anchor missing')
s=s.replace(old,new,1)
old="if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{const record=await savePromptRecord(current.activeStage);await navigator.clipboard?.writeText(record.prompt);announce('instruction saved and copied');};"
new="if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{const record=await savePromptRecord(current.activeStage);if(!navigator.clipboard?.writeText){announce('instruction saved; clipboard unavailable');return;}try{await navigator.clipboard.writeText(record.prompt);announce('instruction saved and copied');}catch{announce('instruction saved; clipboard copy failed');}};"
if old not in s: raise SystemExit('clipboard anchor missing')
s=s.replace(old,new,1); p.write_text(s)

# 4. Repeated-operation proof belongs to the evaluated iteration (except setup ops before iteration allocation).
p=Path('workflow-engine.js'); s=p.read_text()
old="function acceptedOperationSet(project,stage){const proposals=safe(project.projectData.responseProposals),out=new Set();for(const c of acceptedChanges(project,stage)){const op=c.operation||proposals.find(p=>p.proposalId===c.proposalId)?.envelope?.operation;if(op)out.add(String(op));}return out;}"
new="function acceptedOperationSet(project,stage,iterationId=null){const proposals=safe(project.projectData.responseProposals),out=new Set(),wanted=String(iterationId||'');for(const c of acceptedChanges(project,stage)){const proposal=proposals.find(p=>p.proposalId===c.proposalId),op=String(c.operation||proposal?.envelope?.operation||''),scope=c.scope||proposal?.envelope?.scope||{};if(!op)continue;const setupOperation=(Number(stage)===17&&op==='FREEZE')||(Number(stage)===19&&op==='CONFIRM_FREEZE');if(wanted&&!setupOperation&&String(scope.iterationId||'')!==wanted)continue;out.add(op);}return out;}"
if old not in s: raise SystemExit('acceptedOperationSet anchor missing')
s=s.replace(old,new,1)
if "ops=acceptedOperationSet(project,stage),requiredOps=" not in s: raise SystemExit('evaluate operation call anchor missing')
s=s.replace("ops=acceptedOperationSet(project,stage),requiredOps=","ops=acceptedOperationSet(project,stage,iterationId),requiredOps=",1)
# Stage 24 exact category and regression coverage.
old="""    case 24:{\n      requireAccepted();requireCount('adversarialResults',1);\n      if(collection('adversarialResults').some(record=>['VIOLATED','UNDETERMINED','FAILED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Adversarial verification found an unresolved result.');\n      break;\n    }"""
new="""    case 24:{\n      requireAccepted();const declared=safe(project.stages[24]?.agentData?.ATTACKS_EXECUTED).map(x=>String(x).trim()).filter(Boolean),declaredSet=new Set(declared),results=recordsForCurrentScope(project,'adversarialResults'),counts=new Map();for(const result of results){const attack=String(recordValue(result,'ATTACK')||'').trim();counts.set(attack,(counts.get(attack)||0)+1);}if(!declaredSet.size)reasons.push('The complete applicable adversarial attack-category set must be declared.');if(declaredSet.size!==declared.length)reasons.push('Declared adversarial attack categories must be unique.');const missing=[...declaredSet].filter(name=>counts.get(name)!==1),unexpected=results.filter(result=>!declaredSet.has(String(recordValue(result,'ATTACK')||'').trim()));if(missing.length)reasons.push('Exactly one current adversarial result is required for each declared attack category: '+missing.join(', ')+'.');if(unexpected.length)reasons.push('Unexpected adversarial results exist outside the declared applicable attack-category set.');if(results.some(record=>!String(recordValue(record,'EVIDENCE')||'').trim()||upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('Every current adversarial result requires evidence and an affirmative SATISFIED determination.');const activeRegs=records(project,'regressions').filter(r=>upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED'),executions=recordsForCurrentScope(project,'regressionExecutions');for(const reg of activeRegs){const id=recordId(reg,'regressions'),xs=executions.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id);if(xs.length!==1||!['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(xs[0],'RESULT'))))reasons.push('Active historical regression '+id+' requires exactly one successful current product-scope execution.');}break;\n    }"""
if old not in s: raise SystemExit('Stage24 gate anchor missing')
s=s.replace(old,new,1)
# Release and post-release controls fail closed on prerequisite/current scope.
old="function recordReleaseDetermination(project){ensureShape(project);const metrics=releaseMetrics(project);"
if old not in s: raise SystemExit('release function anchor missing')
s=s.replace(old,"function recordReleaseDetermination(project){ensureShape(project);if(project.stages?.[26]?.status!=='COMPLETE')throw new Error('Stage 26 must be COMPLETE before release determination.');const metrics=releaseMetrics(project);",1)
old="const release=all('releaseRecords').at(-1);\n      if(upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')reasons.push('Stage 27 must be ACCEPTED before artifact identity verification.');\n      if(!all('artifactIdentities').length)reasons.push('No audited-versus-delivery artifact identity comparison exists.');\n      if(all('artifactIdentities').some(record=>!truth(recordValue(record,'EXACT_HASH_MATCH'))||!truth(recordValue(record,'EXACT_SIZE_MATCH'))||upper(recordValue(record,'AUTHORIZATION'))!=='AUTHORIZED'))reasons.push('At least one release artifact does not exactly match the audited artifact.');"
new="const release=recordsForCurrentScope(project,'releaseRecords').at(-1),identities=recordsForCurrentScope(project,'artifactIdentities');\n      if(project.stages?.[27]?.status!=='COMPLETE'||upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')reasons.push('Current Stage 27 must be COMPLETE and ACCEPTED before artifact identity verification.');\n      if(!identities.length)reasons.push('No current audited-versus-delivery artifact identity comparison exists.');\n      if(identities.some(record=>!truth(recordValue(record,'EXACT_HASH_MATCH'))||!truth(recordValue(record,'EXACT_SIZE_MATCH'))||upper(recordValue(record,'AUTHORIZATION'))!=='AUTHORIZED'))reasons.push('At least one current release artifact does not exactly match the audited artifact.');"
if old not in s: raise SystemExit('Stage28 gate anchor missing')
s=s.replace(old,new,1)
old="const reqs=mandatoryRequirements(project),chains=all('evidenceChains')"
if old not in s: raise SystemExit('Stage29 scope anchor missing')
s=s.replace(old,"const reqs=mandatoryRequirements(project,currentScope(project)),chains=recordsForCurrentScope(project,'evidenceChains')",1)
old="function constructEvidenceChains(project){ensureShape(project);const requirements=mandatoryRequirements(project);"
if old not in s: raise SystemExit('construct evidence scope anchor missing')
s=s.replace(old,"function constructEvidenceChains(project){ensureShape(project);const requirements=mandatoryRequirements(project,currentScope(project));",1)
old="function verifyArtifactIdentity(project,audited,delivery){ensureShape(project);if(upper(recordValue(records(project,'releaseRecords').at(-1),'DETERMINATION'))!=='ACCEPTED')throw new Error('Artifact identity verification is prohibited until Stage 27 is ACCEPTED.');const a=safe(audited),d=safe(delivery);"
new="function verifyArtifactIdentity(project,audited,delivery){ensureShape(project);const release=recordsForCurrentScope(project,'releaseRecords').at(-1);if(project.stages?.[27]?.status!=='COMPLETE'||upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')throw new Error('Artifact identity verification is prohibited until current Stage 27 is COMPLETE and ACCEPTED.');const a=safe(audited),d=safe(delivery),canonical=recordsForCurrentScope(project,'artifacts');for(const item of a){const matches=canonical.filter(r=>recordId(r,'artifacts')===String(item.artifactId)&&String(recordValue(r,'FILENAME'))===String(item.name)&&Number(recordValue(r,'BYTE_SIZE'))===Number(item.size)&&String(recordValue(r,'SHA256')).toLowerCase()===String(item.sha256||'').toLowerCase());if(matches.length!==1)throw new Error('Audited artifact '+String(item.artifactId)+' does not match exactly one current canonical stored-byte identity.');}"
if old not in s: raise SystemExit('artifact identity function anchor missing')
s=s.replace(old,new,1)
# Export operation selector for focused proof.
old="recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,DERIVATIONS"
if old not in s: raise SystemExit('engine export anchor missing')
s=s.replace(old,"recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,acceptedOperationSet,DERIVATIONS",1)
p.write_text(s)

# 5. Full-cycle Stage24 now proves exact attack and active-regression execution.
p=Path('verify-full-cycle.mjs'); s=p.read_text()
old="data(24,{records:{adversarialResults:[recordProposal(schema,'adversarialResults',{tempKey:'adv',relationships:{PRODUCT_ID:{recordId:productId}},overrides:{ATTACK:'Missing required content',METHOD:'Adversarial omission check',EXPECTED_BEHAVIOR:'Reject missing content',ACTUAL_RESULT:'No defect found',DETERMINATION:'SATISFIED',SEVERITY:'MINOR',EVIDENCE:'Adversarial evidence'}})]}});complete(24);"
new="data(24,{stageData:{ATTACKS_EXECUTED:['Missing required content']},records:{adversarialResults:[recordProposal(schema,'adversarialResults',{tempKey:'adv',relationships:{PRODUCT_ID:{recordId:productId}},overrides:{ATTACK:'Missing required content',METHOD:'Adversarial omission check',EXPECTED_BEHAVIOR:'Reject missing content',ACTUAL_RESULT:'No defect found',DETERMINATION:'SATISFIED',SEVERITY:'MINOR',EVIDENCE:'Adversarial evidence'}})],regressionExecutions:[recordProposal(schema,'regressionExecutions',{tempKey:'product-regression',relationships:{REG_ID:{recordId:regId},PRODUCT_ID:{recordId:productId}},overrides:{PHASE:'PRODUCT_ADVERSARIAL',RESULT:'SATISFIED'}})]}});complete(24);"
if old not in s: raise SystemExit('full-cycle Stage24 anchor missing')
s=s.replace(old,new,1); p.write_text(s)

# 6. Focused semantic regression proofs.
p=Path('verify-complete.mjs'); s=p.read_text(); marker='// Artifact identity is independent of file-selection order.'
if marker not in s: raise SystemExit('verify-complete marker missing')
tests=r'''
// Application-derived collections are never advertised as agent-writable.
for(const [stage,contract] of Object.entries(schema.STAGE_CONTRACTS))for(const collection of contract.agentWritableCollections)assert(schema.RECORD_SCHEMAS[collection]?.commitPolicy!=='APPLICATION_DERIVED',`Stage ${stage} exposes application-derived ${collection} as agent-writable.`);
assert(schema.STAGE_FIELDS[24].ATTACKS_EXECUTED.valueType==='STRING_ARRAY','Stage 24 attack-set declaration is not a typed list.');

// Explicit resource identity survives prompt regeneration.
{
 const p=project('JOB-PROMPT-RESOURCE-SCOPE');p.job.CURRENT_ITERATION='ITERATION-CURRENT';p.job.CURRENT_BASELINE_ID='BASELINE-CURRENT';p.job.CURRENT_PRODUCT_ID='PRODUCT-CURRENT';
 const scope=prompts.scopeFor(17,p,{iterationId:'ITERATION-SELECTED',candidateId:'CANDIDATE-SELECTED',runId:'RUN-SELECTED',contextId:'CONTEXT-SELECTED',baselineId:'BASELINE-SELECTED',productId:'PRODUCT-SELECTED'});
 assert(scope.iterationId==='ITERATION-SELECTED'&&scope.candidateId==='CANDIDATE-SELECTED'&&scope.runId==='RUN-SELECTED'&&scope.contextId==='CONTEXT-SELECTED'&&scope.baselineId==='BASELINE-SELECTED'&&scope.productId==='PRODUCT-SELECTED','Prompt resource identity was silently replaced by global state.');
}

// Historical operation activity cannot satisfy a later repeated iteration.
{
 const p=project('JOB-OPERATION-ITERATION');p.projectData.acceptedChanges.push({changeId:'OLD-VERIFY',stage:19,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'VERIFY',scope:{iterationId:'ITERATION-OLD'}},{changeId:'NEW-COMPARE',stage:19,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'COMPARE',scope:{iterationId:'ITERATION-NEW'}},{changeId:'SETUP',stage:19,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'CONFIRM_FREEZE',scope:{}});
 const ops=engine.acceptedOperationSet(p,19,'ITERATION-NEW');assert(!ops.has('VERIFY')&&ops.has('COMPARE')&&ops.has('CONFIRM_FREEZE'),'Repeated operation proof is not iteration-scoped.');
}

// Stage 24 requires the exact declared attack set and every active historical regression.
{
 const p=project('JOB-STAGE24-EXACT');p.job.CURRENT_PRODUCT_ID='PRODUCT-24';p.stages[24].agentData.ATTACKS_EXECUTED=['CATEGORY-A','CATEGORY-B'];p.projectData.acceptedChanges.push({changeId:'CHANGE-24',stage:24,status:'COMMITTED',responseType:'DATA_PROPOSAL'});
 const scope={inputVersion:p.job.CURRENT_INPUT_VERSION,productId:'PRODUCT-24'};const a=record('adversarialResults',24,{PRODUCT_ID:'PRODUCT-24',ATTACK:'CATEGORY-A',METHOD:'x',EXPECTED_BEHAVIOR:'x',ACTUAL_RESULT:'x',DETERMINATION:'SATISFIED',SEVERITY:'MINOR',EVIDENCE:'e'},'ATTACK-A');a.scope=scope;p.projectData.adversarialResults.push(a);
 const reg=record('regressions',15,{ACTIVE_RETIRED_STATE:'ACTIVE',APPLICABILITY:'APPLICABLE'},'REG-24');reg.scope=scope;p.projectData.regressions.push(reg);
 let g=engine.gate(24,p);assert(!g.complete&&g.reasons.some(x=>/CATEGORY-B/.test(x))&&g.reasons.some(x=>/REG-24/.test(x)),'Stage 24 accepted incomplete attack/regression coverage.');
 const b=record('adversarialResults',24,{PRODUCT_ID:'PRODUCT-24',ATTACK:'CATEGORY-B',METHOD:'x',EXPECTED_BEHAVIOR:'x',ACTUAL_RESULT:'x',DETERMINATION:'SATISFIED',SEVERITY:'MINOR',EVIDENCE:'e'},'ATTACK-B');b.scope=scope;p.projectData.adversarialResults.push(b);const rx=record('regressionExecutions',24,{REG_ID:'REG-24',PRODUCT_ID:'PRODUCT-24',PHASE:'PRODUCT_ADVERSARIAL',RESULT:'SATISFIED'},'REG-EXEC-24');rx.scope=scope;rx.relationships={REG_ID:'REG-24',PRODUCT_ID:'PRODUCT-24'};p.projectData.regressionExecutions.push(rx);g=engine.gate(24,p);assert(g.complete,`Stage 24 rejected complete exact coverage: ${g.reasons.join('; ')}`);
}

// Release/artifact commands reject premature or stale-scope authority.
{
 const p=project('JOB-PREMATURE-RELEASE');let blocked=false;try{engine.recordReleaseDetermination(p);}catch{blocked=true;}assert(blocked,'Release determination ran before Stage 26 completion.');
 const rel=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-OLD');rel.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(rel);let identityBlocked=false;try{engine.verifyArtifactIdentity(p,[],[]);}catch{identityBlocked=true;}assert(identityBlocked,'Artifact identity ran before current Stage 27 completion.');
}

'''
s=s.replace(marker,tests+marker,1); p.write_text(s)
