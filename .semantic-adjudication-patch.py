from pathlib import Path
import re, hashlib


def replace_function(text, name, replacement):
    marker=f"function {name}("
    start=text.find(marker)
    if start<0: raise RuntimeError(f'missing function {name}')
    brace=text.find('{',start)
    depth=0; quote=None; esc=False; i=brace
    while i<len(text):
        ch=text[i]
        if quote:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch==quote: quote=None
        else:
            if ch in "'\"`": quote=ch
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:
                    return text[:start]+replacement+text[i+1:]
        i+=1
    raise RuntimeError(f'unclosed function {name}')

p=Path('workflow-engine.js'); s=p.read_text()

semantic=r'''function evidenceReferences(result){return [...new Set([...(safe(result?.evidenceRefs).map(String)),...['EVIDENCE_ID','EVIDENCE_IDS'].flatMap(key=>safe(recordValue(result,key)).map(String))].filter(Boolean))];}
const EFFECTIVE_SUCCESS=new Set(['SATISFIED','PASSED','PASS','SUCCESS','SUCCEEDED','COMPLETED','COMPLETE','AUTHORIZED','CONFIRMED']);
const EFFECTIVE_FAILURE=new Set(['VIOLATED','FAILED','FAIL','REJECTED','ERROR','INVALID','ACCEPTED_INVALID']);
const EFFECTIVE_UNKNOWN=new Set(['UNDETERMINED','UNKNOWN','BLOCKED','NOT_RUN','NOT RUN','UNAVAILABLE','NOT_EXECUTED','NOT EXECUTED']);
const NONE_WORDS=new Set(['','NONE','NO DEFECTS','NO DEFECT','NO FAILURES','NO FAILURE','NO DEVIATIONS','NO DEVIATION','NOT APPLICABLE','N/A','FALSE','NO']);
function formalOutcome(value){const v=upper(value);if(EFFECTIVE_SUCCESS.has(v))return 'SATISFIED';if(EFFECTIVE_FAILURE.has(v))return 'VIOLATED';if(EFFECTIVE_UNKNOWN.has(v))return 'UNDETERMINED';return null;}
function materialValue(value){if(value===null||value===undefined)return false;if(typeof value==='boolean')return value;if(typeof value==='number')return value!==0;if(Array.isArray(value))return value.length>0;if(typeof value==='object')return Object.keys(value).length>0;const v=upper(value);return !NONE_WORDS.has(v);}
function evidenceRecordComplete(record){return ['KIND','DESCRIPTION','LOCATION','CONTENT'].every(key=>String(recordValue(record,key)||'').trim())&&!['REJECTED','INVALID','MISSING','UNAVAILABLE'].includes(upper(recordValue(record,'STATUS')));}
function evaluateEvidenceContract(project,{test=null,result=null}={}){
  const ids=evidenceReferences(result),allEvidence=records(project,'evidenceRecords'),evidence=ids.map(id=>allEvidence.find(r=>recordId(r,'evidenceRecords')===id&&isActiveRecord(r))).filter(Boolean),mode=upper(recordValue(test,'EXECUTION_MODE')||''),artifactRequirements=String(recordValue(test,'ARTIFACT_REQUIREMENTS')||'').trim(),artifactRequired=Boolean(artifactRequirements&&!['NONE','NOT APPLICABLE','N/A'].includes(upper(artifactRequirements))),testText=[recordValue(test,'PROCEDURE'),recordValue(test,'EXPECTED_RESULT'),recordValue(test,'FAILURE_CONDITION'),recordValue(test,'EVIDENCE_TO_PRESERVE'),artifactRequirements].join(' '),byteTest=/\b(byte|bytes|sha-?256|hash|checksum|artifact identity)\b/i.test(testText),reasons=[],requiredEvidenceClasses=['CANONICAL_EVIDENCE_RECORD'];
  if(mode==='UNAVAILABLE')reasons.push('Unavailable execution capability cannot establish satisfaction.');
  if(!ids.length)reasons.push('Bare narrative evidence cannot establish satisfaction; at least one canonical evidence record is required.');
  if(ids.length!==evidence.length)reasons.push('One or more evidence references do not resolve to active canonical evidence records.');
  if(evidence.some(e=>!evidenceRecordComplete(e)))reasons.push('Canonical evidence is missing required kind, description, location, content, or valid status.');
  const artifacts=recordsForCurrentScope(project,'artifacts'),attached=evidence.map(e=>String(recordValue(e,'ATTACHMENT_ID')||e.relationships?.ATTACHMENT_ID||'')).filter(Boolean),verified=attached.map(id=>artifacts.find(a=>recordId(a,'artifacts')===id)).filter(a=>a&&upper(recordValue(a,'AVAILABILITY'))==='BYTES_PERSISTED_AND_VERIFIED'&&/^[a-f0-9]{64}$/i.test(String(recordValue(a,'SHA256')||'')));
  if(artifactRequired||byteTest){requiredEvidenceClasses.push('APPLICATION_VERIFIED_ARTIFACT_BYTES');if(!verified.length)reasons.push('Required byte-backed evidence is not bound to application-verified artifact bytes.');}
  if(mode==='HUMAN_INSPECTION'){requiredEvidenceClasses.push('HUMAN_OBSERVATION');if(!evidence.some(e=>/HUMAN/i.test(String(recordValue(e,'AUTHORITY_TYPE')||recordValue(e,'KIND')||''))))reasons.push('Human inspection requires canonical human-observation evidence.');}
  if(mode==='EXTERNAL_SYSTEM'){requiredEvidenceClasses.push('EXTERNAL_SYSTEM_RECEIPT');if(!evidence.some(e=>/(EXTERNAL|SYSTEM|LAB|MACHINE|INSTRUMENT)/i.test(String(recordValue(e,'AUTHORITY_TYPE')||recordValue(e,'KIND')||''))))reasons.push('External-system verification requires evidence attributable to the required external system.');}
  if(mode==='EXTERNAL_AGENT_TOOL'){requiredEvidenceClasses.push('TOOL_EXECUTION_RECEIPT');if(!String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim())reasons.push('Tool execution capability identity is missing.');if(!String(recordValue(result,'OBSERVED_RESULT')||recordValue(result,'ACTUAL_RESULT')||'').trim())reasons.push('Tool execution result is missing.');}
  if(result&&Number(result.stage)===23||recordValue(result,'OBSERVED_MEANING')){requiredEvidenceClasses.push('MEANING_COMPARISON');for(const key of ['PRODUCT_LOCATION','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON'])if(!String(recordValue(result,key)||'').trim())reasons.push(`Meaning review lacks ${key}.`);}
  if(result&&recordValue(result,'RUN_ID')&&!String(recordValue(result,'RUN_ID')||result.relationships?.RUN_ID||'').trim())reasons.push('Execution identity is missing.');
  return {sufficient:reasons.length===0,reasons,requiredEvidenceClasses,presentEvidenceIds:evidence.map(e=>recordId(e,'evidenceRecords')),verifiedArtifactIds:verified.map(a=>recordId(a,'artifacts'))};
}
function evaluateEvidenceSufficiency(project,args={}){return evaluateEvidenceContract(project,args);}
function claimedDetermination(collection,record){const key=collection==='processAudits'?'PROCESS_DETERMINATION':collection==='productAudits'?'PRODUCT_DETERMINATION':collection==='regressionExecutions'?'RESULT':collection==='products'?'STATUS':'DETERMINATION';return upper(recordValue(record,key));}
function controllingTest(project,record){const id=String(recordValue(record,'TEST_ID')||record?.relationships?.TEST_ID||'');return id?recordsForCurrentScope(project,'tests').find(t=>recordId(t,'tests')===id)||records(project,'tests').find(t=>recordId(t,'tests')===id):null;}
function regressionExecutionDetermination(project,record){
  const phase=upper(recordValue(record,'PHASE')),observed=formalOutcome(recordValue(record,'RESULT')),evidence=evaluateEvidenceContract(project,{result:record});
  if(!evidence.sufficient)return {determination:'UNDETERMINED',reasons:evidence.reasons,evidence};
  if(phase==='PRE_CORRECTION')return observed==='VIOLATED'?{determination:'SATISFIED',reasons:[],evidence}:{determination:observed==='UNDETERMINED'?'UNDETERMINED':'VIOLATED',reasons:['Pre-correction regression execution did not demonstrate the required failure.'],evidence};
  return observed==='SATISFIED'?{determination:'SATISFIED',reasons:[],evidence}:{determination:observed==='VIOLATED'?'VIOLATED':'UNDETERMINED',reasons:['Post-correction regression execution did not establish success.'],evidence};
}
function evaluateResultConsistency(project,collection,record,test=null){
  test=test||controllingTest(project,record);const claim=claimedDetermination(collection,record),reasons=[],evidence=evaluateEvidenceContract(project,{test,result:record}),claimOutcome=formalOutcome(claim);let observed=formalOutcome(recordValue(record,'OBSERVED_RESULT')||recordValue(record,'ACTUAL_RESULT'));
  if(collection==='regressionExecutions')return regressionExecutionDetermination(project,record);
  if(collection==='failureTests'){const outcome=upper(recordValue(record,'EXECUTION_OUTCOME'));if(outcome==='REJECTED_INVALID')return {determination:'SATISFIED',reasons:[],evidence};if(outcome==='ACCEPTED_INVALID')return {determination:'VIOLATED',reasons:['Known-invalid fixture was accepted.'],evidence};return {determination:'UNDETERMINED',reasons:['Mutation execution is not determinately rejected.'],evidence};}
  if(collection==='preflightRecords'){
    for(const key of ['MULTIPLE_INTERPRETATIONS','UNDEFINED_OBJECTS','UNSUPPLIED_DEPENDENCIES','INTERNAL_CONFLICTS','UNAVAILABLE_CAPABILITIES','FINDINGS'])if(materialValue(recordValue(record,key)))reasons.push(`${key} establishes an unresolved preflight defect.`);
    for(const key of ['OBJECTIVELY_VERIFIABLE','RESPONSIBLE_OPERATION_ASSIGNED','ORDER_CLEAR','FAILURE_BEHAVIOR_DEFINED'])if(falsey(recordValue(record,key)))reasons.push(`${key} is false.`);
  }
  if(collection==='confirmationRecords'){
    const iterationId=String(recordValue(record,'CONFIRMATION_ITERATION_ID')||record.relationships?.CONFIRMATION_ITERATION_ID||''),ev=evaluateIteration(project,iterationId,'UNCHANGED_CONFIRMATION');if(!ev.complete)reasons.push(...ev.reasons);
    for(const key of ['NEW_DEFECTS','NEW_REQUIREMENTS','NEW_FAILURE_CASES','NEW_VARIANCE'])if(materialValue(recordValue(record,key)))reasons.push(`${key} is nonzero/nonempty.`);
    if(falsey(recordValue(record,'ZERO_MATERIAL_CHANGES')))reasons.push('ZERO_MATERIAL_CHANGES is false.');
  }
  if(collection==='products'){
    if(materialValue(recordValue(record,'FAILURES')))reasons.push('Production execution reports failures.');
    if(materialValue(recordValue(record,'DEVIATIONS')))reasons.push('Production execution reports deviations requiring controlled disposition.');
    if(reasons.length)return {determination:'VIOLATED',reasons,evidence};return {determination:claim==='COMPLETED'?'SATISFIED':'UNDETERMINED',reasons:claim==='COMPLETED'?[]:['Product execution is not completed.'],evidence};
  }
  if(collection==='meaningResults'&&materialValue(recordValue(record,'UNDETERMINED_REASON')))reasons.push('Meaning review contains an undetermined reason.');
  if(collection==='adversarialResults'&&['CRITICAL','MAJOR','MANDATORY'].includes(upper(recordValue(record,'SEVERITY')))&&observed==='VIOLATED')reasons.push('Adversarial observation establishes a release-material failure.');
  if(collection==='representationInspections'&&observed==='VIOLATED')reasons.push('Representation observation establishes failure.');
  if(collection==='processAudits'){
    if(truth(recordValue(record,'UNAUTHORIZED_MODIFICATION')))reasons.push('Unauthorized modification is present.');
    for(const key of ['APPROVED_INPUTS_VS_ACTUAL','APPROVED_INSTRUCTION_VS_ACTUAL','APPROVED_TOOLS_VS_ACTUAL','REQUIRED_TESTS_VS_EXECUTED','CHAIN_OF_CUSTODY'])if(['VIOLATED','FAILED','FAIL','MISMATCH','MISSING','BROKEN','FALSE','NO'].includes(upper(recordValue(record,key))))reasons.push(`${key} is not satisfied.`);
    for(const key of ['PROCESS_DEFECTS','BLOCKERS'])if(materialValue(recordValue(record,key)))reasons.push(`${key} is nonempty.`);
  }
  if(collection==='productAudits'){
    if(Number(recordValue(record,'CRITICAL_DEFECTS')||0)>0||Number(recordValue(record,'MAJOR_DEFECTS')||0)>0||Number(recordValue(record,'MANDATORY_UNKNOWNS')||0)>0)reasons.push('Product audit application counts contain material defects or mandatory unknowns.');
    for(const key of ['VALIDATOR_RESULTS','MEANING_VERIFICATION_RESULTS'])if(['VIOLATED','FAILED','FAIL','UNDETERMINED','MISSING'].includes(upper(recordValue(record,key))))reasons.push(`${key} is not satisfied.`);
    for(const key of ['PRODUCT_DEFECTS','BLOCKERS'])if(materialValue(recordValue(record,key)))reasons.push(`${key} is nonempty.`);
  }
  if(observed==='VIOLATED')reasons.push('Observed result is a failure while the submitted conclusion may be favorable.');
  if(observed==='UNDETERMINED')reasons.push('Observed result is undetermined.');
  if(test&&String(recordValue(record,'OBSERVED_RESULT')||recordValue(record,'ACTUAL_RESULT')||'').trim()){
    const raw=upper(recordValue(record,'OBSERVED_RESULT')||recordValue(record,'ACTUAL_RESULT')),expected=upper(recordValue(test,'EXPECTED_RESULT')),failure=upper(recordValue(test,'FAILURE_CONDITION'));if(failure&&raw===failure)reasons.push('Observed result exactly matches the test failure condition.');if(expected&&raw===expected)observed='SATISFIED';
  }
  if(collection==='verification'){
    const reqId=String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||''),req=records(project,'requirements').find(r=>recordId(r,'requirements')===reqId),mandatory=req&&upper(recordValue(req,'MANDATORY_OPTIONAL_STATUS'))==='MANDATORY',ind=evaluateContextIndependence(project,{role:'VERIFICATION',iterationId:record.scope?.iterationId,runId:String(recordValue(record,'RUN_ID')||record.relationships?.RUN_ID||''),verifierContextId:String(recordValue(record,'VERIFIER_CONTEXT_ID')||'')});if(mandatory&&ind.determination!=='APPLICATION_ESTABLISHED')reasons.push('Mandatory verification independence is not application-established.');else if(ind.determination==='VIOLATED'||ind.determination==='UNKNOWN')reasons.push(...ind.reasons);
  }
  if(reasons.length)return {determination:reasons.some(x=>/failure|violat|defect|unauthorized|mismatch|broken|false|nonempty/i.test(x))?'VIOLATED':'UNDETERMINED',reasons,evidence,claimedDetermination:claim};
  if(claimOutcome==='VIOLATED')return {determination:'VIOLATED',reasons:['Submitted conclusion reports failure.'],evidence,claimedDetermination:claim};
  if(claimOutcome==='UNDETERMINED'||!claimOutcome)return {determination:'UNDETERMINED',reasons:['No application-adjudicable satisfied conclusion exists.'],evidence,claimedDetermination:claim};
  if(!evidence.sufficient)return {determination:'UNDETERMINED',reasons:evidence.reasons,evidence,claimedDetermination:claim};
  return {determination:'SATISFIED',reasons:[],evidence,claimedDetermination:claim};
}
function effectiveDetermination(project,collection,record,test=null){return evaluateResultConsistency(project,collection,record,test).determination;}
function validateTraceIntegrity(project,kind,record){
  const reasons=[],evidence=evaluateEvidenceContract(project,{result:record});
  if(kind==='RCA'){
    const defectId=String(recordValue(record,'DEFECT_ID')||record.relationships?.DEFECT_ID||'');if(!records(project,'defects').some(d=>recordId(d,'defects')===defectId&&isActiveRecord(d)))reasons.push('RCA defect identity does not resolve to the current defect.');for(const key of ['LAYER_TRACE','EARLIEST_DEFECTIVE_LAYER','ROOT_CAUSE','DOWNSTREAM_INVALIDATION'])if(!String(recordValue(record,key)||'').trim())reasons.push(`RCA lacks ${key}.`);if(!evidence.sufficient)reasons.push(...evidence.reasons);
  }else if(kind==='CHANGE'){
    const ids=[...String(recordValue(record,'TRIGGERING_DEFECT_IDS')||'').matchAll(/DEFECT-[A-Za-z0-9_-]+/g)].map(x=>x[0]);if(!ids.length)reasons.push('Changeset lacks triggering defect identity.');for(const id of ids){const rca=records(project,'rootCauses').find(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===id&&isActiveRecord(r));if(!rca)reasons.push(`No current RCA resolves for ${id}.`);else if(upper(recordValue(rca,'EARLIEST_DEFECTIVE_LAYER'))!==upper(recordValue(record,'RESPONSIBLE_LAYER'))&&!String(recordValue(record,'AUTHORIZATION')||'').trim())reasons.push(`Changeset responsible layer does not match RCA for ${id} and has no controlled override.`);}for(const key of ['RESPONSIBLE_LAYER','OLD_ARTIFACT_VERSION','EXACT_MODIFICATION','NEW_ARTIFACT_VERSION','DOWNSTREAM_INVALIDATION','REQUIRED_RERUNS'])if(!String(recordValue(record,key)||'').trim())reasons.push(`Changeset lacks ${key}.`);if(String(recordValue(record,'OLD_ARTIFACT_VERSION')||'')===String(recordValue(record,'NEW_ARTIFACT_VERSION')||''))reasons.push('Changeset modifies an artifact version in place.');
  }
  return {valid:reasons.length===0,reasons};
}
function comparisonFacts(project,requirementIdValue,iterationId){
  const matrix=verificationMatrix(project,iterationId),runs=matrix.runs,rows=matrix.verification.filter(r=>String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')===String(requirementIdValue)),runDeterminations={};for(const run of runs){const runId=recordId(run,'runs'),rr=rows.filter(r=>String(recordValue(r,'RUN_ID')||r.relationships?.RUN_ID||'')===runId),states=rr.map(r=>effectiveDetermination(project,'verification',r,controllingTest(project,r)));runDeterminations[runId]=states.includes('VIOLATED')?'VIOLATED':states.includes('UNDETERMINED')||!states.length?'UNDETERMINED':'SATISFIED';}const values=Object.values(runDeterminations);return {RUN_DETERMINATIONS:runDeterminations,ALL_TEN_SATISFIED:runs.length===10&&values.every(v=>v==='SATISFIED'),ANY_VIOLATION:values.includes('VIOLATED'),ANY_UNDETERMINED:values.includes('UNDETERMINED')};
}'''

