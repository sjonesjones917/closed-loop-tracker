from pathlib import Path
import re, hashlib


def replace_once(path, old, new, label):
    p=Path(path); s=p.read_text()
    count=s.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    p.write_text(s.replace(old,new,1))

# 1) Make the hashed stage resource contract the only text-length authority.
p=Path('response-ingestion.js'); s=p.read_text()
sig="function validateValue(definition,value,path,issues,{required=false}={})"
new_sig="function validateValue(definition,value,path,issues,{required=false,maxTextFieldLength=schema.DEFAULT_RESOURCE_LIMITS.maxTextFieldLength}={})"
if s.count(sig)!=1: raise SystemExit('validateValue signature anchor mismatch')
s=s.replace(sig,new_sig,1)
old="if(typeof value==='string'&&value.length>200000)issues.push(issue('TEXT_FIELD_TOO_LARGE',path,'Text field exceeds the configured maximum length.'));"
new="if(typeof value==='string'&&Number.isFinite(Number(maxTextFieldLength))&&value.length>Number(maxTextFieldLength))issues.push(issue('TEXT_FIELD_TOO_LARGE',path,'Text field exceeds the configured maximum length.'));"
if s.count(old)!=1: raise SystemExit('text limit anchor mismatch')
s=s.replace(old,new,1)
old="validateValue(definition,value,path,issues);"
new="validateValue(definition,value,path,issues,{maxTextFieldLength:contract?.resourceLimits?.maxTextFieldLength??schema.DEFAULT_RESOURCE_LIMITS.maxTextFieldLength});"
if s.count(old)!=1: raise SystemExit('stage value validator anchor mismatch')
s=s.replace(old,new,1)
old="validateValue(fieldDefinition,value,fieldPath,issues,{required:definition.required.includes(name)});"
new="validateValue(fieldDefinition,value,fieldPath,issues,{required:definition.required.includes(name),maxTextFieldLength:contract?.resourceLimits?.maxTextFieldLength??schema.DEFAULT_RESOURCE_LIMITS.maxTextFieldLength});"
if s.count(old)!=1: raise SystemExit('record value validator anchor mismatch')
s=s.replace(old,new,1)

# 2) A non-NONE test artifact requirement must resolve through evidence to application-verified bytes.
anchor="    if(hasAgentData&&!safe(record.evidenceRefs).length)issues.push(issue('MISSING_PROVENANCE',`${path}/evidenceRefs`,'Agent-produced canonical record data requires at least one evidence reference.'));\n"
addition=anchor+"    if(collection==='tests'&&String(record?.fields?.ARTIFACT_REQUIREMENTS||'').trim().toUpperCase()!=='NONE'){const linkedArtifact=safe(record.evidenceRefs).some(reference=>{const evidence=evidenceIndex.get(String(reference))?.evidence,attachment=evidence?.attachmentRef;if(!attachment)return false;if(attachment.tempKey)return attachmentIndex.has(String(attachment.tempKey));if(attachment.recordId)return workflow.records(project,'artifacts',{active:true}).some(item=>workflow.recordId(item,'artifacts')===String(attachment.recordId));return false;});if(!linkedArtifact)issues.push(issue('MISSING_REQUIRED_TEST_ARTIFACT',`${path}/evidenceRefs`,'Test ARTIFACT_REQUIREMENTS is not NONE, so at least one evidence reference must resolve to application-verified artifact bytes.'));}\n"
if s.count(anchor)!=1: raise SystemExit('test artifact evidence anchor mismatch')
s=s.replace(anchor,addition,1)
p.write_text(s)

# 3) Keep synthetic valid tests artifact-free unless an artifact is explicitly under test.
p=Path('test-fixtures.mjs'); s=p.read_text()
anchor="function scalarFor(name,definition,seed=1){const upper=String(name).toUpperCase();"
replacement=anchor+"if(upper.includes('ARTIFACT_REQUIREMENTS'))return 'NONE';"
if s.count(anchor)!=1: raise SystemExit('test fixture scalar anchor mismatch')
s=s.replace(anchor,replacement,1); p.write_text(s)

