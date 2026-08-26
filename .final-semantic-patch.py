from pathlib import Path
import re


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"missing exact patch anchor in {path}: {old[:120]}")
    if s.count(old) != 1:
        raise SystemExit(f"non-unique patch anchor in {path}: {old[:120]}")
    p.write_text(s.replace(old, new, 1))


replace_once("workflow-schema.js", "  18:['convergenceRecords'],", "  18:[],")

p = Path("prompt-engine.js")
s = p.read_text()
pat = r"function scopeFor\(stage,state,overrides=\{\}\)\{.*?\}\nfunction responseFieldContract"
m = re.search(pat, s, re.S)
if not m:
    raise SystemExit("scopeFor patch anchor missing")
new = """function scopeFor(stage,state,overrides={}){
 const j=state?.job||{},has=key=>Object.prototype.hasOwnProperty.call(overrides,key),pick=(key,fallback)=>has(key)?overrides[key]:fallback;
 const latestCandidate=state?.projectData?.candidateFreezes?.filter(x=>x?.active!==false&&!x?.invalidatedBy).at(-1)?.id||null;
 const baseline=j.CURRENT_BASELINE_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_BASELINE_ID))?j.CURRENT_BASELINE_ID:null;
 const product=j.CURRENT_PRODUCT_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_PRODUCT_ID))?j.CURRENT_PRODUCT_ID:null;
 return {projectRevision:Number(state?.revision||0),inputVersion:j.CURRENT_INPUT_VERSION||null,sourceSetVersion:j.CURRENT_SOURCE_SET_VERSION||null,requirementsVersion:j.CURRENT_REQUIREMENTS_VERSION||null,testSuiteVersion:j.CURRENT_TEST_SUITE_VERSION||null,instructionVersion:j.CURRENT_INSTRUCTION_VERSION||null,iterationId:pick('iterationId',j.CURRENT_ITERATION||null),candidateId:pick('candidateId',latestCandidate),runId:pick('runId',null),contextId:pick('contextId',null),baselineId:pick('baselineId',baseline),productId:pick('productId',product)};
}
function responseFieldContract"""
s = s[:m.start()] + new + s[m.end():]
p.write_text(s)

p = Path("app-core.js")
s = p.read_text()
replacements = [
("function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}",
 "function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||''),iterationId=String(run.scope?.iterationId||recordValue(run,'ITERATION_ID')||current.job.CURRENT_ITERATION||''),candidateId=String(run.scope?.candidateId||recordValue(run,'CANDIDATE_ID')||'');options.scope={iterationId,candidateId,runId,contextId};}}return options;}"),
("function stageConfirmationMarkup(n,locked){if(n!==1||current.isRetainedTestProject||current.stages[1].status==='COMPLETE')return '';const accepted=engine.acceptedChanges(current,1).length>0,confirmed=safe(current.projectData.stageConfirmations).some(x=>Number(x.stage)===1&&x.confirmed&&!x.invalidatedBy);if(!accepted||confirmed)return '';return `<div class=\"panel\"><h2 class=\"section-title\">Human intent confirmation</h2><p class=\"section-intro\">Confirm only that the accepted Stage 01 representation matches the objective and deliverable you intend.</p><div class=\"button-row\"><button class=\"primary\" id=\"confirm-stage-one\"${locked?' disabled':''}>Confirm represented intent</button></div></div>`;}",
 "function stageConfirmationMarkup(n,locked){if(n!==1||current.isRetainedTestProject)return '';const latest=engine.acceptedChanges(current,1).at(-1),accepted=Boolean(latest),confirmed=safe(current.projectData.stageConfirmations).some(x=>Number(x.stage)===1&&x.confirmed&&!x.invalidatedBy&&x.acceptedChangeId===latest?.changeId&&x.inputVersion===current.job.CURRENT_INPUT_VERSION);if(current.stages[1].status==='COMPLETE'&&confirmed)return '';if(!accepted||confirmed)return '';return `<div class=\"panel\"><h2 class=\"section-title\">Human intent confirmation</h2><p class=\"section-intro\">Confirm only that the accepted Stage 01 representation matches the objective and deliverable you intend.</p><div class=\"button-row\"><button class=\"primary\" id=\"confirm-stage-one\"${locked?' disabled':''}>Confirm represented intent</button></div></div>`;}"),
("if(next.stages[1].status==='COMPLETE'&&!next.isRetainedTestProject){const id=engine.allocateInfrastructureId(next,'HUMAN-INPUT-CHANGE','changes');engine.invalidateDownstream(next,1,id,'User Job Input changed after Stage 01 completion.');}",
 "if(next.stages[1].status==='COMPLETE'&&!next.isRetainedTestProject){const change=engine.acceptedChanges(next,1).at(-1);if(change)engine.invalidateAcceptedResponse(next,{stage:1,rawResponseId:change.rawResponseId,reason:'User Job Input changed after Stage 01 completion.',operatorLabel:'HUMAN_OPERATOR'});else engine.invalidateDownstream(next,1,engine.allocateInfrastructureId(next,'HUMAN-INPUT-CHANGE','changes'),'User Job Input changed after Stage 01 completion.');}"),
("if(current.stages[stage].status==='COMPLETE'){const id=engine.allocateInfrastructureId(next,'HUMAN-STAGE-CHANGE','changes');engine.invalidateDownstream(next,stage,id,'Human-owned stage input changed after completion.');}",
 "if(current.stages[stage].status==='COMPLETE'){const change=engine.acceptedChanges(next,stage).at(-1);if(change)engine.invalidateAcceptedResponse(next,{stage,rawResponseId:change.rawResponseId,reason:'Human-owned stage input changed after completion.',operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});else engine.invalidateDownstream(next,stage,engine.allocateInfrastructureId(next,'HUMAN-STAGE-CHANGE','changes'),'Human-owned stage input changed after completion.');}"),
("if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{const record=await savePromptRecord(current.activeStage);await navigator.clipboard?.writeText(record.prompt);announce('instruction saved and copied');};",
 "if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{const record=await savePromptRecord(current.activeStage);if(!navigator.clipboard?.writeText){announce('instruction saved; clipboard unavailable');return;}try{await navigator.clipboard.writeText(record.prompt);announce('instruction saved and copied');}catch{announce('instruction saved; clipboard copy failed');}};")]