# Replace evidence function while preserving a single evidenceReferences declaration.
start=s.find('function evidenceReferences(result)')
end=s.find('function evidenceChainExplanation', start)
if start<0 or end<0: raise RuntimeError('evidence semantic section markers missing')
# Preserve evidenceChainExplanation and everything after it; replace evidenceReferences + evidence sufficiency only, while retaining any functions between sufficiency and chain explanation by locating old sufficiency end.
old_start=s.find('function evaluateEvidenceSufficiency',start)
brace=s.find('{',old_start); depth=0; quote=None; esc=False; i=brace
while i<len(s):
    ch=s[i]
    if quote:
        if esc: esc=False
        elif ch=='\\': esc=True
        elif ch==quote: quote=None
    else:
        if ch in "'\"`": quote=ch
        elif ch=='{': depth+=1
        elif ch=='}':
            depth-=1
            if depth==0: break
    i+=1
s=s[:start]+semantic+s[i+1:]

verification=r'''function verificationMatrix(project,iterationId){
  const scope=scopeForIteration(project,iterationId),requirements=mandatoryRequirements(project,scope),runs=recordsForIteration(project,'runs',iterationId).filter(r=>runIterationId(r)===String(iterationId||'')),verification=recordsForIteration(project,'verification',iterationId),expected=[];
  for(const req of requirements)for(const test of applicableTests(project,req,scope))for(const run of runs)expected.push([requirementId(req),recordId(run,'runs'),recordId(test,'tests')].join('|'));
  const expectedSet=new Set(expected),counts=new Map();for(const r of verification){const key=verificationKey(r);counts.set(key,(counts.get(key)||0)+1);}
  const missing=expected.filter(k=>!counts.has(k)),duplicates=[...counts].filter(([k,c])=>expectedSet.has(k)&&c!==1).map(([key,count])=>({key,count}));
  const invalid=verification.filter(r=>{const key=verificationKey(r),test=controllingTest(project,r),effective=evaluateResultConsistency(project,'verification',r,test);return !expectedSet.has(key)||!['SATISFIED','VIOLATED','UNDETERMINED'].includes(effective.determination)||effective.determination==='UNDETERMINED';});
  return {scope,requirements,runs,verification,expected,counts,missing,duplicates,invalid,coverage:expected.length?expected.filter(k=>counts.get(k)===1).length/expected.length:0};
}'''
s=replace_function(s,'verificationMatrix',verification)

