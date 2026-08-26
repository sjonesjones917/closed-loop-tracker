from pathlib import Path


def replace_once(path, old, new, label):
    p=Path(path); s=p.read_text()
    count=s.count(old)
    if count!=1: raise SystemExit(f'{label}: expected one anchor, found {count}')
    p.write_text(s.replace(old,new,1))

# 1) Exact target-scope ordering and operation context.
replace_once('workflow-schema.js',
"10:['instructions','preflightRecords','tests','failureTests']",
"10:['instructions','preflightRecords','tests','failureTests','candidateFreezes','iterations','artifacts']",
'Stage 10 read context')
replace_once('workflow-schema.js',
"21:['baselines','freshContexts']",
"21:['baselines','products','freshContexts','artifacts']",
'Stage 21 read context')
replace_once('workflow-schema.js',
"if(s===11)keys.push('runId','contextId');if(s>=20)keys.push('baselineId');if(s>=21)keys.push('productId');",
"if([11,17,19].includes(s))keys.push('runId','contextId');if(s>=21)keys.push('baselineId','productId');",
'scope requirement ordering')

# 2) Prompt fail-closed target identity, explicit artifact access boundary, stronger specialist semantics.
p=Path('prompt-engine.js'); s=p.read_text()
anchor="function humanInputBlock(job){\n const definitions=schema.JOB_FIELDS||{};\n const names=Object.entries(definitions).filter(([,definition])=>definition?.producer==='HUMAN').map(([name])=>name);\n return names.length?names.map(name=>`${name}:\\n${show(job?.[name])}`).join('\\n\\n'):'NONE';\n}\n"
if s.count(anchor)!=1: raise SystemExit(f'humanInputBlock anchor mismatch: {s.count(anchor)}')
artifact_fn="""function artifactContext(state){
 const active=(Array.isArray(state?.projectData?.artifacts)?state.projectData.artifacts:[]).filter(record=>record?.active!==false&&!record?.invalidatedBy),limit=Number(schema.DEFAULT_RESOURCE_LIMITS?.maxRecordsPerCollection||250),ordered=[...active].sort((a,b)=>String(a?.fields?.FILENAME||a?.FILENAME||'').localeCompare(String(b?.fields?.FILENAME||b?.FILENAME||''))||recordId(a,'artifacts').localeCompare(recordId(b,'artifacts'))),identity=record=>({artifactId:recordId(record,'artifacts'),logicalPath:record?.fields?.FILENAME||record?.FILENAME||'UNKNOWN',mediaType:record?.fields?.TYPE||record?.TYPE||'UNKNOWN',byteSize:record?.fields?.BYTE_SIZE??record?.BYTE_SIZE??'UNKNOWN',sha256:record?.fields?.SHA256||record?.SHA256||'UNKNOWN',role:record?.fields?.ROLE||record?.ROLE||'UNKNOWN',availability:record?.fields?.AVAILABILITY||record?.AVAILABILITY||'UNKNOWN',storageReference:record?.fields?.STORAGE_REFERENCE||record?.STORAGE_REFERENCE||'UNKNOWN',scope:record?.scope||{}});const all=ordered.map(identity),shown=all.slice(0,limit);return show({totalArtifacts:all.length,shownArtifacts:shown.length,omittedArtifacts:Math.max(0,all.length-shown.length),completeManifestSha256:hash.sha256Value(all),artifacts:shown,selectionRule:`Sorted canonical artifact identities; at most ${limit} paths are embedded in this prompt. Any omission is explicit and hashed, never silent.`,agentAccessBoundary:'This manifest proves browser-side identity metadata only. Browser-persisted artifact bytes are not automatically available to the external agent. The agent may inspect substantive file content only when those bytes or an equivalent repository/package are actually supplied in its execution context.'});
}
"""
s=s.replace(anchor,anchor+artifact_fn,1)
old="function assertRequiredPromptScope(stage,operation,scope){const required=schema.operationContract(stage,operation)?.scopeRequirements||[],laneKeys=['runId','contextId'],missing=required.filter(key=>laneKeys.includes(key)&&scopePlaceholder(scope?.[key]));if(missing.length){const error=new Error(`Controlling instruction cannot be created until application execution-lane identity exists for: ${missing.join(', ')}.`);error.code='MISSING_REQUIRED_PROMPT_SCOPE';error.missingScope=missing;throw error;}return scope;}"
new="function assertRequiredPromptScope(stage,operation,scope){const required=schema.operationContract(stage,operation)?.scopeRequirements||[],targetKeys=['iterationId','candidateId','runId','contextId','baselineId','productId'],missing=required.filter(key=>targetKeys.includes(key)&&scopePlaceholder(scope?.[key]));if(missing.length){const error=new Error(`Controlling instruction cannot be created until application target identity exists for: ${missing.join(', ')}.`);error.code='MISSING_REQUIRED_PROMPT_SCOPE';error.missingScope=missing;throw error;}return scope;}"
if s.count(old)!=1: raise SystemExit('prompt target guard anchor mismatch')
s=s.replace(old,new,1)
old="- PATENT / REGULATED FILING: identify the governing jurisdiction or office, filing type, priority/continuity facts, applicant/inventor facts, disclosure, claims, drawings, abstract, specification/formality requirements, and other filing-specific elements that materially affect the requested work. Use current official office rules, statutes, regulations, manuals, forms, and other controlling authority where applicable. Never invent inventorship, ownership, priority, dates, legal status, or filing facts; request missing human-only facts or decisions."
new="- PATENT / REGULATED FILING: identify the governing jurisdiction or office, filing type, priority/continuity facts, applicant/inventor facts, disclosure, claims, drawings, abstract, specification/formality requirements, and other filing-specific elements that materially affect the requested work. Distinguish procedural/legal filing authority from patent literature and non-patent literature used as prior-art or technical evidence. Check claim support, antecedent basis, terminology consistency, drawing/reference-numeral consistency, written-description/enablement support, and disclosure support where applicable. For prior-art work, preserve databases searched, queries/classifications, dates, material references, and search limitations. Use current official office rules, statutes, regulations, manuals, forms, and other controlling authority where applicable. Never invent inventorship, ownership, priority, continuity, dates, legal status, filing facts, prior-art search completeness, database-search coverage, filing/submission status, legal sufficiency, or patentability; request missing human-only facts or decisions and state search/tool limitations explicitly."
if s.count(old)!=1: raise SystemExit('patent domain anchor mismatch')
s=s.replace(old,new,1)
old="- SOFTWARE / MULTI-FILE SYSTEM: reason over the complete supplied file tree or manifest and the relevant interfaces, data models, dependencies, build/deploy/test constraints, migrations, security, observability, configuration, and operational boundaries. When repository or runtime access is unavailable, produce a complete implementation-ready multi-file specification or patch plan with exact logical files/components, responsibilities, interfaces, changes, and acceptance tests instead of claiming files were changed."
new="- SOFTWARE / MULTI-FILE SYSTEM: reason over the complete supplied file tree or manifest and the relevant interfaces, data models, dependencies, build/deploy/test constraints, migrations, security, observability, configuration, and operational boundaries. Preserve logical paths exactly; files with the same basename in different directories are distinct artifacts and must never be flattened or conflated. When repository or runtime access is unavailable, produce a complete implementation-ready multi-file specification or patch plan with exact logical files/components, responsibilities, interfaces, changes, and acceptance tests instead of claiming files were changed."
if s.count(old)!=1: raise SystemExit('software domain anchor mismatch')
s=s.replace(old,new,1)
old="${humanInputBlock(j)}\n\nCURRENT AGENT-NORMALIZED DELIVERABLE"
new="${humanInputBlock(j)}\n\nVERIFIED APPLICATION ARTIFACT MANIFEST / ACCESS BOUNDARY\n${artifactContext(state)}\nIf omittedArtifacts is greater than zero, this prompt does not contain the complete file-tree listing. Do not claim complete artifact or repository inspection from the embedded subset. Browser-persisted bytes are not agent-accessible merely because their metadata appears here. If omitted paths or substantive file contents are necessary and are not actually accessible in the execution context, use HUMAN_INPUT_REQUIRED, BLOCKED with MISSING_ARTIFACT/MISSING_APPLICATION_CONTEXT/MISSING_CAPABILITY as appropriate, or EXECUTION_FAILED after an attempted execution failure; never infer content from filenames, hashes, sizes, or metadata.\n\nCURRENT AGENT-NORMALIZED DELIVERABLE"
if s.count(old)!=1: raise SystemExit('artifact prompt block anchor mismatch')
s=s.replace(old,new,1)
p.write_text(s)

