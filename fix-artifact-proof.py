from pathlib import Path
p=Path('apply-final-boundary-closure.py')
s=p.read_text()
old=r'''// Final boundary: naming a required executable/input artifact is not possession of its bytes.
{
  const p=project('JOB-TEST-ARTIFACT-BYTES'),stage=6,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr);
  if(!e?.records?.tests?.length)throw new Error('Stage 06 fixture did not produce a TEST proposal.');
  e.records.tests[0].fields.ARTIFACT_REQUIREMENTS='fixture.js';
  let prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});
  if(prepared.validation.valid||!prepared.validation.issues.some(item=>item.code==='MISSING_REQUIRED_TEST_ARTIFACT'))throw new Error('A TEST requiring an artifact was accepted without byte-backed artifact evidence.');
  const sha='a'.repeat(64);
  e.attachments=[{temporaryKey:'test-artifact-1',filename:'fixture.js',mediaType:'application/javascript',byteSize:3,sha256:sha,required:true}];
  e.evidence[0].attachmentRef={tempKey:'test-artifact-1'};
  prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files:[{artifactId:'ARTIFACT-TEST-000001',name:'fixture.js',type:'application/javascript',size:3,sha256:sha}]});
  if(!prepared.validation.valid)throw new Error(`Byte-backed TEST artifact evidence was rejected: ${JSON.stringify(prepared.validation.issues)}`);
}
'''
new=r'''// Final boundary: naming a required executable/input artifact is not possession of its bytes.
{
  const p=project('JOB-TEST-ARTIFACT-BYTES'),stage=6,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr);
  if(!e)throw new Error('Stage 06 did not produce a response envelope fixture.');
  const def=schema.RECORD_SCHEMAS.tests,fields={};
  for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=valueForDefinition(def.fieldDefinitions[name]);
  fields.ARTIFACT_REQUIREMENTS='fixture.js';
  e.stageData={};e.records={tests:[{tempKey:'test-artifact-record',fields,relationships:{},evidenceRefs:['evidence-1']}]};
  let prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});
  if(!prepared.validation.issues.some(item=>item.code==='MISSING_REQUIRED_TEST_ARTIFACT'))throw new Error('A TEST requiring an artifact was not rejected without byte-backed artifact evidence.');
  const sha='a'.repeat(64);
  e.attachments=[{temporaryKey:'test-artifact-1',filename:'fixture.js',mediaType:'application/javascript',byteSize:3,sha256:sha,required:true}];
  e.evidence[0].attachmentRef={tempKey:'test-artifact-1'};
  prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files:[{artifactId:'ARTIFACT-TEST-000001',name:'fixture.js',type:'application/javascript',size:3,sha256:sha}]});
  if(prepared.validation.issues.some(item=>item.code==='MISSING_REQUIRED_TEST_ARTIFACT'))throw new Error('Byte-backed TEST artifact evidence did not satisfy artifact custody validation.');
}
'''
if s.count(old)!=1: raise SystemExit('artifact proof block mismatch')
p.write_text(s.replace(old,new,1))