# Regression resolution consumes phase-aware effective outcome.
old="return executions.length===1&&['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(executions[0],'RESULT')));"
if old not in s: raise RuntimeError('regression resolution expression missing')
s=s.replace(old,"return executions.length===1&&regressionExecutionDetermination(project,executions[0]).determination==='SATISFIED';",1)

# Stage 7 controlled outcome and central semantic gates.
s=s.replace("if(!String(recordValue(mutation,'ACTUAL_RESULT')||'').trim())reasons.push(recordId(mutation,'failureTests')+': actual execution result is missing.');if(!String(recordValue(mutation,'EVIDENCE')||'').trim()&&!safe(mutation.evidenceRefs).length)reasons.push(recordId(mutation,'failureTests')+': execution evidence is missing.');if(truth(recordValue(mutation,'ACTUAL_RESULT'))&&upper(recordValue(mutation,'EXPECTED_REJECTION')).includes('REJECT')&&!String(recordValue(mutation,'VALIDATOR_DEFECT_ID')||mutation.relationships?.VALIDATOR_DEFECT_ID||'').trim())reasons.push('A known-invalid fixture was accepted without a linked validator defect.');",
"if(!String(recordValue(mutation,'ACTUAL_RESULT')||'').trim())reasons.push(recordId(mutation,'failureTests')+': actual execution result is missing.');const outcome=upper(recordValue(mutation,'EXECUTION_OUTCOME'));if(!['REJECTED_INVALID','ACCEPTED_INVALID','UNDETERMINED','NOT_RUN'].includes(outcome))reasons.push(recordId(mutation,'failureTests')+': controlled EXECUTION_OUTCOME is missing or invalid.');const adjudicated=evaluateResultConsistency(project,'failureTests',mutation);if(adjudicated.determination!=='SATISFIED'&&outcome!=='ACCEPTED_INVALID')reasons.push(recordId(mutation,'failureTests')+': invalid-fixture rejection is not established.');if(outcome==='ACCEPTED_INVALID'&&!String(recordValue(mutation,'VALIDATOR_DEFECT_ID')||mutation.relationships?.VALIDATOR_DEFECT_ID||'').trim())reasons.push('A known-invalid fixture was accepted without a linked validator defect.');")

