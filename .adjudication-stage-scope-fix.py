from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()

def replace_once(old,new,label):
    global s
    if old in s:
        s=s.replace(old,new,1)
    elif new not in s:
        raise RuntimeError(label+' anchor missing')

def scan_matching_paren(text,start):
    depth=0; quote=None; esc=False; line=False; block=False; i=start
    while i<len(text):
        ch=text[i]; nxt=text[i+1] if i+1<len(text) else ''
        if line:
            if ch=='\n': line=False
        elif block:
            if ch=='*' and nxt=='/': block=False; i+=1
        elif quote:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch==quote: quote=None
        else:
            if ch=='/' and nxt=='/': line=True; i+=1
            elif ch=='/' and nxt=='*': block=True; i+=1
            elif ch in "'\"`": quote=ch
            elif ch=='(': depth+=1
            elif ch==')':
                depth-=1
                if depth==0:return i
        i+=1
    raise RuntimeError('unterminated parameter list')

def body_end(text,start):
    depth=0; quote=None; esc=False; line=False; block=False; i=start
    while i<len(text):
        ch=text[i]; nxt=text[i+1] if i+1<len(text) else ''
        if line:
            if ch=='\n': line=False
        elif block:
            if ch=='*' and nxt=='/': block=False; i+=1
        elif quote:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch==quote: quote=None
        else:
            if ch=='/' and nxt=='/': line=True; i+=1
            elif ch=='/' and nxt=='*': block=True; i+=1
            elif ch in "'\"`": quote=ch
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:return i
        i+=1
    raise RuntimeError('unterminated function')

def replace_function(name,replacement):
    global s
    start=s.find('function '+name+'(')
    if start<0: raise RuntimeError(name+' missing')
    open_paren=s.find('(',start)
    close_paren=scan_matching_paren(s,open_paren)
    brace=s.find('{',close_paren+1)
    if brace<0: raise RuntimeError(name+' body missing')
    end=body_end(s,brace)
    s=s[:start]+replacement+s[end+1:]

# Stage 18 is an iteration-local proposition. Later product/release evidence
# cannot retroactively invalidate an already completed convergence calculation.
anchor="function convergenceMetrics(project){"
if 'function convergenceContradictionCount(' not in s:
    pos=s.find(anchor)
    if pos<0: raise RuntimeError('convergenceMetrics anchor missing')
    helper="""function convergenceContradictionCount(project,iterationId){
  const groups=new Map(),rows=iterationId?recordsForIteration(project,'verification',iterationId):[];
  for(const r of rows){const key=verificationKey(r),e=evaluateResultConsistency('verification',r,testForResult(project,r),project);if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(e.determination);}
  let count=0;
  for(const ds of groups.values())if(ds.size>1)count+=1;
  for(const r of rows){const e=evaluateResultConsistency('verification',r,testForResult(project,r),project);if(e.claimedDetermination==='SATISFIED'&&e.determination!=='SATISFIED')count+=1;}
  return count;
}
"""
    s=s[:pos]+helper+s[pos:]
replace_once("contradictions=detectCurrentContradictions(project).filter(x=>x.severity==='RELEASE_MATERIAL').length","contradictions=convergenceContradictionCount(project,iterationId)",'Stage 18 contradiction reduction')

# Exact candidate-byte identity is a pure application fact and is testable
# independently from the separate authority to freeze a baseline. The canonical
# mutation still requires an application-established unchanged confirmation.
if 'function validateBaselineCandidateArtifacts(' not in s:
    marker='function freezeBaseline(project,'
    pos=s.find(marker)
    if pos<0: raise RuntimeError('freezeBaseline insertion anchor missing')
    helper="""function validateBaselineCandidateArtifacts(project,{artifactIds=[]}={}){
  ensureShape(project);
  const currentIteration=records(project,'iterations').find(r=>recordId(r,'iterations')===String(project.job.CURRENT_ITERATION||'')&&isActiveRecord(r));
  if(!currentIteration||Number(currentIteration.stage)!==19)throw new Error('The current unchanged-confirmation iteration is required before baseline candidate validation.');
  const currentCandidateId=iterationCandidateId(project,recordId(currentIteration,'iterations')),currentCandidate=records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===currentCandidateId&&isActiveRecord(r));
  if(!currentCandidate||!candidateComponentIdentity(project,currentCandidateId))throw new Error('The unchanged-confirmation iteration does not resolve to an active frozen candidate.');
  const manifest=safe(recordValue(currentCandidate,'COMPONENT_MANIFEST')),candidateArtifactIds=manifest.map(item=>String(item?.artifactId||'')).filter(Boolean);
  if(!candidateArtifactIds.length||candidateArtifactIds.length!==manifest.length||new Set(candidateArtifactIds).size!==candidateArtifactIds.length)throw new Error('The confirmed candidate manifest does not contain one unique canonical artifact identity for every component.');
  const requested=[...new Set(safe(artifactIds).map(String))];
  if(requested.length&&hash.sha256Value([...requested].sort())!==hash.sha256Value([...candidateArtifactIds].sort()))throw new Error('Baseline authorization must use the exact artifact set from the unchanged-confirmed frozen candidate.');
  const artifacts=selectedArtifacts(project,candidateArtifactIds),byId=new Map(artifacts.map(a=>[recordId(a,'artifacts'),a]));
  for(const item of manifest){const artifact=byId.get(String(item.artifactId));if(!artifact||String(recordValue(artifact,'FILENAME'))!==String(item.filename)||Number(recordValue(artifact,'BYTE_SIZE'))!==Number(item.byteSize)||String(recordValue(artifact,'SHA256')).toLowerCase()!==String(item.sha256||'').toLowerCase())throw new Error(`Confirmed candidate artifact ${item.artifactId||'UNKNOWN'} no longer matches its frozen filename, byte size, and SHA-256.`);}
  return {currentIteration,currentCandidateId,currentCandidate,manifest,candidateArtifactIds,artifacts};
}
"""
    s=s[:pos]+helper+s[pos:]