for old,new in replacements:
    if old not in s:
        raise SystemExit("app-core patch anchor missing: "+old[:100])
    s=s.replace(old,new,1)
p.write_text(s)

p = Path("response-ingestion.js")
s = p.read_text()
old = "if(record.targetId){const target=workflow.records(project,collection,{active:true}).find(existing=>workflow.recordId(existing,collection)===String(record.targetId));if(!target)issues.push(issue('INVALID_RESERVED_TARGET',`${path}/targetId`,`Target ${record.targetId} does not exist as an active ${collection} record.`));else if(!['RESERVED','PENDING_AGENT','OPEN'].includes(upper(workflow.recordValue(target,'STATUS')||target.status||'RESERVED')))issues.push(issue('INVALID_RESERVED_TARGET',`${path}/targetId`,'Target record is not in an agent-completable reserved state.'));}"
new = """if(record.targetId){const target=workflow.records(project,collection,{active:true}).find(existing=>workflow.recordId(existing,collection)===String(record.targetId));if(!target)issues.push(issue('INVALID_RESERVED_TARGET',`${path}/targetId`,`Target ${record.targetId} does not exist as an active ${collection} record.`));else if(!['RESERVED','PENDING_AGENT','OPEN'].includes(upper(workflow.recordValue(target,'STATUS')||target.status||'RESERVED')))issues.push(issue('INVALID_RESERVED_TARGET',`${path}/targetId`,'Target record is not in an agent-completable reserved state.'));else{const placeholders=new Set(['','NONE','NOT APPLICABLE','UNKNOWN','PENDING','UNASSIGNED']),scope=envelope.scope||{},targetScope=target.scope||{},concrete=v=>!placeholders.has(upper(v)),value=(key,field)=>targetScope[key]??workflow.recordValue(target,field)??null,checks=[['iterationId','ITERATION_ID'],['candidateId','CANDIDATE_ID'],['runId','RUN_ID'],['contextId','CONTEXT_ID'],['baselineId','BASELINE_ID'],['productId','PRODUCT_ID']];if(Number(target.stage||stageNumber)!==stageNumber)issues.push(issue('INVALID_RESERVED_TARGET_SCOPE',`${path}/targetId`,'Reserved target belongs to a different stage.'));for(const [key,field] of checks){const expected=scope[key],actual=value(key,field);if(concrete(expected)&&concrete(actual)&&String(expected)!==String(actual))issues.push(issue('INVALID_RESERVED_TARGET_SCOPE',`${path}/targetId`,`Reserved target ${key} ${actual} does not match controlling ${key} ${expected}.`));}const targetId=String(record.targetId);if(concrete(scope.runId)&&collection==='runs'&&targetId!==String(scope.runId))issues.push(issue('INVALID_RESERVED_TARGET_SCOPE',`${path}/targetId`,'Run targetId does not match controlling runId.'));if(concrete(scope.candidateId)&&collection==='candidateFreezes'&&targetId!==String(scope.candidateId))issues.push(issue('INVALID_RESERVED_TARGET_SCOPE',`${path}/targetId`,'Candidate targetId does not match controlling candidateId.'));if(concrete(scope.productId)&&collection==='products'&&targetId!==String(scope.productId))issues.push(issue('INVALID_RESERVED_TARGET_SCOPE',`${path}/targetId`,'Product targetId does not match controlling productId.'));}}"""
if old not in s:
    raise SystemExit("reserved target patch anchor missing")
