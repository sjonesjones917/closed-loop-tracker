from pathlib import Path

engine_path = Path('workflow-engine.js')
engine = engine_path.read_text()

old_contract = """function evaluateEvidenceContract(test,result,canonicalEvidence,project){
  const evidence=evidenceRecordsFor(project,result,canonicalEvidence),reasons=[],mode=upper(recordValue(test,'EXECUTION_MODE')),artifactReq=upper(recordValue(test,'ARTIFACT_REQUIREMENTS')),requiresAttachment=Boolean(test&&artifactReq&&!adjudication_NONE.has(artifactReq));
  if(!evidence.length)reasons.push('No canonical evidence record is linked to the result; narrative alone is non-controlling.');
  for(const item of evidence){const native=item?.source==='APPLICATION_TEST_RUNTIME',authority=native?'APPLICATION':upper(recordValue(item,'AUTHORITY_TYPE')),attachmentId=String(recordValue(item,'ATTACHMENT_ID')||item?.relationships?.ATTACHMENT_ID||'').trim();if(adjudicationEmpty(native?recordValue(item,'APPLICATION_EVIDENCE_KIND'):recordValue(item,'KIND')))reasons.push('Canonical evidence kind is missing.');if(!authority||authority==='UNKNOWN')reasons.push('Canonical evidence authority type is missing or unknown.');if(adjudicationEmpty(native?recordValue(item,'APPLICATION_EVIDENCE_CONTENT'):recordValue(item,'CONTENT'))&&adjudicationEmpty(native?recordValue(item,'APPLICATION_EVIDENCE_DESCRIPTION'):recordValue(item,'DESCRIPTION'))&&adjudicationEmpty(recordValue(item,'LOCATION')))reasons.push('Canonical evidence contains no preserved observation payload.');if(attachmentId&&attachmentId!=='UNKNOWN'){const a=records(project,'artifacts').find(x=>recordId(x,'artifacts')===attachmentId);if(!a||upper(recordValue(a,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED')reasons.push('Referenced evidence attachment bytes are not application-verified.');}}
  if(requiresAttachment&&!evidence.some(item=>{const id=String(recordValue(item,'ATTACHMENT_ID')||item?.relationships?.ATTACHMENT_ID||'').trim();return id&&id!=='UNKNOWN';}))reasons.push('The controlling test requires an attachment-backed evidence record.');
  const executionId=resultExecutionIdentity(project,result),contextId=resultContextIdentity(project,result);
  if(test&&mode!=='APPLICATION_DETERMINISTIC'&&!executionId)reasons.push('Execution identity is not established.');
  if(test&&['INDEPENDENT_AGENT_REVIEW','EXTERNAL_AGENT_TOOL','HUMAN_INSPECTION','EXTERNAL_SYSTEM'].includes(mode)&&!contextId)reasons.push('Execution/reviewer context identity is not established.');
  return {sufficient:reasons.length===0,reasons,evidenceIds:evidence.map(e=>recordId(e,'evidenceRecords')),executionId,contextId};
}
"""
new_contract = """function evaluateEvidenceContract(test,result,canonicalEvidence,project){
  const evidence=evidenceRecordsFor(project,result,canonicalEvidence),reasons=[],mode=upper(recordValue(test,'EXECUTION_MODE')),artifactReq=upper(recordValue(test,'ARTIFACT_REQUIREMENTS')),requiresAttachment=Boolean(test&&artifactReq&&!adjudication_NONE.has(artifactReq)),testId=String(recordId(test,'tests')||'');
  if(!evidence.length)reasons.push('No canonical evidence record is linked to the result; narrative alone is non-controlling.');
  const isBoundHumanObservation=item=>item?.source==='HUMAN_OBSERVATION'&&String(item?.humanInspectionTestId||'')===testId&&String(item?.humanAuthority?.identityAssurance||'')==='SELF_ASSERTED'&&Boolean(String(recordValue(item,'APPLICATION_EVIDENCE_CONTENT')||'').trim());
  for(const item of evidence){const native=item?.source==='APPLICATION_TEST_RUNTIME',human=isBoundHumanObservation(item),authority=native?'APPLICATION':human?'HUMAN_OBSERVATION':upper(recordValue(item,'AUTHORITY_TYPE')),kind=native||human?recordValue(item,'APPLICATION_EVIDENCE_KIND'):recordValue(item,'KIND'),content=native||human?recordValue(item,'APPLICATION_EVIDENCE_CONTENT'):recordValue(item,'CONTENT'),description=native||human?recordValue(item,'APPLICATION_EVIDENCE_DESCRIPTION'):recordValue(item,'DESCRIPTION'),attachmentId=String(recordValue(item,'ATTACHMENT_ID')||item?.relationships?.ATTACHMENT_ID||'').trim();if(adjudicationEmpty(kind))reasons.push('Canonical evidence kind is missing.');if(!authority||authority==='UNKNOWN')reasons.push('Canonical evidence authority type is missing or unknown.');if(adjudicationEmpty(content)&&adjudicationEmpty(description)&&adjudicationEmpty(recordValue(item,'LOCATION')))reasons.push('Canonical evidence contains no preserved observation payload.');if(attachmentId&&attachmentId!=='UNKNOWN'){const a=records(project,'artifacts').find(x=>recordId(x,'artifacts')===attachmentId);if(!a||upper(recordValue(a,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED')reasons.push('Referenced evidence attachment bytes are not application-verified.');}}
  if(requiresAttachment&&!evidence.some(item=>{const id=String(recordValue(item,'ATTACHMENT_ID')||item?.relationships?.ATTACHMENT_ID||'').trim();return id&&id!=='UNKNOWN';}))reasons.push('The controlling test requires an attachment-backed evidence record.');
  const executionId=resultExecutionIdentity(project,result),contextId=resultContextIdentity(project,result),humanObservationEvidence=mode==='HUMAN_INSPECTION'&&evidence.some(isBoundHumanObservation);
  if(test&&mode!=='APPLICATION_DETERMINISTIC'&&!executionId&&!humanObservationEvidence)reasons.push('Execution identity is not established.');
  if(test&&['INDEPENDENT_AGENT_REVIEW','EXTERNAL_AGENT_TOOL','EXTERNAL_SYSTEM'].includes(mode)&&!contextId)reasons.push('Execution/reviewer context identity is not established.');
  if(test&&mode==='HUMAN_INSPECTION'&&!contextId&&!humanObservationEvidence)reasons.push('Human inspection requires a bound human-owned observation recorded through the application.');
  return {sufficient:reasons.length===0,reasons,evidenceIds:evidence.map(e=>recordId(e,'evidenceRecords')),executionId,contextId};
}
"""
if old_contract not in engine:
    raise AssertionError('Human-inspection evidence-contract fragment was not found.')