p=Path('verify-ingestion.mjs'); s=p.read_text()
anchor="function safeValue(name){\n"
replacement=anchor+"  if(/ARTIFACT_REQUIREMENTS/.test(name))return 'NONE';\n"
if s.count(anchor)!=1: raise SystemExit('verify ingestion safeValue anchor mismatch')
s=s.replace(anchor,replacement,1)
append=r'''

// Final boundary: the stage contract is the only individual text-field length authority.
{
  const definition={valueType:'STRING',enumValues:[],nullable:false,closedProperties:null};
  const tooLong=[]; ingestion.validateValue(definition,'1234','/contract-text',tooLong,{maxTextFieldLength:3});
  if(!tooLong.some(item=>item.code==='TEXT_FIELD_TOO_LARGE'))throw new Error('validateValue ignored the supplied response-contract text limit.');
  const exact=[]; ingestion.validateValue(definition,'123','/contract-text',exact,{maxTextFieldLength:3});
  if(exact.some(item=>item.code==='TEXT_FIELD_TOO_LARGE'))throw new Error('validateValue rejected a value exactly at the response-contract text limit.');
}

// Final boundary: naming a required executable/input artifact is not possession of its bytes.
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
s += append
p.write_text(s)

# 4) Correct only demonstrated prompt contradictions and make Stage 07 execution fail closed.
p=Path('prompt-engine.js'); s=p.read_text()
replacements=[
("If no legitimate external authority applies after evidence-supported inspection, return an explicit no-applicable-source determination rather than inventing a source.","If no legitimate independent external source or evidence applies after evidence-supported inspection, return an explicit no-applicable-source determination rather than inventing a source.",'Stage 02 source/evidence semantics'),
("Preflight this job’s production instruction in an independent context where required.","Preflight this job’s production instruction in an independent context from the instruction author.",'Stage 09 independence'),
("Use ARTIFACT_REQUIREMENTS = NONE when no separate executable/input artifact is required.","Use ARTIFACT_REQUIREMENTS = NONE when no separate executable/input artifact is required. Any non-NONE ARTIFACT_REQUIREMENTS means actual byte-backed artifact evidence is mandatory before the response can validate.",'Stage 06 artifact rule'),
("Build this job’s failure and mutation test proposals to prove validators reject realistic invalid states. Include applicable missing inputs, invalid values, wrong versions, duplicate identifiers, contradictions, omitted required sections, prohibited material, corrupt references, malformed files, conflicting authority, unavailable tools, unsupported claims, injected source instructions, known-invalid artifacts, and other relevant mutations. Preserve fixture, expected rejection, actual observed result, validator defect where applicable, and evidence. The application owns canonical test identities, suite identity, lifecycle state, and derived coverage.","Build this job’s failure and mutation tests to prove validators reject realistic invalid states. Define each invalid fixture and expected rejection, then execute it only in a context that actually has the required capability and artifact access. An actual observed result and evidence are required for Stage 07 completion; a proposed fixture alone does not satisfy the gate. If the required capability or artifact is unavailable, do not invent execution—return BLOCKED or EXECUTION_FAILED with the exact MISSING_CAPABILITY or MISSING_ARTIFACT reason. Include applicable missing inputs, invalid values, wrong versions, duplicate identifiers, contradictions, omitted required sections, prohibited material, corrupt references, malformed files, conflicting authority, unavailable tools, unsupported claims, injected source instructions, known-invalid artifacts, and other relevant mutations. Preserve fixture, expected rejection, actual observed result, validator defect where applicable, and evidence. The application owns canonical test identities, suite identity, lifecycle state, and derived coverage.",'Stage 07 execution honesty')]
for old,new,label in replacements:
    if s.count(old)!=1: raise SystemExit(f'{label}: anchor mismatch')
    s=s.replace(old,new,1)
p.write_text(s)

p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
s += r'''