freeze="""function freezeBaseline(project,{artifactIds=[],operatorLabel='HUMAN_OPERATOR',authorization='AUTHORIZED'}={}){
  ensureShape(project);
  const selection=validateBaselineCandidateArtifacts(project,{artifactIds});
  const confirmation=recordsForCurrentScope(project,'confirmationRecords').filter(r=>effectiveDetermination('confirmationRecords',r,null,project)==='SATISFIED').at(-1);
  if(!confirmation)throw new Error('A current application-established successful unchanged confirmation is required before baseline freeze.');
  const {currentIteration,currentCandidateId,artifacts}=selection;
  const baselineId=allocateId(project,'baselines'),createdAt=now(),approvedVersions={inputVersion:project.job.CURRENT_INPUT_VERSION,sourceSetVersion:project.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:project.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:project.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:project.job.CURRENT_INSTRUCTION_VERSION,iterationId:recordId(currentIteration,'iterations'),candidateId:currentCandidateId,hashes:Object.fromEntries(artifacts.map(a=>[recordId(a,'artifacts'),recordValue(a,'SHA256')]))};
  const fields={BASELINE_ID:baselineId,SUPPORTING_CONFIRMATION_ID:recordId(confirmation,'confirmationRecords'),APPROVED_VERSIONS:approvedVersions,IMMUTABLE_ARTIFACT_RECORDS:artifacts.map(a=>recordId(a,'artifacts')),HASHES:approvedVersions.hashes,HUMAN_AUTHORIZATION:authorization,AUTHORIZED_RECIPIENT_ROLES:'CURRENT AUTHORIZED ROLES',CONTROLLED_STORAGE:'INDEXEDDB VERIFIED BYTES',STATUS:'FROZEN',EVIDENCE:hash.sha256Value({approvedVersions,operatorLabel})};
  const record={id:baselineId,stage:20,createdAt,active:true,scope:{...currentScope(project),baselineId},fields,...fields,source:'APPLICATION_DERIVATION'};record.contentSha256=hash.contentRecordSha256(record,'BASELINE_ID');record.recordSha256=hash.recordSha256(record);record.sha256=record.recordSha256;project.projectData.baselines.push(record);project.job.CURRENT_BASELINE_ID=baselineId;addHistory(project,'BASELINE_FROZEN',{stage:20,baselineId,artifactIds:fields.IMMUTABLE_ARTIFACT_RECORDS,iterationId:approvedVersions.iterationId,candidateId:approvedVersions.candidateId,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return record;
}"""
replace_function('freezeBaseline',freeze)