engine = engine.replace(old_contract, new_contract, 1)
engine_path.write_text(engine)

verify_path = Path('verify-semantic-invariant.mjs')
verify = verify_path.read_text()
old_fixture = """ p.projectData.evidenceRecords.push({id:'EVIDENCE-HUMAN',stage:25,active:true,scope:{...scope},fields:{EVIDENCE_ID:'EVIDENCE-HUMAN',KIND:'HUMAN_INSPECTION',AUTHORITY_TYPE:'HUMAN_OBSERVATION',DESCRIPTION:'Human-owned inspection record.',CONTENT:'The operator opened and inspected the representation.'}});
 const actualHuman=record('verification',{EXACT_EVIDENCE:'EVIDENCE-HUMAN'},{evidenceRefs:['EVIDENCE-HUMAN']});
"""
new_fixture = """ p.projectData.evidenceRecords.push({id:'EVIDENCE-HUMAN',stage:25,active:true,scope:{...scope},source:'HUMAN_OBSERVATION',humanInspectionTestId:engine.recordId?engine.recordId(humanTest,'tests'):humanTest.id,humanAuthority:{operatorLabel:'HUMAN_OPERATOR',identityAssurance:'SELF_ASSERTED'},fields:{EVIDENCE_ID:'EVIDENCE-HUMAN',APPLICATION_EVIDENCE_KIND:'HUMAN_OBSERVATION',APPLICATION_EVIDENCE_DESCRIPTION:'Human-owned inspection record.',APPLICATION_EVIDENCE_CONTENT:JSON.stringify({observation:'The operator opened and inspected the representation.',identityAssurance:'SELF_ASSERTED'}),SHA256:'b'.repeat(64),STATUS:'CURRENT'}});
 const actualHuman=record('verification',{EXACT_EVIDENCE:'EVIDENCE-HUMAN'},{evidenceRefs:['EVIDENCE-HUMAN']});
"""
if old_fixture not in verify:
    raise AssertionError('Human-inspection regression fixture was not found.')
verify = verify.replace(old_fixture, new_fixture, 1)
verify_path.write_text(verify)
print('Aligned canonical human-observation evidence validation and regression with the application-owned human inspection command.')
