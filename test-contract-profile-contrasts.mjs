import assert from 'node:assert/strict';
// Existing ingestion owner supplies its actual synthetic Stage1 preview fixture.
// No external actor, authoritative Blob transport or persistence is claimed here.
export function verifyContractProfileContrasts({project,savePrompt,blockedEnvelope,ingestion,acceptedFixtureBaseline}){
 const cases=[];
 for(const [caseId,field,value,expectedCode]of [
  ['correct-literals',null,null,null],
  ['wrong-schema','schema','closed-loop-stage-response/999','WRONG_SCHEMA'],
  ['missing-schema','schema',undefined,'WRONG_SCHEMA'],
  ['wrong-profile','contractProfileId','closed-loop-completion-profile/0','WRONG_CONTRACT_PROFILE'],
  ['missing-profile','contractProfileId',undefined,'WRONG_CONTRACT_PROFILE']
 ]){
  const p=project('CONTRACT-PROFILE-'+caseId),pr=savePrompt(p,1),envelope=blockedEnvelope(p,1,pr);
  assert.equal(envelope.schema,'closed-loop-stage-response/3','CONTRACT_PROFILE_LITERAL_SCHEMA_ORACLE');
  assert.equal(envelope.contractProfileId,'closed-loop-completion-profile/1','CONTRACT_PROFILE_LITERAL_PROFILE_ORACLE');
  if(field){if(value===undefined)delete envelope[field];else envelope[field]=value;}
  const text=JSON.stringify(envelope),snapshot=JSON.stringify(p),baseline=JSON.parse(JSON.stringify(acceptedFixtureBaseline(p))),prepared=ingestion.prepare(p,{stage:1,text,promptRecord:pr});
  assert.equal(prepared.validation.valid,expectedCode===null,'CONTRACT_PROFILE_ADMISSION_ORACLE:'+caseId+':'+JSON.stringify(prepared.validation.issues));
  assert.equal(Boolean(prepared.proposal),expectedCode===null,'CONTRACT_PROFILE_PROPOSAL_ORACLE:'+caseId);
  if(expectedCode)assert.ok(prepared.validation.issues.some(row=>row.code===expectedCode&&row.path==='/'+field),'CONTRACT_PROFILE_DIAGNOSTIC_ORACLE:'+caseId);
  else assert.deepEqual(Array.from(prepared.validation.issues),[],'CONTRACT_PROFILE_VALID_CONTROL_ORACLE');
  assert.equal(prepared.rawRecord.completeRawResponse,text,'CONTRACT_PROFILE_RAW_PRESERVATION_ORACLE:'+caseId);
  assert.deepEqual(JSON.parse(JSON.stringify(prepared.project.projectData.acceptedChanges)),baseline,'CONTRACT_PROFILE_NO_ACCEPTANCE_ORACLE:'+caseId);
  assert.equal(JSON.stringify(p),snapshot,'CONTRACT_PROFILE_INPUT_PRESERVATION_ORACLE:'+caseId);
  cases.push({caseId,expectedValid:expectedCode===null,observedValid:prepared.validation.valid,expectedCode,observedCodes:Array.from(prepared.validation.issues,row=>row.code),proposalCreated:Boolean(prepared.proposal),rawPreserved:true,noCanonicalAcceptance:true,passed:true});
 }
 return {contractProfileContrasts:true,synthetic:true,actualBrowser:false,actualExternalActor:false,boundary:'Existing Stage1 in-memory prompt/prepare API, exact schema and completion-profile literals; no commit/Blob transport/persistence proof.',cases,verificationObservations:[{checkId:'ingestion.contract-schema-profile-contrasts',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:1434'],boundary:'Actual prepare refuses wrong/missing schema/profile and preserves raw/canonical acceptance; literal valid BLOCKED response remains a pending proposal.',expected:{caseIds:['correct-literals','wrong-schema','missing-schema','wrong-profile','missing-profile'],valid:[true,false,false,false,false]},observed:{caseIds:cases.map(row=>row.caseId),valid:cases.map(row=>row.observedValid)},passed:true}]};
}