s=s.replace(old,new,1)
p.write_text(s)

p = Path("workflow-engine.js")
s = p.read_text()
replace_pairs = [
("function testRequirementId(record){return String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');}",
 "function testRequirementId(record){return String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');}\nfunction resultRequirementId(project,record){const direct=String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');if(direct)return direct;const testId=String(recordValue(record,'TEST_ID')||record.relationships?.TEST_ID||'');if(!testId)return '';const test=records(project,'tests').find(item=>recordId(item,'tests')===testId&&isActiveRecord(item));return test?testRequirementId(test):'';}"),
("function acceptedOperationSet(project,stage){const proposals=safe(project.projectData.responseProposals),out=new Set();for(const c of acceptedChanges(project,stage)){const op=c.operation||proposals.find(p=>p.proposalId===c.proposalId)?.envelope?.operation;if(op)out.add(String(op));}return out;}",
 "function acceptedOperationSet(project,stage,iterationId=null){const proposals=safe(project.projectData.responseProposals),out=new Set(),wanted=String(iterationId||'');for(const c of acceptedChanges(project,stage)){const proposal=proposals.find(p=>p.proposalId===c.proposalId),op=String(c.operation||proposal?.envelope?.operation||''),scope=c.scope||proposal?.envelope?.scope||{};if(!op)continue;if(wanted&&!(Number(stage)===17&&op==='FREEZE')&&String(scope.iterationId||'')!==wanted)continue;out.add(op);}return out;}"),
("ops=acceptedOperationSet(project,stage),requiredOps=", "ops=acceptedOperationSet(project,stage,iterationId),requiredOps="),
("[...deterministic,...meaning].filter(r=>String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')===id)", "[...deterministic,...meaning].filter(r=>resultRequirementId(project,r)===id)"),
("] .filter(r=>String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')===reqId)", "] .filter(r=>resultRequirementId(project,r)===reqId)"),
("function recordReleaseDetermination(project){ensureShape(project);const metrics=releaseMetrics(project);", "function recordReleaseDetermination(project){ensureShape(project);if(project.stages?.[26]?.status!=='COMPLETE')throw new Error('Stage 26 must be COMPLETE before release determination.');const metrics=releaseMetrics(project);"),
("recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,DERIVATIONS", "recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,acceptedOperationSet,DERIVATIONS")]
for old,new in replace_pairs:
    if old in s:
        s=s.replace(old,new,1)
    elif " ] .filter" not in old:
        raise SystemExit("workflow-engine patch anchor missing: "+old[:100])
# Exact evidence-chain expression uses no separating space.
s=s.replace("].filter(r=>String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')===reqId)","].filter(r=>resultRequirementId(project,r)===reqId)",1)
old="function verifyArtifactIdentity(project,audited,delivery){ensureShape(project);if(upper(recordValue(records(project,'releaseRecords').at(-1),'DETERMINATION'))!=='ACCEPTED')throw new Error('Artifact identity verification is prohibited until Stage 27 is ACCEPTED.');const a=safe(audited),d=safe(delivery);"
new="function verifyArtifactIdentity(project,audited,delivery){ensureShape(project);const release=recordsForCurrentScope(project,'releaseRecords').at(-1);if(project.stages?.[27]?.status!=='COMPLETE'||upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')throw new Error('Artifact identity verification is prohibited until current Stage 27 is COMPLETE and ACCEPTED.');const a=safe(audited),d=safe(delivery),canonical=recordsForCurrentScope(project,'artifacts');for(const item of a){const matches=canonical.filter(r=>recordId(r,'artifacts')===String(item.artifactId)&&String(recordValue(r,'FILENAME'))===String(item.name)&&Number(recordValue(r,'BYTE_SIZE'))===Number(item.size)&&String(recordValue(r,'SHA256')).toLowerCase()===String(item.sha256||'').toLowerCase());if(matches.length!==1)throw new Error('Audited artifact '+String(item.artifactId)+' does not match exactly one current canonical stored-byte identity.');}"
if old not in s:
    raise SystemExit("artifact identity precondition anchor missing")