# 3) Ingestion must reject missing target identity on both response and controlling prompt.
replace_once('response-ingestion.js',
"const expected=currentScope(project,promptRecord),placeholder=value=>['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING'].includes(String(value??'').trim().toUpperCase()),laneKeys=['runId','contextId'];for(const key of operationContract?.scopeRequirements||[])if(laneKeys.includes(key)){if(placeholder(envelope.scope[key]))issues.push(issue('MISSING_REQUIRED_SCOPE',`/scope/${key}`,`Required execution-lane scope ${key} is missing or unresolved.`));if(placeholder(expected[key]))issues.push(issue('INVALID_CONTROLLING_PROMPT_SCOPE',`/scope/${key}`,`The saved controlling prompt is missing required execution-lane scope ${key}.`));}",
"const expected=currentScope(project,promptRecord),placeholder=value=>['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING'].includes(String(value??'').trim().toUpperCase()),targetKeys=['iterationId','candidateId','runId','contextId','baselineId','productId'];for(const key of operationContract?.scopeRequirements||[])if(targetKeys.includes(key)){if(placeholder(envelope.scope[key]))issues.push(issue('MISSING_REQUIRED_SCOPE',`/scope/${key}`,`Required application target scope ${key} is missing or unresolved.`));if(placeholder(expected[key]))issues.push(issue('INVALID_CONTROLLING_PROMPT_SCOPE',`/scope/${key}`,`The saved controlling prompt is missing required application target scope ${key}.`));}",
'ingestion target scope')

