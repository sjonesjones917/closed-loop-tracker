from pathlib import Path
import hashlib

def one(path, old, new):
    p=Path(path); s=p.read_text(); n=s.count(old)
    if n != 1:
        raise SystemExit(f'{path}: expected one exact anchor, found {n}: {old[:140]!r}')
    p.write_text(s.replace(old,new,1))

one('workflow-engine.js', '''function testExecutionPlan(project){
  ensureShape(project);
  const items=recordsForCurrentScope(project,'tests').map(test=>{
    const mode=upper(recordValue(test,'EXECUTION_MODE'))||'UNSPECIFIED';
    return {testId:recordId(test,'tests'),requirementId:testRequirementId(test),testType:upper(recordValue(test,'TEST_TYPE'))||'UNKNOWN',executionMode:mode,requiredCapability:String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim(),artifactRequirements:String(recordValue(test,'ARTIFACT_REQUIREMENTS')||'').trim(),operatorAction:TEST_EXECUTION_ACTIONS[mode]||'Execution responsibility is not validly classified.'};
  });
  const counts=Object.fromEntries(Object.keys(TEST_EXECUTION_ACTIONS).map(mode=>[mode,items.filter(item=>item.executionMode===mode).length]));
  const incompleteTestIds=items.filter(item=>!TEST_EXECUTION_ACTIONS[item.executionMode]||!item.requiredCapability||!item.artifactRequirements).map(item=>item.testId);
  const unavailableTestIds=items.filter(item=>item.executionMode==='UNAVAILABLE').map(item=>item.testId);
  return {total:items.length,counts,incompleteTestIds,unavailableTestIds,items};
}''', '''function testExecutionPlan(project){
  ensureShape(project);
  const evidenceById=new Map(records(project,'evidenceRecords').map(item=>[recordId(item,'evidenceRecords'),item]));
  const artifactsById=new Map(records(project,'artifacts').map(item=>[recordId(item,'artifacts'),item]));
  const items=recordsForCurrentScope(project,'tests').map(test=>{
    const mode=upper(recordValue(test,'EXECUTION_MODE'))||'UNSPECIFIED',artifactRequirements=String(recordValue(test,'ARTIFACT_REQUIREMENTS')||'').trim(),artifactRequired=Boolean(artifactRequirements&&!['NONE','NOT APPLICABLE','N/A'].includes(upper(artifactRequirements))),evidenceIds=safe(test.evidenceRefs).map(String),artifactIds=[...new Set(evidenceIds.map(id=>evidenceById.get(id)).map(item=>String(recordValue(item,'ATTACHMENT_ID')||'').trim()).filter(Boolean))],missingArtifactIds=artifactIds.filter(id=>!artifactsById.has(id)),unverifiedArtifactIds=artifactIds.filter(id=>{const artifact=artifactsById.get(id);return artifact&&upper(recordValue(artifact,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED';}),artifactReady=!artifactRequired||(artifactIds.length>0&&!missingArtifactIds.length&&!unverifiedArtifactIds.length);
    return {testId:recordId(test,'tests'),requirementId:testRequirementId(test),testType:upper(recordValue(test,'TEST_TYPE'))||'UNKNOWN',executionMode:mode,requiredCapability:String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim(),artifactRequirements,artifactRequired,evidenceIds,artifactIds,missingArtifactIds,unverifiedArtifactIds,artifactReady,operatorAction:artifactRequired&&!artifactReady?'Restore or attach the exact required artifact bytes before execution. Browser-local custody does not transfer those bytes to an external executor; that exact context must actually receive them.':TEST_EXECUTION_ACTIONS[mode]||'Execution responsibility is not validly classified.'};
  });
  const counts=Object.fromEntries(Object.keys(TEST_EXECUTION_ACTIONS).map(mode=>[mode,items.filter(item=>item.executionMode===mode).length]));
  const incompleteTestIds=items.filter(item=>!TEST_EXECUTION_ACTIONS[item.executionMode]||!item.requiredCapability||!item.artifactRequirements).map(item=>item.testId);
  const unavailableTestIds=items.filter(item=>item.executionMode==='UNAVAILABLE').map(item=>item.testId);
  const missingArtifactTestIds=items.filter(item=>item.artifactRequired&&!item.artifactReady).map(item=>item.testId);
  return {total:items.length,counts,incompleteTestIds,unavailableTestIds,missingArtifactTestIds,items};
}''')