s=s.replace(old,new,1)
p.write_text(s)

p=Path("verify-complete.mjs")
s=p.read_text()
marker="// Artifact identity is independent of file-selection order."
if marker not in s:
    raise SystemExit("verify-complete insertion marker missing")
tests=r'''
// Agent-writable contracts may never expose application-derived collections.
for(const [stage,contract] of Object.entries(schema.STAGE_CONTRACTS))for(const collection of contract.agentWritableCollections)assert(schema.RECORD_SCHEMAS[collection]?.commitPolicy!=='APPLICATION_DERIVED',`Stage ${stage} exposes application-derived ${collection} as agent-writable.`);
assert(!schema.STAGE_CONTRACTS[18].agentWritableCollections.includes('convergenceRecords'),'Stage 18 exposes convergenceRecords to the agent.');

// Explicit prompt resource scope survives regeneration instead of silently switching to global current identities.
{
  const p=project('JOB-PROMPT-SCOPE');p.job.CURRENT_ITERATION='ITERATION-CURRENT';p.job.CURRENT_BASELINE_ID='BASELINE-CURRENT';p.job.CURRENT_PRODUCT_ID='PRODUCT-CURRENT';
  p.projectData.candidateFreezes.push(record('candidateFreezes',17,{ITERATION_ID:'ITERATION-CURRENT',COMPONENT_HASHES:{A:'a'},STATUS:'FROZEN'},'CANDIDATE-CURRENT'));
  const scope=prompts.scopeFor(17,p,{iterationId:'ITERATION-SELECTED',candidateId:'CANDIDATE-SELECTED',runId:'RUN-SELECTED',contextId:'CONTEXT-SELECTED',baselineId:'BASELINE-SELECTED',productId:'PRODUCT-SELECTED'});
  assert(scope.iterationId==='ITERATION-SELECTED'&&scope.candidateId==='CANDIDATE-SELECTED'&&scope.runId==='RUN-SELECTED'&&scope.contextId==='CONTEXT-SELECTED'&&scope.baselineId==='BASELINE-SELECTED'&&scope.productId==='PRODUCT-SELECTED','Prompt resource-scope override was silently replaced by global state.');
}

// Operation completion is iteration-scoped; historical operation activity cannot satisfy a new repeated cycle.
{
  const p=project('JOB-OP-SCOPE');p.projectData.acceptedChanges.push({changeId:'OLD-VERIFY',stage:19,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'VERIFY',scope:{iterationId:'ITERATION-OLD'}});p.projectData.acceptedChanges.push({changeId:'NEW-COMPARE',stage:19,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'COMPARE',scope:{iterationId:'ITERATION-NEW'}});
  const ops=engine.acceptedOperationSet(p,19,'ITERATION-NEW');assert(!ops.has('VERIFY')&&ops.has('COMPARE'),'Historical repeated-operation proof leaked into the current iteration.');
}

// Release and delivery identity cannot be invoked before their prerequisite stages are complete.
{
  const p=project('JOB-PREMATURE-RELEASE');let releaseBlocked=false;try{engine.recordReleaseDetermination(p);}catch{releaseBlocked=true;}assert(releaseBlocked,'Release determination ran before Stage 26 completion.');
  const release=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-EARLY');release.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(release);let identityBlocked=false;try{engine.verifyArtifactIdentity(p,[],[]);}catch{identityBlocked=true;}assert(identityBlocked,'Artifact identity ran before Stage 27 completion.');
}

'''
s=s.replace(marker,tests+marker,1)
s=s.replace("const p=project('JOB-ORDER');p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER'));","const p=project('JOB-ORDER');p.stages[27].status='COMPLETE';const rel=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER');rel.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(rel);")
s=s.replace("p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST'));","p.stages[27].status='COMPLETE';const rel=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST');rel.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(rel);")
p.write_text(s)