# 4) Make generic ingestion fixtures honor all operation scope requirements.
p=Path('verify-ingestion.mjs'); s=p.read_text()
old="""function savePrompt(p,stage){
  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};
  const record={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};
"""
new="""function promptOptions(p,stage,operation=stage===19?'COMPARE':schema.STAGE_CONTRACTS[stage].operations[0]){const scope={};for(const key of schema.operationContract(stage,operation).scopeRequirements){if(key==='projectRevision')scope[key]=Number(p.revision||0);else if(key==='inputVersion')scope[key]=p.job.CURRENT_INPUT_VERSION;else if(key==='sourceSetVersion')scope[key]='SOURCE-SET-v001';else if(key==='requirementsVersion')scope[key]='REQUIREMENTS-v001';else if(key==='testSuiteVersion')scope[key]='TEST-SUITE-v001';else if(key==='instructionVersion')scope[key]='INSTRUCTION-v001';else if(key==='iterationId')scope[key]='ITERATION-INGESTION-FIXTURE';else if(key==='candidateId')scope[key]='CANDIDATE-INGESTION-FIXTURE';else if(key==='runId')scope[key]='RUN-INGESTION-FIXTURE';else if(key==='contextId')scope[key]='CONTEXT-INGESTION-FIXTURE';else if(key==='baselineId')scope[key]='BASELINE-INGESTION-FIXTURE';else if(key==='productId')scope[key]='PRODUCT-INGESTION-FIXTURE';}if(scope.iterationId)p.job.CURRENT_ITERATION=scope.iterationId;if(scope.baselineId)p.job.CURRENT_BASELINE_ID=scope.baselineId;if(scope.productId)p.job.CURRENT_PRODUCT_ID=scope.productId;return {operation,scope};}
function savePrompt(p,stage){
  const options=promptOptions(p,stage);
  const record={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};
"""
if s.count(old)!=1: raise SystemExit('verify-ingestion savePrompt anchor mismatch')
s=s.replace(old,new,1)
old="if(stage<30){const nextStage=stage+1,nextOptions=nextStage===11?{scope:{runId:'RUN-NEXT-FIXTURE',contextId:'CONTEXT-NEXT-FIXTURE'}}:{};const nextPrompt=prompts.buildPromptRecord(nextStage,reloaded,nextOptions).prompt;"
new="if(stage<30){const nextStage=stage+1,nextOptions=promptOptions(reloaded,nextStage);const nextPrompt=prompts.buildPromptRecord(nextStage,reloaded,nextOptions).prompt;"
if s.count(old)!=1: raise SystemExit('verify-ingestion nextPrompt anchor mismatch')
s=s.replace(old,new,1)
s=s.replace("['baseline',20,'baselineId']","['baseline',21,'baselineId']",1)
# Explicit missing-target response cases.
anchor="scopeNegative('non-required populated scope identity',2,'baselineId');\n"
extra="""for(const [name,stage,operation,key] of [['missing candidate target',10,'COMPLETE','candidateId'],['missing run target',11,'COMPLETE','runId'],['missing context target',11,'COMPLETE','contextId'],['missing baseline target',21,'COMPLETE','baselineId'],['missing product target',21,'COMPLETE','productId']]){const p=project(`JOB-MISSING-${key}`),pr={...prompts.buildPromptRecord(stage,p,promptOptions(p,stage,operation)),scope:{...prompts.buildPromptRecord(stage,p,promptOptions(p,stage,operation)).scope}},e=blockedEnvelope(p,stage,pr);e.scope[key]=null;const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='MISSING_REQUIRED_SCOPE'&&i.path===`/scope/${key}`))throw new Error(`${name}: missing required application target was not rejected.`);negativeCount++;}
"""
if s.count(anchor)!=1: raise SystemExit('scope negative insertion anchor mismatch')
s=s.replace(anchor,anchor+extra,1)
p.write_text(s)