one('workflow-engine.js', '''      const unavailable=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='UNAVAILABLE');
      if(unavailable.length)reasons.push(`${unavailable.length} mandatory test definition(s) have unavailable execution capability and remain blocked.`);
      break;''', '''      const unavailable=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='UNAVAILABLE');
      if(unavailable.length)reasons.push(`${unavailable.length} mandatory test definition(s) have unavailable execution capability and remain blocked.`);
      const mandatoryTestIds=new Set(mandatoryTests.map(test=>recordId(test,'tests'))),missingArtifacts=testExecutionPlan(project).missingArtifactTestIds.filter(id=>mandatoryTestIds.has(id));
      if(missingArtifacts.length)reasons.push(`${missingArtifacts.length} mandatory test definition(s) require exact artifact bytes that are missing or no longer application-verified.`);
      break;''')

one('app-core.js', '''${plan.unavailableTestIds.length?`<div class="notice warn">${plan.unavailableTestIds.length} test${plan.unavailableTestIds.length===1?' is':'s are'} blocked by unavailable capability. Do not claim execution until a valid capability or equivalent verification path exists.</div>`:''}${actionRows.length?details('Who performs the current tests',actionRows):''', '''${plan.unavailableTestIds.length?`<div class="notice warn">${plan.unavailableTestIds.length} test${plan.unavailableTestIds.length===1?' is':'s are'} blocked by unavailable capability. Do not claim execution until a valid capability or equivalent verification path exists.</div>`:''}${plan.missingArtifactTestIds.length?`<div class="notice warn">${plan.missingArtifactTestIds.length} test${plan.missingArtifactTestIds.length===1?' requires':'s require'} exact artifact bytes that are missing or unverified. Restore or attach the exact files before execution; browser storage alone does not give an external executor access.</div>`:''}${actionRows.length?details('Who performs the current tests',actionRows):''')

one('prompt-engine.js', 'Any non-NONE ARTIFACT_REQUIREMENTS means actual byte-backed artifact evidence is mandatory before the response can validate.', 'Any non-NONE ARTIFACT_REQUIREMENTS means actual byte-backed artifact evidence is mandatory before the response can validate, and Stage 06 remains blocked if those canonical bytes later become missing or unverified. Browser-local custody does not give a later external executor access; the exact execution context must actually receive the required artifact bytes before it may claim execution.')

one('verify-ingestion.mjs', '''  prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files:[{artifactId:'ARTIFACT-TEST-000001',name:'fixture.js',type:'application/javascript',size:3,sha256:sha}]});
  if(prepared.validation.issues.some(item=>item.code==='MISSING_REQUIRED_TEST_ARTIFACT'))throw new Error('Byte-backed TEST artifact evidence did not satisfy artifact custody validation.');''', '''  prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files:[{artifactId:'ARTIFACT-TEST-000001',name:'fixture.js',type:'application/javascript',size:3,sha256:sha}]});
  if(prepared.validation.issues.some(item=>item.code==='MISSING_REQUIRED_TEST_ARTIFACT'))throw new Error('Byte-backed TEST artifact evidence did not satisfy artifact custody validation.');
  if(!prepared.validation.valid)throw new Error('Byte-backed TEST artifact fixture was otherwise invalid: '+JSON.stringify(prepared.validation.issues));
  const proposedTest=prepared.proposal?.canonicalRecords?.tests?.[0],proposedEvidence=prepared.proposal?.evidence?.[0];
  if(!proposedTest||!proposedEvidence||!safe(proposedTest.evidenceRefs).includes(proposedEvidence.id)||proposedEvidence.ATTACHMENT_ID!=='ARTIFACT-TEST-000001')throw new Error('TEST artifact custody did not resolve through canonical evidence to the verified artifact identity.');''')