# Derivation rendering must not recompute whole-project coverage, convergence,
# and release for stages that do not consume those values. This is a pure
# performance correction: each calculation is still performed by its owning
# stage and uses the same deterministic functions and values.
derive="""function deriveStageData(project,stage){
  ensureShape(project);const derived={};const ids=collection=>recordsForCurrentScope(project,collection).filter(r=>Number(r.stage)===Number(stage)).map(r=>recordId(r,collection));
  switch(stage){
    case 1:Object.assign(derived,{JOB_ID:project.job.JOB_ID,DATE_OPENED:project.job.DATE_OPENED,INPUT_SET_VERSION:project.job.CURRENT_INPUT_VERSION,INPUT_SET_HASH_OR_MANIFEST:project.job.INPUT_SET_HASH_OR_MANIFEST||'UNKNOWN',JOB_RECORD_STATUS:project.stages[1].status==='COMPLETE'?'READY':'NOT READY'});break;
    case 2:Object.assign(derived,{SOURCE_SET_VERSION:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',SOURCE_RECORDS:ids('sources'),SOURCE_CONFLICT_RECORDS:ids('sourceConflicts')});break;
    case 4:{const metrics=coverageMetrics(project);Object.assign(derived,{REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',TOTAL_REQUIREMENTS:recordsForCurrentScope(project,'requirements').length,MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount});break;}
    case 6:{const metrics=coverageMetrics(project);Object.assign(derived,{TEST_SUITE_VERSION:project.job.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE',TOTAL_ACTIVE_MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,ACTIVE_MANDATORY_REQUIREMENTS_WITH_AT_LEAST_ONE_READY_TEST:metrics.requirementsWithTests,MANDATORY_TEST_COVERAGE:metrics.requirementCoverage});break;}
    case 11:case 17:case 19:{const it=latestIteration(project,[stage]);const ev=evaluateIteration(project,recordId(it,'iterations'),stage===19?'UNCHANGED_CONFIRMATION':stage===17?'CORRECTED':'INITIAL');Object.assign(derived,{ITERATION_ID:ev.iterationId,RUN_COUNT:ev.runs.length,FRESH_CONTEXT_COUNT:ev.contextCount,ITERATION_COMPLETE:ev.complete,ITERATION_REASONS:ev.reasons});break;}
    case 12:{const metrics=coverageMetrics(project);Object.assign(derived,{ACTIVE_MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,RUNS:metrics.iterationRunCount,EXPECTED_MANDATORY_RECORDS:metrics.expectedVerificationCount,ACTUAL_MANDATORY_RECORDS:metrics.actualVerificationTripleCount,MISSING_RECORDS:metrics.missingVerificationTriples.length,VERIFICATION_COVERAGE:metrics.verificationCoverage});break;}
    case 18:{const convergence=convergenceMetrics(project);Object.assign(derived,{MANDATORY_REQUIREMENT_COVERAGE:convergence.requirementCoverage,MANDATORY_VERIFICATION_COVERAGE:convergence.verificationCoverage,REGRESSION_TEST_SUCCESS:convergence.regressionSuccess,CRITICAL_DEFECTS:convergence.criticalDefects,MAJOR_DEFECTS:convergence.majorDefects,MANDATORY_UNRESOLVED_UNKNOWNS:convergence.mandatoryUnresolvedUnknowns,KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS:convergence.contradictions,KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES:convergence.ambiguities,UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE:convergence.unexplainedVariance,ALL_CONDITIONS_SIMULTANEOUSLY_TRUE:convergence.converged});break;}
    case 27:{const release=releaseMetrics(project);Object.assign(derived,{TOTAL_MANDATORY_REQUIREMENTS:release.mandatoryRequirementCount,MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_SUPPORTING_EVIDENCE:release.satisfied,MANDATORY_REQUIREMENTS_DEMONSTRABLY_VIOLATED:release.violated,MANDATORY_REQUIREMENTS_NOT_ESTABLISHED:release.undetermined,UNRESOLVED_CRITICAL_DEFECTS:release.criticalDefects,UNRESOLVED_MAJOR_DEFECTS:release.majorDefects,SELECTED_RELEASE_STATE:release.determination});break;}
    case 28:Object.assign(derived,DERIVATIONS['stage28.artifactIdentity'](project).value);break;
    case 29:Object.assign(derived,DERIVATIONS['stage29.evidenceChains'](project).value);break;
  }
  derived.STAGE_DECISION=project.stages[stage].status==='COMPLETE'?'READY TO PROCEED':project.stages[stage].status==='BLOCKED'?'BLOCKED':'NOT READY - CORRECTION REQUIRED';derived.DECISION_EVIDENCE=project.stages[stage].gate?.reasons?.length?project.stages[stage].gate.reasons.join('; '):'Canonical current-scope records and deterministic calculations satisfy the stage gate.';return derived;
}"""
replace_function('deriveStageData',derive)

# Stage 29 chain completeness uses the same structural evidence contract that
# controls result adjudication. Bare narrative is supplementary only.
old="else for(const result of testResults)if(!evaluateEvidenceSufficiency(project,{requirement,test,result}).sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid);"
new="else for(const result of testResults)if(!evaluateEvidenceContract(test,result,null,project).sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid);"
replace_once(old,new,'evidence-chain structural sufficiency')

# The pure identity validator is exported so deterministic regression tests can
# prove exact candidate-byte selection without bypassing Stage 19 authorization.
replace_once('beginUnchangedConfirmationIteration,freezeBaseline,reserveProductExecution','beginUnchangedConfirmationIteration,validateBaselineCandidateArtifacts,freezeBaseline,reserveProductExecution','baseline validator export')

p.write_text(s)