s=s.replace("if(collection('preflightRecords').some(record=>['VIOLATED','UNDETERMINED','BLOCKED','REJECTED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Instruction preflight contains an unresolved material finding.');","if(collection('preflightRecords').some(record=>effectiveDetermination(project,'preflightRecords',record)!=='SATISFIED'))reasons.push('Instruction preflight contains an unresolved or insufficiently evidenced material finding.');")

stage13_old="requireAccepted();const reqs=mandatoryRequirements(project),compared=new Set(collection('comparisons').map(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')));\n      const missing=reqs.filter(req=>!compared.has(requirementId(req))).map(requirementId);\n      if(missing.length)reasons.push(`Cross-run comparison is missing for: ${missing.join(', ')}.`);"
stage13_new="requireAccepted();const reqs=mandatoryRequirements(project),iteration=latestIteration(project,[10,17,19]),iterationId=recordId(iteration,'iterations'),compared=new Map(collection('comparisons').map(record=>[String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||''),record]));\n      const missing=reqs.filter(req=>!compared.has(requirementId(req))).map(requirementId);\n      if(missing.length)reasons.push(`Cross-run comparison is missing for: ${missing.join(', ')}.`);for(const req of reqs){const id=requirementId(req),facts=comparisonFacts(project,id,iterationId),record=compared.get(id);if(!record)continue;if(Boolean(recordValue(record,'ALL_TEN_SATISFIED'))!==facts.ALL_TEN_SATISFIED||Boolean(recordValue(record,'ANY_VIOLATION'))!==facts.ANY_VIOLATION||Boolean(recordValue(record,'ANY_UNDETERMINED'))!==facts.ANY_UNDETERMINED)reasons.push(`Comparison ${id} does not match the application-derived verification matrix.`);}"
if stage13_old not in s: raise RuntimeError('stage13 body not found')
s=s.replace(stage13_old,stage13_new,1)