p=Path('verify-complete.mjs'); s=p.read_text(); marker='// Invalid canonical relationship is rejected before mutation.'
block='''// Stage 06 continuously rechecks exact required artifact custody from canonical evidence and current verified bytes.
{
  const p=project('JOB-TEST-ARTIFACT-CURRENT');
  Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});
  const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'};
  p.projectData.requirements.push({id:'REQ-ART-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-ART-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
  p.projectData.tests.push({id:'TEST-ART-1',stage:6,active:true,scope:{...scope,testSuiteVersion:'TEST-SUITE-v001'},fields:{TEST_ID:'TEST-ART-1',REQ_ID:'REQ-ART-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'exact tool',ARTIFACT_REQUIREMENTS:'fixture.bin',INPUTS:'controlled',TOOLS:'exact tool',PROCEDURE:'execute',EXPECTED_RESULT:'pass',FAILURE_CONDITION:'fail',EVIDENCE_TO_PRESERVE:'report',STATUS:'READY'},relationships:{REQ_ID:'REQ-ART-1'},evidenceRefs:['EVIDENCE-ART-1']});
  p.projectData.evidenceRecords.push({id:'EVIDENCE-ART-1',stage:6,active:true,fields:{EVIDENCE_ID:'EVIDENCE-ART-1',ATTACHMENT_ID:'ARTIFACT-ART-1',STATUS:'PRESERVED'}});
  let plan=engine.testExecutionPlan(p);assert(plan.missingArtifactTestIds.includes('TEST-ART-1'),'A TEST with a missing canonical artifact was reported ready.');assert(engine.gate(6,p).reasons.some(reason=>reason.includes('missing or no longer application-verified')),'Stage 06 did not fail closed after required artifact bytes became unavailable.');
  p.projectData.artifacts.push({id:'ARTIFACT-ART-1',stage:6,active:true,fields:{ARTIFACT_ID:'ARTIFACT-ART-1',AVAILABILITY:'METADATA_ONLY'}});plan=engine.testExecutionPlan(p);assert(plan.missingArtifactTestIds.includes('TEST-ART-1'),'Metadata-only artifact incorrectly satisfied TEST custody.');
  p.projectData.artifacts[0].fields.AVAILABILITY='BYTES_PERSISTED_AND_VERIFIED';plan=engine.testExecutionPlan(p);assert(!plan.missingArtifactTestIds.includes('TEST-ART-1')&&plan.items[0].artifactIds.includes('ARTIFACT-ART-1'),'Verified current artifact bytes did not satisfy TEST custody.');
}

'''
if s.count(marker)!=1: raise SystemExit('verify-complete current-custody insertion anchor mismatch')
p.write_text(s.replace(marker,block+marker,1))

p=Path('verify-prompt-semantics.mjs'); s=p.read_text(); marker='console.log(JSON.stringify({'
block='''{
 const engineSource=fs.readFileSync('workflow-engine.js','utf8'),ui=fs.readFileSync('app-core.js','utf8');
 if(!engineSource.includes('missingArtifactTestIds')||!engineSource.includes('BYTES_PERSISTED_AND_VERIFIED'))throw new Error('Current TEST artifact custody is not a deterministic gate input.');
 if(!ui.includes('exact artifact bytes that are missing or unverified')||!ui.includes('browser storage alone does not give an external executor access'))throw new Error('Operator UI does not explain missing TEST bytes and external access truth.');
 const stage6=prompts.buildPromptRecord(6,core.createBlankState('JOB-SEMANTIC-ARTIFACT')).prompt;
 if(!stage6.includes('Stage 06 remains blocked')||!stage6.includes('Browser-local custody does not give a later external executor access'))throw new Error('Stage 06 prompt does not state current custody and external-access boundaries.');
}

'''
if s.count(marker)!=1: raise SystemExit('verify-prompt-semantics insertion anchor mismatch')
p.write_text(s.replace(marker,block+marker,1))

one('README.md', 'When an external agent returns an actual file, its response declares the attachment and the operator attaches the exact returned bytes in the stage file control before parsing. The application then verifies the actual filename/media type/byte size/SHA-256 and stores the Blob. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external agent.', 'When an external agent returns an actual file, its response declares the attachment and the operator attaches the exact returned bytes in the stage file control before parsing. The application then verifies the actual filename/media type/byte size/SHA-256 and stores the Blob. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external agent. Stage 06 also rechecks current canonical TEST → evidence → artifact custody, so later loss or loss of verified-byte status fails closed instead of leaving a stale test definition apparently ready.')

runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def gitblob(path):
    b=Path(path).read_bytes(); return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
manifest=''.join(f'{f}:{gitblob(f)}\n' for f in runtime).encode(); token='runtime-'+hashlib.sha256(manifest).hexdigest()[:16]
p=Path('index.html'); lines=p.read_text().splitlines(); count=0; out=[]
for line in lines:
    if any(f'{name}?v=' in line for name in runtime):
        left,rest=line.split('?v=',1); suffix=rest[rest.index('"'):]; line=left+'?v='+token+suffix; count+=1
    out.append(line)
if count != 8: raise SystemExit(f'expected 8 runtime script lines, updated {count}')
p.write_text('\n'.join(out)+'\n')