// Final boundary prompt assertions: source/evidence semantics, verifier independence, artifact possession, and failure-test execution honesty.
{
  const p=baseProject();
  const stage2=prompts.buildPromptRecord(2,p).prompt;
  if(!stage2.includes('independent external source or evidence'))throw new Error('Stage 02 still makes no-source recovery depend on governing authority rather than legitimate independent source/evidence.');
  const stage6=prompts.buildPromptRecord(6,p).prompt;
  if(!stage6.includes('Any non-NONE ARTIFACT_REQUIREMENTS means actual byte-backed artifact evidence is mandatory'))throw new Error('Stage 06 does not tell the agent that named test artifacts require actual bytes.');
  const stage7=prompts.buildPromptRecord(7,p).prompt;
  if(!stage7.includes('a proposed fixture alone does not satisfy the gate')||!stage7.includes('MISSING_CAPABILITY')||!stage7.includes('MISSING_ARTIFACT'))throw new Error('Stage 07 can still imply an unexecuted failure-test proposal satisfies completion.');
  const stage9=prompts.buildPromptRecord(9,p).prompt;
  if(!stage9.includes('independent context from the instruction author')||stage9.includes('independent context where required'))throw new Error('Stage 09 prompt independence contradicts its unconditional gate.');
}
'''
p.write_text(s)

# 5) Make localStorage -> IndexedDB migration strict, deterministic, and non-destructive on any failure.
p=Path('project-store.js'); s=p.read_text()
pattern=r"function parseLegacy\(storage=globalThis\.localStorage\)\{.*?\}return out;\}\nfunction readAllLegacy"
replacement="""function parseLegacy(storage=globalThis.localStorage){const out=[],seen=new Set();if(!storage)return out;for(const key of LEGACY_KEYS){let raw=null;try{raw=storage.getItem(key);}catch(error){throw storageError(`Legacy project storage could not be read from ${key}: ${error.message||error}`,'LEGACY_MIGRATION_READ_FAILED');}if(!raw)continue;let parsed;try{parsed=JSON.parse(raw);}catch(error){throw storageError(`Legacy project storage ${key} contains malformed JSON: ${error.message||error}`,'LEGACY_MIGRATION_PARSE_FAILED');}const items=Array.isArray(parsed)?parsed:[parsed];for(let index=0;index<items.length;index++){const item=items[index];if(!item||typeof item!=='object'||Array.isArray(item))throw storageError(`Legacy project storage ${key}[${index}] is not a project object.`,'LEGACY_MIGRATION_INVALID_PROJECT');const id=projectIdentity(item);if(!id)throw storageError(`Legacy project storage ${key}[${index}] has no JOB_ID.`,'LEGACY_MIGRATION_INVALID_PROJECT');if(seen.has(id))continue;seen.add(id);out.push(item);}}return out;}
function readAllLegacy"""
s,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1: raise SystemExit('parseLegacy replacement anchor mismatch')
pattern=r"async function migrateLegacy\(\)\{.*?\n\}\n\nasync function readAllIndexed"
replacement="""async function migrateLegacy(){
  const db=await openDatabase();const count=await request(db.transaction(PROJECTS,'readonly').objectStore(PROJECTS).count());if(count)return {migrated:0};
  const legacy=parseLegacy();if(!legacy.length){await metaPut('migrationStatus',{status:'NONE',at:now()});return {migrated:0};}
  const tx=db.transaction([PROJECTS,META],'readwrite');let migrated=0;
  try{fault('before-legacy-migration');const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine;if(!core?.migrateState||!engine)throw storageError('Canonical workflow migration logic is unavailable.','LEGACY_MIGRATION_UNAVAILABLE');for(const source of legacy){const project=core.migrateState(clone(source));engine.ensureShape(project);engine.recalculate(project);assertProjectIntegrity(project,{verifyDerived:true});const id=projectIdentity(project);if(!id)throw storageError('Migrated legacy project has no JOB_ID.','LEGACY_MIGRATION_INVALID_PROJECT');const revision=Number(project.revision||0);tx.objectStore(PROJECTS).put({jobId:id,revision,project,projectSha256:projectSha256(project),updatedAt:now()});migrated++;}tx.objectStore(META).put({key:'migrationStatus',value:{status:'COMPLETE',migrated,at:now()},updatedAt:now()});fault('during-legacy-migration');await complete(tx);for(const key of LEGACY_KEYS)try{localStorage.removeItem(key);}catch{}return {migrated};}catch(error){try{tx.abort();}catch{}await metaPut('migrationStatus',{status:'FAILED',message:String(error.message||error),originalPreserved:true,at:now()});throw error;}
}

async function readAllIndexed"""
s,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1: raise SystemExit('migrateLegacy replacement anchor mismatch')
p.write_text(s)

p=Path('verify.mjs'); s=p.read_text()
anchor="const migrated=store.readAll(storage);if(migrated.length!==1||migrated[0].unknownFutureField?.preserve!==true)throw new Error('Legacy user project was not preserved losslessly.');\n"
addition=anchor+"const malformedLegacyKey='closed-loop-reliability-projects-v3',malformedLegacy='{\\\"broken\\\":';const malformedStorage=new MemoryStorage({[malformedLegacyKey]:malformedLegacy});let malformedRejected=false;try{store.readAll(malformedStorage);}catch(error){malformedRejected=error.code==='LEGACY_MIGRATION_PARSE_FAILED';}if(!malformedRejected||malformedStorage.getItem(malformedLegacyKey)!==malformedLegacy)throw new Error('Malformed legacy storage was not rejected fail-closed with the original bytes preserved.');\n"
if s.count(anchor)!=1: raise SystemExit('verify legacy test anchor mismatch')
s=s.replace(anchor,addition,1)
p.write_text(s)

# Refresh the one shared runtime build identity from exact final runtime bytes.
runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data=Path(path).read_bytes(); return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
manifest=''.join(f'{name}:{git_blob_sha(name)}\n' for name in runtime_files).encode()
token='runtime-'+hashlib.sha256(manifest).hexdigest()[:16]
html=Path('index.html').read_text()
for name in runtime_files:
    pattern=rf'(<script defer src="{re.escape(name)}\?v=)[^"]+(\"></script>)'
    html,count=re.subn(pattern,lambda m:m.group(1)+token+m.group(2),html,count=1)
    if count!=1: raise SystemExit(f'Runtime script token anchor missing for {name}')
Path('index.html').write_text(html)
print(token)