stage14_old="requireAccepted();const defects=confirmedDefects(project),analysed=new Set(all('rootCauses').map(record=>String(recordValue(record,'DEFECT_ID')||record.relationships?.DEFECT_ID||'')));\n      const missing=defects.filter(defect=>!analysed.has(recordId(defect,'defects'))).map(defect=>recordId(defect,'defects'));\n      if(missing.length)reasons.push(`Root-cause analysis is missing for: ${missing.join(', ')}.`);"
stage14_new="requireAccepted();const defects=confirmedDefects(project),analysed=new Map(all('rootCauses').map(record=>[String(recordValue(record,'DEFECT_ID')||record.relationships?.DEFECT_ID||''),record]));\n      const missing=defects.filter(defect=>!analysed.has(recordId(defect,'defects'))).map(defect=>recordId(defect,'defects'));\n      if(missing.length)reasons.push(`Root-cause analysis is missing for: ${missing.join(', ')}.`);for(const record of analysed.values()){const check=validateTraceIntegrity(project,'RCA',record);if(!check.valid)reasons.push(...check.reasons.map(reason=>`${recordId(record,'rootCauses')}: ${reason}`));}"
if stage14_old not in s: raise RuntimeError('stage14 body not found')
s=s.replace(stage14_old,stage14_new,1)

s=s.replace("case 16:requireAccepted();if(confirmedDefects(project).length&&!collection('changes').length)reasons.push('A responsible-layer changeset or blocker is required for confirmed defects.');break;","case 16:requireAccepted();if(confirmedDefects(project).length&&!collection('changes').length)reasons.push('A responsible-layer changeset or blocker is required for confirmed defects.');for(const change of collection('changes')){const check=validateTraceIntegrity(project,'CHANGE',change);if(!check.valid)reasons.push(...check.reasons.map(reason=>`${recordId(change,'changes')}: ${reason}`));}break;")

s=s.replace("if(collection('confirmationRecords').some(r=>upper(recordValue(r,'DETERMINATION'))!=='SATISFIED'))reasons.push('Unchanged confirmation is not affirmatively satisfied.');","if(collection('confirmationRecords').some(r=>effectiveDetermination(project,'confirmationRecords',r)!=='SATISFIED'))reasons.push('Unchanged confirmation is not application-adjudicated SATISFIED.');")
s=s.replace("const confirmations=recordsForCurrentScope(project,'confirmationRecords').filter(record=>upper(recordValue(record,'DETERMINATION'))==='SATISFIED')","const confirmations=recordsForCurrentScope(project,'confirmationRecords').filter(record=>effectiveDetermination(project,'confirmationRecords',record)==='SATISFIED')")

# Stage 21 product execution adjudication.
needle="if(upper(recordValue(product,'STATUS'))!=='COMPLETED'||product?.completionState!=='COMPLETED')reasons.push('The reserved product execution has not been completed by an accepted Stage 21 response.');"
if needle not in s: raise RuntimeError('stage21 status check missing')
s=s.replace(needle,needle+"if(product&&effectiveDetermination(project,'products',product)!=='SATISFIED')reasons.push('Product execution contains unresolved failures or deviations.');",1)

# Result gates use effective determination.
for collection in ['deterministicResults','meaningResults','adversarialResults','representationInspections']:
    s=s.replace(f"if(results.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))",f"if(results.some(record=>effectiveDetermination(project,'{collection}',record,controllingTest(project,record))!=='SATISFIED'))") if collection!='representationInspections' else s
s=s.replace("if(inspections.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))","if(inspections.some(record=>effectiveDetermination(project,'representationInspections',record)!=='SATISFIED'))")
s=s.replace("if(collection('processAudits').some(record=>upper(recordValue(record,'PROCESS_DETERMINATION'))!=='SATISFIED'))","if(collection('processAudits').some(record=>effectiveDetermination(project,'processAudits',record)!=='SATISFIED'))")
s=s.replace("if(collection('productAudits').some(record=>upper(recordValue(record,'PRODUCT_DETERMINATION'))!=='SATISFIED'))","if(collection('productAudits').some(record=>effectiveDetermination(project,'productAudits',record)!=='SATISFIED'))")