# 5) Semantic contradiction suite: target ordering, artifact access, stronger domain rules.
p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
anchor="  engine.ensureShape(p);\n  return p;\n}\n"
replacement="  engine.ensureShape(p);\n  p.projectData.candidateFreezes.push({id:'CANDIDATE-000001',stage:10,active:true,scope:{iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001'},fields:{CANDIDATE_ID:'CANDIDATE-000001',ITERATION_ID:'ITERATION-000001',COMPONENT_HASHES:{fixture:'a'.repeat(64)}}});\n  return p;\n}\n"
if s.count(anchor)!=1: raise SystemExit('semantic baseProject anchor mismatch')
s=s.replace(anchor,replacement,1)
s=s.replace("if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');","if(!record.prompt.includes('PATENT / REGULATED FILING')||!record.prompt.includes('prior-art or technical evidence')||!record.prompt.includes('claim support')||!record.prompt.includes('antecedent basis')||!record.prompt.includes('prior-art search completeness'))issues.push('PATENT_DOMAIN_RULE_MISSING');",1)
s=s.replace("if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');","if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM')||!record.prompt.includes('same basename in different directories are distinct artifacts')||!record.prompt.includes('must never be flattened or conflated'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');",1)
needle="  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n"
if s.count(needle)!=1: raise SystemExit('semantic engineering check anchor mismatch')
s=s.replace(needle,needle+"  if(!record.prompt.includes('VERIFIED APPLICATION ARTIFACT MANIFEST / ACCESS BOUNDARY')||!record.prompt.includes('Browser-persisted artifact bytes are not automatically available to the external agent')||!record.prompt.includes('Do not claim complete artifact or repository inspection'))issues.push('ARTIFACT_ACCESS_BOUNDARY_MISSING');\n",1)
anchor="if(schema.STAGE_OPERATIONS[19].includes('CONFIRM_FREEZE')||schema.operationContract(19,'CONFIRM_FREEZE'))throw new Error('Stage 19 still exposes application-owned freeze as an agent response operation.');\n"
extra="""{
 const blank=core.createBlankState('JOB-TARGET-SCOPE');blank.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(blank);let failure=null;try{prompts.buildPromptRecord(10,blank,{operation:'COMPLETE'});}catch(error){failure=error;}if(failure?.code!=='MISSING_REQUIRED_PROMPT_SCOPE'||!failure.missingScope?.includes('iterationId')||!failure.missingScope?.includes('candidateId'))throw new Error('Stage 10 can create a controlling review prompt before the application candidate/iteration identity exists.');
 const run17=schema.operationContract(17,'EXECUTE_RUN').scopeRequirements,verify17=schema.operationContract(17,'VERIFY').scopeRequirements,compare17=schema.operationContract(17,'COMPARE').scopeRequirements,run19=schema.operationContract(19,'EXECUTE_RUN').scopeRequirements;if(!run17.includes('runId')||!run17.includes('contextId')||!verify17.includes('runId')||!verify17.includes('contextId')||compare17.includes('runId')||compare17.includes('contextId')||!run19.includes('runId')||!run19.includes('contextId'))throw new Error('Stage 17/19 operation scope does not bind run-specific operations to exact reserved run/context identities.');
 const s20=schema.operationContract(20,'COMPLETE').scopeRequirements,s21=schema.operationContract(21,'COMPLETE').scopeRequirements;if(s20.includes('baselineId')||!s20.includes('candidateId')||!s21.includes('baselineId')||!s21.includes('productId'))throw new Error('Baseline/product target scope is ordered incorrectly across Stage 20/21.');
 if(!schema.operationContract(10,'COMPLETE').readCollections.includes('candidateFreezes')||!schema.operationContract(10,'COMPLETE').readCollections.includes('artifacts')||!schema.operationContract(21,'COMPLETE').readCollections.includes('products'))throw new Error('Target-bound prompt cannot read the exact application-reserved target records/artifacts.');
}
{
 const p=baseProject();for(let i=0;i<260;i++)p.projectData.artifacts.push({id:`ART-${String(i).padStart(4,'0')}`,active:true,scope:{inputVersion:'INPUT-v001'},fields:{ARTIFACT_ID:`ART-${String(i).padStart(4,'0')}`,FILENAME:`pkg/${String(i).padStart(4,'0')}/index.ts`,TYPE:'text/plain',BYTE_SIZE:1,SHA256:'a'.repeat(64),ROLE:'SUPPLIED',STORAGE_REFERENCE:`indexeddb:ART-${i}`,AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}});const r=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});if(!r.prompt.includes('\"totalArtifacts\": 260')||!r.prompt.includes('\"omittedArtifacts\": 10')||!r.prompt.includes('\"completeManifestSha256\"'))throw new Error('Large artifact manifests are silently truncated or lack complete-manifest identity.');if(r.prompt.includes('pkg/0259/index.ts'))throw new Error('Bounded artifact manifest unexpectedly embedded omitted tail content.');
}
"""
if s.count(anchor)!=1: raise SystemExit('semantic scope insertion anchor mismatch')
s=s.replace(anchor,anchor+extra,1)
p.write_text(s)

# Remove temporary implementation mechanism from final branch tree.
Path('finalize-semantic-closure.py').unlink(missing_ok=True)
Path('.github/workflows/finalize-semantic-closure.yml').unlink(missing_ok=True)
