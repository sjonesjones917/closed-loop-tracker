from pathlib import Path

path = Path('verify-ingestion.mjs')
text = path.read_text()

replacements = [
    (
        "{let p=project('JOB-PARALLEL-PROMPT-VALIDATION'),stage=17;p.revision=0;",
        "{let p=project('JOB-PARALLEL-PROMPT-VALIDATION'),stage=17;p.stages[16].status='COMPLETE';p.stages[16].gate={complete:true,blocked:false,reasons:[]};p.revision=0;",
    ),
    (
        "{let p=project('JOB-SCOPED-CLARIFICATION'),stage=17;p.revision=0;",
        "{let p=project('JOB-SCOPED-CLARIFICATION'),stage=17;p.stages[16].status='COMPLETE';p.stages[16].gate={complete:true,blocked:false,reasons:[]};p.revision=0;",
    ),
    (
        "  const p=project('JOB-RAW-SCOPE');\n  p.job.CURRENT_ITERATION='ITERATION-SCOPE-001';",
        "  const p=project('JOB-RAW-SCOPE');\n  p.stages[16].status='COMPLETE';p.stages[16].gate={complete:true,blocked:false,reasons:[]};\n  p.job.CURRENT_ITERATION='ITERATION-SCOPE-001';",
    ),
    (
        "  let p=project('JOB-NEG-OPERATION-STAGEDATA'),stage=17;const pr=",
        "  let p=project('JOB-NEG-OPERATION-STAGEDATA'),stage=17;p.stages[16].status='COMPLETE';p.stages[16].gate={complete:true,blocked:false,reasons:[]};const pr=",
    ),
    (
        "  let p=project('JOB-NEG-RESERVED-TEMPKEY'),stage=21;",
        "  let p=project('JOB-NEG-RESERVED-TEMPKEY'),stage=21;p.stages[20].status='COMPLETE';p.stages[20].gate={complete:true,blocked:false,reasons:[]};",
    ),
    (
        "  let p=project('JOB-NEG-COMPLETED-TARGET'),stage=21,productId='PRODUCT-000001';",
        "  let p=project('JOB-NEG-COMPLETED-TARGET'),stage=21,productId='PRODUCT-000001';p.stages[20].status='COMPLETE';p.stages[20].gate={complete:true,blocked:false,reasons:[]};",
    ),
    (
        "  let p=project('JOB-NEG-TARGET-SCOPE'),stage=11,runId='RUN-SCOPE-B';",
        "  let p=project('JOB-NEG-TARGET-SCOPE'),stage=11,runId='RUN-SCOPE-B';p.stages[10].status='COMPLETE';p.stages[10].gate={complete:true,blocked:false,reasons:[]};",
    ),
    (
        "  const p=project('JOB-UNPERSISTED-PROMPT'),stage=2,pr=prompts.buildPromptRecord(stage,p)",
        "  const p=project('JOB-UNPERSISTED-PROMPT'),stage=2;p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};const pr=prompts.buildPromptRecord(stage,p)",
    ),
]

for old, new in replacements:
    if old not in text:
        raise AssertionError(f'Direct later-stage fixture fragment was not found: {old}')
    text = text.replace(old, new, 1)

old = "const request=p.projectData.humanInputRequests.at(-1);p=ingestion.answerHumanInput(p,{[request.requestId]:'Exact run-specific answer'},{operator:'VERIFY'}).project;"
new = "const request=p.projectData.humanInputRequests.at(-1);p.stages[16].status='COMPLETE';p.stages[16].gate={complete:true,blocked:false,reasons:[]};p=ingestion.answerHumanInput(p,{[request.requestId]:'Exact run-specific answer'},{operator:'VERIFY'}).project;"
if old not in text:
    raise AssertionError('Scoped Stage 17 clarification regeneration fixture was not found.')
text = text.replace(old, new, 1)

old = "if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='STAGE_OPERATION_FIELD_VIOLATION'))throw new Error('EXECUTE_RUN accepted VERIFY stageData.');"
new = "if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='FIELD_OWNERSHIP_VIOLATION'))throw new Error('EXECUTE_RUN accepted an application-owned Stage 17 field.');"
if old not in text:
    raise AssertionError('The obsolete Stage 17 operation-field rejection assertion was not found.')