# Stage 15 pre-correction requires phase-aware adjudication.
pattern=re.compile(r"if\(!executions\.some\(e=>String\(recordValue\(e,'REG_ID'\).*?evaluateEvidenceSufficiency\(project,\{result:e\}\)\.sufficient\)\)reasons\.push\('Regression '\+id\+' lacks an actual sufficiently evidenced pre-correction failing execution\.'\);",re.S)
m=pattern.search(s)
if not m: raise RuntimeError('stage15 regression expression not found')
s=s[:m.start()]+"if(!executions.some(e=>String(recordValue(e,'REG_ID')||e.relationships?.REG_ID||'')===id&&upper(recordValue(e,'PHASE'))==='PRE_CORRECTION'&&regressionExecutionDetermination(project,e).determination==='SATISFIED'))reasons.push('Regression '+id+' lacks an actual sufficiently evidenced pre-correction failing execution.');"+s[m.end():]

# Replace contradiction detector to delegate within-record semantic contradictions, preserving cross-record/material identity checks.
contradictions=r'''function detectCurrentContradictions(project){
  const out=[],push=(type,key,details,severity='RELEASE_MATERIAL')=>out.push({type,key,details,severity});
  const conclusionCollections=['preflightRecords','verification','regressionExecutions','confirmationRecords','products','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits'];
  for(const collection of conclusionCollections)for(const record of recordsForCurrentScope(project,collection)){const claim=formalOutcome(claimedDetermination(collection,record)),effective=effectiveDetermination(project,collection,record,controllingTest(project,record));if(claim==='SATISFIED'&&effective!=='SATISFIED')push('WITHIN_RECORD_CONTRADICTION',`${collection}:${recordId(record,collection)}`,[`claimed=${claimedDetermination(collection,record)}`,`effective=${effective}`]);}
  const groups=new Map();for(const r of recordsForCurrentScope(project,'verification')){const key=verificationKey(r),d=effectiveDetermination(project,'verification',r,controllingTest(project,r));if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(d);}for(const [key,ds] of groups)if(ds.size>1)push('VERIFICATION_DETERMINATION_CONFLICT',key,[...ds]);
  const det=recordsForCurrentScope(project,'deterministicResults'),meaning=recordsForCurrentScope(project,'meaningResults'),adv=recordsForCurrentScope(project,'adversarialResults');for(const m of meaning){const req=resultRequirementId(project,m),md=effectiveDetermination(project,'meaningResults',m,controllingTest(project,m));if(md==='VIOLATED'&&det.some(d=>resultRequirementId(project,d)===req&&effectiveDetermination(project,'deterministicResults',d,controllingTest(project,d))==='SATISFIED'))push('DETERMINISTIC_MEANING_CONFLICT',req,['DETERMINISTIC SATISFIED','MEANING VIOLATED']);if(md==='SATISFIED'&&adv.some(a=>resultRequirementId(project,a)===req&&effectiveDetermination(project,'adversarialResults',a,controllingTest(project,a))==='VIOLATED'&&['CRITICAL','MAJOR','MANDATORY'].includes(upper(recordValue(a,'SEVERITY')))))push('MEANING_ADVERSARIAL_CONFLICT',req,['MEANING SATISFIED','MANDATORY ADVERSARIAL VIOLATION']);}
  const artifacts=new Map();for(const a of recordsForCurrentScope(project,'artifacts')){const id=recordId(a,'artifacts'),sig=[recordValue(a,'VERSION'),recordValue(a,'BYTE_SIZE'),recordValue(a,'SHA256')].join('|');if(artifacts.has(id)&&artifacts.get(id)!==sig)push('ARTIFACT_IDENTITY_CONFLICT',id,[artifacts.get(id),sig]);else artifacts.set(id,sig);}
  const product=recordsForCurrentScope(project,'products').at(-1),baseline=recordsForCurrentScope(project,'baselines').at(-1);if(product&&baseline&&String(recordValue(product,'BASELINE_ID')||product.relationships?.BASELINE_ID||'')!==recordId(baseline,'baselines'))push('PRODUCT_BASELINE_CONFLICT',recordId(product,'products'),['Product baseline differs from current baseline.']);
  const release=recordsForCurrentScope(project,'releaseRecords').at(-1);if(release&&upper(recordValue(release,'DETERMINATION'))==='ACCEPTED'){if(openBlockers(project).length)push('ACCEPTED_RELEASE_WITH_BLOCKER',recordId(release,'releaseRecords'),openBlockers(project).map(x=>recordId(x,'blockers')));if(unresolvedMaterialDefects(project).length)push('ACCEPTED_RELEASE_WITH_DEFECT',recordId(release,'releaseRecords'),unresolvedMaterialDefects(project).map(x=>recordId(x,'defects')));}
  return out;
}'''
s=replace_function(s,'detectCurrentContradictions',contradictions)

release=r'''function releaseMetrics(project){
  const requirements=mandatoryRequirements(project),tests=recordsForCurrentScope(project,'tests'),deterministic=recordsForCurrentScope(project,'deterministicResults'),meaning=recordsForCurrentScope(project,'meaningResults'),adversarial=recordsForCurrentScope(project,'adversarialResults'),inspections=recordsForCurrentScope(project,'representationInspections'),processAudits=recordsForCurrentScope(project,'processAudits'),productAudits=recordsForCurrentScope(project,'productAudits'),blockers=openBlockers(project),defects=unresolvedMaterialDefects(project),regressions=records(project,'regressions').filter(r=>upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED'),regExec=recordsForCurrentScope(project,'regressionExecutions');
  const effective=(collection,record)=>effectiveDetermination(project,collection,record,controllingTest(project,record)),allResults=[...deterministic.map(r=>['deterministicResults',r]),...meaning.map(r=>['meaningResults',r]),...adversarial.map(r=>['adversarialResults',r]),...inspections.map(r=>['representationInspections',r])],failed=allResults.filter(([c,r])=>effective(c,r)==='VIOLATED').map(([,r])=>r),unknown=allResults.filter(([c,r])=>effective(c,r)==='UNDETERMINED').map(([,r])=>r);let satisfied=0,violated=0,undetermined=0;
  for(const req of requirements){const reqId=requirementId(req),expected=tests.filter(t=>testRequirementId(t)===reqId&&!['RETIRED','BLOCKED','NOT READY'].includes(upper(recordValue(t,'STATUS')||'READY'))),groups=expected.map(test=>{const id=recordId(test,'tests'),type=upper(recordValue(test,'TEST_TYPE'));const source=type==='MEANING'?meaning:type==='ADVERSARIAL'?adversarial:deterministic;return source.filter(r=>String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')===id);}),states=groups.flatMap(group=>group.map(r=>{const c=meaning.includes(r)?'meaningResults':adversarial.includes(r)?'adversarialResults':'deterministicResults';return effective(c,r);}));if(states.includes('VIOLATED'))violated++;else if(expected.length>0&&groups.every(group=>group.length===1)&&states.length===expected.length&&states.every(x=>x==='SATISFIED'))satisfied++;else undetermined++;}
  const successfulRegs=new Set(regExec.filter(r=>upper(recordValue(r,'PHASE'))!=='PRE_CORRECTION'&&regressionExecutionDetermination(project,r).determination==='SATISFIED').map(r=>String(recordValue(r,'REG_ID')||r.relationships?.REG_ID||''))),regressionOk=regressions.every(r=>successfulRegs.has(recordId(r,'regressions'))),auditsOk=processAudits.length===1&&productAudits.length===1&&effective('processAudits',processAudits[0])==='SATISFIED'&&effective('productAudits',productAudits[0])==='SATISFIED',confirmation=recordsForCurrentScope(project,'confirmationRecords').at(-1),confirmationOk=Boolean(confirmation)&&effectiveDetermination(project,'confirmationRecords',confirmation)==='SATISFIED',criticalDefects=defects.filter(d=>upper(recordValue(d,'SEVERITY'))==='CRITICAL').length,majorDefects=defects.filter(d=>upper(recordValue(d,'SEVERITY'))==='MAJOR').length,contradictions=detectCurrentContradictions(project).filter(x=>x.severity==='RELEASE_MATERIAL').length;
  let determination='ACCEPTED';if(violated||failed.length||criticalDefects||majorDefects)determination='REJECTED';else if(undetermined||unknown.length||blockers.length||!regressionOk||!auditsOk||!confirmationOk||contradictions)determination='BLOCKED';
  return {mandatoryRequirementCount:requirements.length,satisfied,violated,undetermined,failedValidators:failed.length,unknownValidators:unknown.length,criticalDefects,majorDefects,blockers:blockers.length,regressionOk,auditsOk,confirmationOk,contradictions,determination};
}'''
s=replace_function(s,'releaseMetrics',release)

# Convergence must use effective verification and regression outcomes.
conv_start=s.find('function convergenceMetrics(')
if conv_start<0: raise RuntimeError('convergenceMetrics missing')
# targeted replacements inside function are safer than whole recreation
s=s.replace("const mandatoryUnresolvedUnknowns=metrics.matrix.verification.filter(r=>upper(recordValue(r,'DETERMINATION'))==='UNDETERMINED').length","const mandatoryUnresolvedUnknowns=metrics.matrix.verification.filter(r=>effectiveDetermination(project,'verification',r,controllingTest(project,r))==='UNDETERMINED').length")
s=s.replace("const passedReg=new Set(regressionExecutions.filter(r=>['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(r,'RESULT')))).map(r=>String(recordValue(r,'REG_ID')||r.relationships?.REG_ID||'')))","const passedReg=new Set(regressionExecutions.filter(r=>upper(recordValue(r,'PHASE'))!=='PRE_CORRECTION'&&regressionExecutionDetermination(project,r).determination==='SATISFIED').map(r=>String(recordValue(r,'REG_ID')||r.relationships?.REG_ID||'')))")

# Export semantic authority helpers.
export_needle='evaluateContextIndependence,evaluateEvidenceSufficiency,detectCurrentContradictions'
if export_needle not in s: raise RuntimeError('engine export anchor missing')
s=s.replace(export_needle,'evaluateContextIndependence,evaluateEvidenceContract,evaluateEvidenceSufficiency,evaluateResultConsistency,effectiveDetermination,validateTraceIntegrity,comparisonFacts,regressionExecutionDetermination,detectCurrentContradictions',1)
p.write_text(s)

# Minimal Stage 7 controlled enum schema compatibility patch.
sp=Path('workflow-schema.js'); w=sp.read_text()
w=w.replace('"VIOLATION_MODE",\n      "FIXTURE",\n      "EXPECTED_REJECTION",\n      "ACTUAL_RESULT",\n      "EVIDENCE"','"VIOLATION_MODE",\n      "FIXTURE",\n      "EXPECTED_REJECTION",\n      "ACTUAL_RESULT",\n      "EXECUTION_OUTCOME",\n      "EVIDENCE"',1)
w=w.replace("'MUTATION_ID','REQ_ID','VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','VALIDATOR_DEFECT_ID','EVIDENCE'","'MUTATION_ID','REQ_ID','VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','EXECUTION_OUTCOME','VALIDATOR_DEFECT_ID','EVIDENCE'",1)
w=w.replace("required:['VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','EVIDENCE']","required:['VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','EXECUTION_OUTCOME','EVIDENCE']",1)
override="  'MUTATION':Object.freeze({EXECUTION_OUTCOME:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['REJECTED_INVALID','ACCEPTED_INVALID','UNDETERMINED','NOT_RUN']),nullable:false,normalizerKey:null,closedProperties:null})}),\n"
anchor="const RECORD_FIELD_TYPE_OVERRIDES=Object.freeze({\n"
if anchor not in w: raise RuntimeError('schema override anchor missing')
w=w.replace(anchor,anchor+override,1)
sp.write_text(w)

# Update deterministic fixtures that directly create Stage 7 responses/records to provide the controlled outcome.
for filename in ['test-fixtures.mjs','verify-ingestion.mjs','verify-complete.mjs','verify-full-cycle.mjs']:
    fp=Path(filename)
    if not fp.exists(): continue
    t=fp.read_text()
    # Where ACTUAL_RESULT explicitly represents rejection in fixtures, add enum. This is intentionally lexical only in test fixtures.
    t=re.sub(r"ACTUAL_RESULT:('(?:REJECTED|VIOLATED|FAILED)'|\"(?:REJECTED|VIOLATED|FAILED)\")",lambda m:f"ACTUAL_RESULT:{m.group(1)},EXECUTION_OUTCOME:'REJECTED_INVALID'",t)
    t=re.sub(r"ACTUAL_RESULT:('(?:ACCEPTED|SATISFIED|PASSED)'|\"(?:ACCEPTED|SATISFIED|PASSED)\")",lambda m:f"ACTUAL_RESULT:{m.group(1)},EXECUTION_OUTCOME:'ACCEPTED_INVALID'",t)
    fp.write_text(t)