text = text.replace(old, new, 1)

old = """// Final boundary: naming a required executable/input artifact is not possession of its bytes.
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
  if(!prepared.validation.valid)throw new Error('Byte-backed TEST artifact fixture was otherwise invalid: '+JSON.stringify(prepared.validation.issues));
  const proposedTest=prepared.proposal?.canonicalRecords?.tests?.[0],proposedEvidence=prepared.proposal?.evidence?.[0];
  if(!proposedTest||!proposedEvidence||!(Array.isArray(proposedTest.evidenceRefs)?proposedTest.evidenceRefs:[]).includes(proposedEvidence.id)||proposedEvidence.ATTACHMENT_ID!=='ARTIFACT-TEST-000001')throw new Error('TEST artifact custody did not resolve through canonical evidence to the verified artifact identity.');
}
"""
new = """// Final boundary: declared attachment metadata is not possession of its bytes.
// Stage 06 may define future product/input artifact requirements before those
// future bytes exist; an attachment declared as present in the current response,
// however, must resolve to exact application-verified supplied bytes.
{
  const p=project('JOB-TEST-ARTIFACT-BYTES'),stage=6,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr);
  if(!e)throw new Error('Stage 06 did not produce a response envelope fixture.');
  const def=schema.RECORD_SCHEMAS.tests,fields={};
  for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=valueForDefinition(def.fieldDefinitions[name]);
  fields.TEST_TYPE='DETERMINISTIC';
  fields.EXECUTION_MODE='EXTERNAL_AGENT_TOOL';
  fields.REQUIRED_CAPABILITY='CONTROLLED_EXTERNAL_TEST_TOOL';
  fields.ARTIFACT_REQUIREMENTS='fixture.js';
  delete fields.EXECUTABLE_KIND;delete fields.EXECUTABLE_SPEC;delete fields.EXECUTABLE_INPUT_BINDINGS;
  e.stageData={};e.records={tests:[{tempKey:'test-artifact-record',fields,relationships:{},evidenceRefs:['evidence-1']}]};
  const sha='a'.repeat(64);
  e.attachments=[{temporaryKey:'test-artifact-1',filename:'fixture.js',mediaType:'application/javascript',byteSize:3,sha256:sha,required:true}];
  e.evidence[0].attachmentRef={tempKey:'test-artifact-1'};
  let prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});
  if(!prepared.validation.issues.some(item=>item.code==='MISSING_REQUIRED_ATTACHMENT'))throw new Error('Declared TEST attachment metadata was treated as possession without supplied verified bytes.');
  prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files:[{artifactId:'ARTIFACT-TEST-000001',name:'fixture.js',type:'application/javascript',size:3,sha256:sha}]});
  if(prepared.validation.issues.some(item=>item.code==='MISSING_REQUIRED_ATTACHMENT'))throw new Error('Byte-backed TEST attachment did not satisfy artifact custody validation.');
  if(!prepared.validation.valid)throw new Error('Byte-backed TEST artifact fixture was otherwise invalid: '+JSON.stringify(prepared.validation.issues));
  const proposedTest=prepared.proposal?.canonicalRecords?.tests?.[0],proposedEvidence=prepared.proposal?.evidence?.[0];
  if(!proposedTest||!proposedEvidence||!(Array.isArray(proposedTest.evidenceRefs)?proposedTest.evidenceRefs:[]).includes(proposedEvidence.id)||proposedEvidence.ATTACHMENT_ID!=='ARTIFACT-TEST-000001')throw new Error('TEST artifact custody did not resolve through canonical evidence to the verified artifact identity.');
}
"""
if old not in text:
    raise AssertionError('The obsolete Stage 06 artifact-possession regression was not found.')
text = text.replace(old, new, 1)

path.write_text(text)
print('Bound direct later-stage fixtures to valid predecessors, aligned Stage 17 ownership enforcement, and tested declared attachment metadata against exact verified bytes.')