# Universal false-acceptance invariant test.
test=Path('verify-semantic-adjudication.mjs')
test.write_text(r'''import fs from 'node:fs';import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,schema=globalThis.closedLoopWorkflowSchema;const assert=(v,m)=>{if(!v)throw new Error(m);};
const p=core.createBlankState('JOB-SEMANTIC-INVARIANT');p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);
const rec=(collection,stage,fields)=>{const d=schema.RECORD_SCHEMAS[collection],id=`${d.prefix}-SEM`;return {id,stage,active:true,scope:{inputVersion:'INPUT-v001'},fields:{[d.idField]:id,...fields},...fields};};
const cases=[
 ['preflightRecords',rec('preflightRecords',9,{DETERMINATION:'SATISFIED',MULTIPLE_INTERPRETATIONS:'TRUE'})],
 ['verification',rec('verification',12,{DETERMINATION:'SATISFIED',OBSERVED_RESULT:'FAILED'})],
 ['confirmationRecords',rec('confirmationRecords',19,{DETERMINATION:'SATISFIED',NEW_DEFECTS:'TRUE'})],
 ['products',rec('products',21,{STATUS:'COMPLETED',FAILURES:'FAILED'})],
 ['deterministicResults',rec('deterministicResults',22,{DETERMINATION:'SATISFIED',ACTUAL_RESULT:'FAILED'})],
 ['meaningResults',rec('meaningResults',23,{DETERMINATION:'SATISFIED',UNDETERMINED_REASON:'meaning not established'})],
 ['adversarialResults',rec('adversarialResults',24,{DETERMINATION:'SATISFIED',ACTUAL_RESULT:'FAILED',SEVERITY:'MAJOR'})],
 ['representationInspections',rec('representationInspections',25,{DETERMINATION:'SATISFIED',OBSERVATIONS:'FAILED'})],
 ['processAudits',rec('processAudits',26,{PROCESS_DETERMINATION:'SATISFIED',UNAUTHORIZED_MODIFICATION:'TRUE'})],
 ['productAudits',rec('productAudits',26,{PRODUCT_DETERMINATION:'SATISFIED',CRITICAL_DEFECTS:1})]
];
for(const [collection,record] of cases){const d=engine.effectiveDetermination(p,collection,record);assert(d!=='SATISFIED',`${collection} contradictory favorable verdict remained SATISFIED`);}
const evidenceOnly=rec('deterministicResults',22,{DETERMINATION:'SATISFIED',ACTUAL_RESULT:'PASSED',EVIDENCE:'x'});assert(engine.evaluateEvidenceContract(p,{result:evidenceOnly}).sufficient===false,'Bare narrative evidence established sufficiency.');assert(engine.effectiveDetermination(p,'deterministicResults',evidenceOnly)!=='SATISFIED','Bare narrative evidence established SATISFIED.');
const mutation=rec('failureTests',7,{ACTUAL_RESULT:'INVALID FIXTURE ACCEPTED',EXECUTION_OUTCOME:'ACCEPTED_INVALID'});assert(engine.effectiveDetermination(p,'failureTests',mutation)==='VIOLATED','Controlled Stage 7 accepted-invalid outcome was not violated.');
assert(engine.applicationTestCapabilities().length===0,'Native executor registry was broadened without an implemented executor.');
const source=fs.readFileSync('workflow-engine.js','utf8');for(const token of ["effectiveDetermination(project,'deterministicResults'","effectiveDetermination(project,'meaningResults'","effectiveDetermination(project,'adversarialResults'","effectiveDetermination(project,'processAudits'","effectiveDetermination(project,'productAudits'","regressionExecutionDetermination(project"] )assert(source.includes(token),`Missing semantic routing token ${token}`);
console.log(JSON.stringify({semanticAdjudication:true,contradictoryFavorableVerdictsRejected:cases.length,bareNarrativeRejected:true,stage7ControlledOutcome:true,nativeExecutorRegistryStillEmpty:true}));
''')

# CI: syntax + invariant before Chromium and deployment, and rerun in deploy/publish proof.
wp=Path('.github/workflows/pages.yml'); y=wp.read_text()
y=y.replace('          node --check verify-browser-extra.mjs\n','          node --check verify-browser-extra.mjs\n          node --check verify-semantic-adjudication.mjs\n',1)
y=y.replace('          node verify-ingestion.mjs\n          node verify-complete.mjs\n','          node verify-ingestion.mjs\n          node verify-complete.mjs\n          node verify-semantic-adjudication.mjs\n',1)
y=y.replace('node verify-complete.mjs && node verify-full-cycle.mjs','node verify-complete.mjs && node verify-semantic-adjudication.mjs && node verify-full-cycle.mjs',1)
y=y.replace('          node verify-complete.mjs > /tmp/verify-complete.out\n','          node verify-complete.mjs > /tmp/verify-complete.out\n          node verify-semantic-adjudication.mjs > /tmp/verify-semantic-adjudication.out\n',1)
wp.write_text(y)

# Refresh one shared runtime cache token from exact runtime bytes.
runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']; digest=hashlib.sha256(b''.join(Path(f).read_bytes() for f in runtime)).hexdigest()[:16]
ih=Path('index.html'); h=ih.read_text(); h=re.sub(r'(<script\s+defer\s+src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js)\?v=[^"]+("\s*></script>)',lambda m:m.group(1)+f'?v={digest}'+m.group(2),h); ih.write_text(h)

# Self-remove one-time repair machinery before commit.
Path('.semantic-adjudication-patch.py').unlink(missing_ok=True)
Path('.github/workflows/semantic-adjudication-patch.yml').unlink(missing_ok=True)
