from pathlib import Path
import hashlib
import re


def replace_once(path, old, new, label):
    p=Path(path); s=p.read_text()
    count=s.count(old)
    if count!=1: raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    p.write_text(s.replace(old,new,1))

# Scope/read contracts: only identities that must pre-exist before meaningful agent work.
replace_once('workflow-schema.js',
"10:['instructions','preflightRecords','tests','failureTests']",
"10:['instructions','preflightRecords','tests','failureTests','candidateFreezes','iterations','artifacts']",
'Stage 10 read context')
replace_once('workflow-schema.js',
"12:['runs','requirements','tests','freshContexts']",
"12:['runs','requirements','tests','verification','freshContexts']",
'Stage 12 continuation read context')
replace_once('workflow-schema.js',
"21:['baselines','freshContexts']",
"21:['baselines','products','freshContexts','artifacts']",
'Stage 21 read context')
replace_once('workflow-schema.js',
"if(s===11)keys.push('runId','contextId');if(s>=20)keys.push('baselineId');if(s>=21)keys.push('productId');",
"if([11,17,19].includes(s))keys.push('runId','contextId');if(s>=21)keys.push('baselineId','productId');",
'scope target ordering')
p=Path('workflow-schema.js'); s=p.read_text()
old="VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts'],agentWritableCollections:['verification'],allowedStageData:[]})"
new="VERIFY:Object.freeze({readCollections:['runs','requirements','tests','verification','freshContexts'],agentWritableCollections:['verification'],allowedStageData:[]})"
if s.count(old)!=2: raise SystemExit(f'repeated VERIFY read contract: expected 2 anchors, found {s.count(old)}')
s=s.replace(old,new)
p.write_text(s)

# Prompt engine: application blocker authority, exact recovery scope, artifact access boundary,
# specialist-domain precision, target identity, and continuation-safe verification context.
p=Path('prompt-engine.js'); s=p.read_text()
replace="const hash=globalThis.closedLoopHash;\nif(!core||!schema||!hash)throw new Error('workbook.js, hash.js, and workflow-schema.js must load before prompt-engine.js.');"
new="const hash=globalThis.closedLoopHash;\nconst workflow=globalThis.closedLoopWorkflowEngine;\nif(!core||!schema||!hash||!workflow)throw new Error('workbook.js, hash.js, workflow-schema.js, and workflow-engine.js must load before prompt-engine.js.');"
if s.count(replace)!=1: raise SystemExit('prompt dependency anchor mismatch')
s=s.replace(replace,new,1)
anchor="function humanInputBlock(job){\n const definitions=schema.JOB_FIELDS||{};\n const names=Object.entries(definitions).filter(([,definition])=>definition?.producer==='HUMAN').map(([name])=>name);\n return names.length?names.map(name=>`${name}:\\n${show(job?.[name])}`).join('\\n\\n'):'NONE';\n}\n"
artifact_fn="""function artifactContext(state){
 const active=(Array.isArray(state?.projectData?.artifacts)?state.projectData.artifacts:[]).filter(record=>record?.active!==false&&!record?.invalidatedBy),limit=Number(schema.DEFAULT_RESOURCE_LIMITS?.maxRecordsPerCollection||250),ordered=[...active].sort((a,b)=>String(a?.fields?.FILENAME||a?.FILENAME||'').localeCompare(String(b?.fields?.FILENAME||b?.FILENAME||''))||recordId(a,'artifacts').localeCompare(recordId(b,'artifacts'))),identity=record=>({artifactId:recordId(record,'artifacts'),logicalPath:record?.fields?.FILENAME||record?.FILENAME||'UNKNOWN',mediaType:record?.fields?.TYPE||record?.TYPE||'UNKNOWN',byteSize:record?.fields?.BYTE_SIZE??record?.BYTE_SIZE??'UNKNOWN',sha256:record?.fields?.SHA256||record?.SHA256||'UNKNOWN',role:record?.fields?.ROLE||record?.ROLE||'UNKNOWN',availability:record?.fields?.AVAILABILITY||record?.AVAILABILITY||'UNKNOWN',storageReference:record?.fields?.STORAGE_REFERENCE||record?.STORAGE_REFERENCE||'UNKNOWN',scope:record?.scope||{}});const all=ordered.map(identity),shown=all.slice(0,limit);return show({totalArtifacts:all.length,shownArtifacts:shown.length,omittedArtifacts:Math.max(0,all.length-shown.length),completeManifestSha256:hash.sha256Value(all),artifacts:shown,selectionRule:`Sorted canonical artifact identities; at most ${limit} paths are embedded in this prompt. Any omission is explicit and hashed, never silent.`,agentAccessBoundary:'This manifest proves browser-side identity metadata only. Browser-persisted artifact bytes are not automatically available to the external agent. The agent may inspect substantive file content only when those bytes or an equivalent repository/package are actually supplied in its execution context.'});
}
"""
if s.count(anchor)!=1: raise SystemExit('artifact context insertion anchor mismatch')
s=s.replace(anchor,anchor+artifact_fn,1)
old="12:'Verify each current execution independently. Produce one substantive verification proposal for every required REQ_ID × RUN_ID × TEST_ID triple in the current operation scope, preserving verifier and verifier-context identity, independence status, inputs, procedure, expected result, observed result, exact evidence, SATISFIED/VIOLATED/UNDETERMINED, defect reference where applicable, and reason for UNDETERMINED. Do not omit or duplicate required triples, substitute wrong-version or wrong-iteration records, or self-validate. The application reconciles matrix counts and completeness mathematically.',"
new="12:'Verify each current execution independently. Produce one substantive verification proposal for every currently missing required REQ_ID × RUN_ID × TEST_ID triple in the current operation scope, preserving verifier and verifier-context identity, independence status, inputs, procedure, expected result, observed result, exact evidence, SATISFIED/VIOLATED/UNDETERMINED, defect reference where applicable, and reason for UNDETERMINED. Never repeat an already-current triple, substitute wrong-version or wrong-iteration records, or self-validate. If the complete missing matrix cannot fit within the declared response resource limits, return the next deterministic non-overlapping batch in REQ_ID, RUN_ID, TEST_ID order; after accepted ingestion the application regenerates this same stage against the current completed-triple manifest and continues until the matrix is complete. The application reconciles matrix counts and completeness mathematically and a partial batch never completes the stage.',"
if s.count(old)!=1: raise SystemExit('Stage 12 continuation procedure anchor mismatch')
s=s.replace(old,new,1)
old="function boundedCollection(state,collection,scope={}){\n const selected=selectedContextRecords(state,collection,scope);if(!selected.length)return 'NONE';\n return show({totalSelected:selected.length,records:selected.map(record=>({id:recordId(record,collection),stage:record.stage??'UNKNOWN',scope:record.scope||{},fields:record.fields||record,relationships:record.relationships||{},contentSha256:record.contentSha256||record.sha256||'UNKNOWN'})),omitted:0,selectionRule:'Only active records matching the explicit operation read contract and controlling prompt scope are selected; large artifact bytes are referenced by canonical artifact identity.'});\n}"
new="function boundedCollection(state,collection,scope={},options={}){\n const selected=selectedContextRecords(state,collection,scope);if(!selected.length)return 'NONE';\n const compactVerification=options.compactVerification===true&&collection==='verification';\n const records=compactVerification?selected.map(record=>({id:recordId(record,collection),scope:record.scope||{},triple:{REQ_ID:record?.fields?.REQ_ID??record?.REQ_ID??null,RUN_ID:record?.fields?.RUN_ID??record?.RUN_ID??null,TEST_ID:record?.fields?.TEST_ID??record?.TEST_ID??null},relationships:record.relationships||{},determination:record?.fields?.DETERMINATION??record?.DETERMINATION??null,contentSha256:record.contentSha256||record.sha256||'UNKNOWN'})):selected.map(record=>({id:recordId(record,collection),stage:record.stage??'UNKNOWN',scope:record.scope||{},fields:record.fields||record,relationships:record.relationships||{},contentSha256:record.contentSha256||record.sha256||'UNKNOWN'}));\n return show({totalSelected:selected.length,records,omitted:0,selectionRule:compactVerification?'Current accepted verification records are represented as a compact completion manifest so continuation batches can avoid duplicate REQ_ID × RUN_ID × TEST_ID work without replaying full verification prose.':'Only active records matching the explicit operation read contract and controlling prompt scope are selected; large artifact bytes are referenced by canonical artifact identity.'});\n}"
if s.count(old)!=1: raise SystemExit('boundedCollection anchor mismatch')
s=s.replace(old,new,1)
old="const samePromptScope=(a,b={})=>['iterationId','candidateId','runId','contextId','baselineId','productId'].every(key=>String(a?.[key]??'')===String(b?.[key]??''));"
new="const PROMPT_SCOPE_KEYS=Object.freeze(['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId']);\nconst samePromptScope=(a,b={})=>PROMPT_SCOPE_KEYS.every(key=>String(a?.[key]??'')===String(b?.[key]??''));\nconst answeredPromptScope=(answer,scope={})=>samePromptScope({...answer?.scope,inputVersion:answer?.inputVersion??answer?.scope?.inputVersion},scope);"
if s.count(old)!=1: raise SystemExit('samePromptScope anchor mismatch')
s=s.replace(old,new,1)
old=" const lane=x=>Number(x?.stage)===stage&&(!x?.operation||x.operation===operation)&&(!x?.scope||samePromptScope(x.scope,scope));"
new=" const lane=x=>Number(x?.stage)===stage&&String(x?.operation||'')===String(operation||'')&&Boolean(x?.scope)&&samePromptScope(x.scope,scope);"
if s.count(old)!=1: raise SystemExit('recovery lane anchor mismatch')
s=s.replace(old,new,1)
old=" const open=(state?.projectData?.blockers||[]).filter(x=>!x.invalidatedBy&&!['CLOSED','RESOLVED','RETIRED'].includes(String(x?.fields?.STATUS||x?.STATUS||x?.status||'OPEN').toUpperCase()));if(open.length)parts.push(`APPLICABLE OPEN BLOCKERS\\n${show(open)}`);\n const questions=(state?.projectData?.humanInputRequests||[]).filter(x=>Number(x.stage)===stage&&String(x.status||'OPEN').toUpperCase()==='OPEN'&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope)));if(questions.length)parts.push(`UNRESOLVED HUMAN INPUT REQUESTS\\n${show(questions)}`);\n const answered=(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({questionId:x.requestId,question:x.question,answer:x.answer,answerType:x.answerType||'UNKNOWN',inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||'UNKNOWN',operatorLabel:x.operatorLabel||x.operator||'UNSPECIFIED',affectedStageFields:x.affectedStageFields||[],affectedRecords:x.affectedRecords||[]}));if(answered.length)parts.push(`ANSWERED HUMAN CLARIFICATIONS\\n${show(answered)}`);"
new=" const open=workflow.openBlockers(state,stage);if(open.length)parts.push(`APPLICABLE OPEN BLOCKERS\\n${show(open)}`);\n const questions=(state?.projectData?.humanInputRequests||[]).filter(x=>Number(x.stage)===stage&&String(x.status||'OPEN').toUpperCase()==='OPEN'&&String(x.operation||'')===String(operation||'')&&Boolean(x.scope)&&samePromptScope(x.scope,scope));if(questions.length)parts.push(`UNRESOLVED HUMAN INPUT REQUESTS\\n${show(questions)}`);\n const answered=(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage&&String(x.operation||'')===String(operation||'')&&answeredPromptScope(x,scope)).map(x=>({questionId:x.requestId,question:x.question,answer:x.answer,answerType:x.answerType||'UNKNOWN',inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||'UNKNOWN',operatorLabel:x.operatorLabel||x.operator||'UNSPECIFIED',affectedStageFields:x.affectedStageFields||[],affectedRecords:x.affectedRecords||[]}));if(answered.length)parts.push(`ANSWERED HUMAN CLARIFICATIONS\\n${show(answered)}`);"
if s.count(old)!=1: raise SystemExit('context blocker/question/answer anchor mismatch')
s=s.replace(old,new,1)
old="const op=schema.operationContract(stage,operation||schema.STAGE_CONTRACTS[stage].operations[0]);for(const collection of op?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[])parts.push(`${collection.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toUpperCase()}\\n${boundedCollection(state,collection,scope)}`);"
new="const op=schema.operationContract(stage,operation||schema.STAGE_CONTRACTS[stage].operations[0]);for(const collection of op?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]){const compactVerification=collection==='verification'&&(stage===12||((stage===17||stage===19)&&operation==='VERIFY'));parts.push(`${collection.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toUpperCase()}\\n${boundedCollection(state,collection,scope,{compactVerification})}`);}"
if s.count(old)!=1: raise SystemExit('context collection loop anchor mismatch')
s=s.replace(old,new,1)
old="function assertRequiredPromptScope(stage,operation,scope){const required=schema.operationContract(stage,operation)?.scopeRequirements||[],laneKeys=['runId','contextId'],missing=required.filter(key=>laneKeys.includes(key)&&scopePlaceholder(scope?.[key]));if(missing.length){const error=new Error(`Controlling instruction cannot be created until application execution-lane identity exists for: ${missing.join(', ')}.`);error.code='MISSING_REQUIRED_PROMPT_SCOPE';error.missingScope=missing;throw error;}return scope;}"
new="function assertRequiredPromptScope(stage,operation,scope){const required=schema.operationContract(stage,operation)?.scopeRequirements||[],targetKeys=['iterationId','candidateId','runId','contextId','baselineId','productId'],missing=required.filter(key=>targetKeys.includes(key)&&scopePlaceholder(scope?.[key]));if(missing.length){const error=new Error(`Controlling instruction cannot be created until application target identity exists for: ${missing.join(', ')}.`);error.code='MISSING_REQUIRED_PROMPT_SCOPE';error.missingScope=missing;throw error;}return scope;}"
if s.count(old)!=1: raise SystemExit('prompt target guard anchor mismatch')
s=s.replace(old,new,1)
old="- PATENT / REGULATED FILING: identify the governing jurisdiction or office, filing type, priority/continuity facts, applicant/inventor facts, disclosure, claims, drawings, abstract, specification/formality requirements, and other filing-specific elements that materially affect the requested work. Use current official office rules, statutes, regulations, manuals, forms, and other controlling authority where applicable. Never invent inventorship, ownership, priority, dates, legal status, or filing facts; request missing human-only facts or decisions."
new="- PATENT / REGULATED FILING: identify the governing jurisdiction or office, filing type, priority/continuity facts, applicant/inventor facts, disclosure, claims, drawings, abstract, specification/formality requirements, and other filing-specific elements that materially affect the requested work. Distinguish procedural/legal filing authority from patent literature and non-patent literature used as prior-art or technical evidence. Check claim support, antecedent basis, terminology consistency, drawing/reference-numeral consistency, written-description and enablement support, and disclosure support where applicable. For prior-art work, preserve databases searched, queries/classifications, dates, material references, and search limitations. Use current official office rules, statutes, regulations, manuals, forms, and other controlling authority where applicable. Never invent inventorship, ownership, priority, continuity, dates, legal status, filing facts, prior-art search completeness, database-search coverage, filing/submission status, legal sufficiency, or patentability; request missing human-only facts or decisions and state search/tool limitations explicitly."
if s.count(old)!=1: raise SystemExit('patent domain anchor mismatch')
s=s.replace(old,new,1)
old="- SOFTWARE / MULTI-FILE SYSTEM: reason over the complete supplied file tree or manifest and the relevant interfaces, data models, dependencies, build/deploy/test constraints, migrations, security, observability, configuration, and operational boundaries. When repository or runtime access is unavailable, produce a complete implementation-ready multi-file specification or patch plan with exact logical files/components, responsibilities, interfaces, changes, and acceptance tests instead of claiming files were changed."
new="- SOFTWARE / MULTI-FILE SYSTEM: reason over the complete supplied file tree or manifest and the relevant interfaces, data models, dependencies, build/deploy/test constraints, migrations, security, observability, configuration, and operational boundaries. Preserve logical paths exactly; files with the same basename in different directories are distinct artifacts and must never be flattened or conflated. When repository or runtime access is unavailable, produce a complete implementation-ready multi-file specification or patch plan with exact logical files/components, responsibilities, interfaces, changes, and acceptance tests instead of claiming files were changed."
if s.count(old)!=1: raise SystemExit('software domain anchor mismatch')
s=s.replace(old,new,1)
old="${humanInputBlock(j)}\\n\\nCURRENT AGENT-NORMALIZED DELIVERABLE"
new="${humanInputBlock(j)}\\n\\nVERIFIED APPLICATION ARTIFACT MANIFEST / ACCESS BOUNDARY\\n${artifactContext(state)}\\nIf omittedArtifacts is greater than zero, this prompt does not contain the complete file-tree listing. Do not claim complete artifact or repository inspection from the embedded subset. Browser-persisted bytes are not agent-accessible merely because their metadata appears here. If omitted paths or substantive file contents are necessary and are not actually accessible in the execution context, use HUMAN_INPUT_REQUIRED, BLOCKED with MISSING_ARTIFACT/MISSING_APPLICATION_CONTEXT/MISSING_CAPABILITY as appropriate, or EXECUTION_FAILED after an attempted execution failure; never infer content from filenames, hashes, sizes, or metadata.\\n\\nCURRENT AGENT-NORMALIZED DELIVERABLE"
if s.count(old)!=1: raise SystemExit('artifact prompt block anchor mismatch')
s=s.replace(old,new,1)
anchor="- Before substantive work, determine whether the combined human input, current canonical application context, prior accepted output, evidence, supplied artifacts, and actually available tools are sufficient for this specific stage and domain. Sufficiency is a reasoned stage-specific determination, not a hard-coded field count."
addition=anchor+"\n- Verification-matrix work is continuation-safe: when the currently missing REQ_ID × RUN_ID × TEST_ID records cannot fit within the declared response limits, return the next deterministic non-overlapping batch in REQ_ID, RUN_ID, TEST_ID order. Accepted current triples are supplied as a compact completion manifest; do not repeat them. A partial batch never satisfies the application-derived completeness gate."
if s.count(anchor)!=1: raise SystemExit('verification continuation rule anchor mismatch')
s=s.replace(anchor,addition,1)
old="answeredHumanClarifications:(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({requestId:x.requestId,answerId:x.answerId,inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||null}))"
new="answeredHumanClarifications:(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage&&String(x.operation||'')===String(operation||'')&&answeredPromptScope(x,scope)).map(x=>({requestId:x.requestId,answerId:x.answerId,inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||null}))"
if s.count(old)!=1: raise SystemExit('context manifest answered clarification anchor mismatch')
s=s.replace(old,new,1)
p.write_text(s)

# Ingestion: enforce application target identity and the effective stage text limit.
p=Path('response-ingestion.js'); s=p.read_text()
old="function validateValue(definition,value,path,issues,{required=false}={}){"
new="function validateValue(definition,value,path,issues,{required=false,maxTextFieldLength=schema.DEFAULT_RESOURCE_LIMITS.maxTextFieldLength}={}){"
if s.count(old)!=1: raise SystemExit('validateValue signature anchor mismatch')
s=s.replace(old,new,1)
old="if(typeof value==='string'&&value.length>200000)issues.push(issue('TEXT_FIELD_TOO_LARGE',path,'Text field exceeds the configured maximum length.'));"
new="if(typeof value==='string'&&value.length>Number(maxTextFieldLength))issues.push(issue('TEXT_FIELD_TOO_LARGE',path,'Text field exceeds the configured maximum length.'));"
if s.count(old)!=1: raise SystemExit('text limit anchor mismatch')
s=s.replace(old,new,1)
old="const expected=currentScope(project,promptRecord),placeholder=value=>['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING'].includes(String(value??'').trim().toUpperCase()),laneKeys=['runId','contextId'];for(const key of operationContract?.scopeRequirements||[])if(laneKeys.includes(key)){if(placeholder(envelope.scope[key]))issues.push(issue('MISSING_REQUIRED_SCOPE',`/scope/${key}`,`Required execution-lane scope ${key} is missing or unresolved.`));if(placeholder(expected[key]))issues.push(issue('INVALID_CONTROLLING_PROMPT_SCOPE',`/scope/${key}`,`The saved controlling prompt is missing required execution-lane scope ${key}.`));}"
new="const expected=currentScope(project,promptRecord),placeholder=value=>['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING'].includes(String(value??'').trim().toUpperCase()),targetKeys=['iterationId','candidateId','runId','contextId','baselineId','productId'];for(const key of operationContract?.scopeRequirements||[])if(targetKeys.includes(key)){if(placeholder(envelope.scope[key]))issues.push(issue('MISSING_REQUIRED_SCOPE',`/scope/${key}`,`Required application target scope ${key} is missing or unresolved.`));if(placeholder(expected[key]))issues.push(issue('INVALID_CONTROLLING_PROMPT_SCOPE',`/scope/${key}`,`The saved controlling prompt is missing required application target scope ${key}.`));}"
if s.count(old)!=1: raise SystemExit('ingestion target scope anchor mismatch')
s=s.replace(old,new,1)
old="validateValue(definition,value,path,issues);"
new="validateValue(definition,value,path,issues,{maxTextFieldLength:contract?.resourceLimits?.maxTextFieldLength??schema.DEFAULT_RESOURCE_LIMITS.maxTextFieldLength});"
if s.count(old)!=1: raise SystemExit('stageData validateValue call anchor mismatch')
s=s.replace(old,new,1)
old="validateValue(fieldDefinition,value,fieldPath,issues,{required:definition.required.includes(name)});"
new="validateValue(fieldDefinition,value,fieldPath,issues,{required:definition.required.includes(name),maxTextFieldLength:contract?.resourceLimits?.maxTextFieldLength??schema.DEFAULT_RESOURCE_LIMITS.maxTextFieldLength});"
if s.count(old)!=1: raise SystemExit('record validateValue call anchor mismatch')
s=s.replace(old,new,1)
p.write_text(s)

# Operator UI: bind display/actions/refinement to the selected stage operation and exact current scope.
p=Path('app-core.js'); s=p.read_text()
anchor="function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}\n"
helpers="""const operatorScopeKeys=['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'];
function currentOperatorScope(n){return globalThis.closedLoopPromptEngine.scopeFor(n,current,promptOptions(n).scope||{});}
function operatorLaneMatches(item,n){if(Number(item?.stage)!==Number(n)||item?.invalidatedBy)return false;const operation=String(item?.envelope?.operation||item?.operation||'COMPLETE'),selected=selectedOperation(n);if(operation!==selected)return false;const actual=item?.envelope?.scope||item?.scope||{},expected=currentOperatorScope(n),required=schema.operationContract(n,operation)?.scopeRequirements||[];for(const key of operatorScopeKeys){const av=actual?.[key],ev=expected?.[key];if(av!==undefined&&av!==null&&av!==''&&ev!==undefined&&ev!==null&&ev!==''&&String(av)!==String(ev))return false;}for(const key of required){if(key==='projectRevision')continue;if(String(actual?.[key]??'')!==String(expected?.[key]??''))return false;}return true;}
function validationLaneRecord(validation){return safe(current.projectData.generatedPrompts).find(x=>(x.instructionId||x.promptId)===validation?.promptId)||validation;}
function acceptedLaneChanges(n){return engine.acceptedChanges(current,n).filter(x=>operatorLaneMatches(x,n));}
"""
if s.count(anchor)!=1: raise SystemExit('operator lane helper anchor mismatch')
s=s.replace(anchor,anchor+helpers,1)
old="function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n).at(-1);if(!v||v.valid)return '';"
new="function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n&&!x.valid&&operatorLaneMatches(validationLaneRecord(x),n)).at(-1);if(!v)return '';"
if s.count(old)!=1: raise SystemExit('validation lane anchor mismatch')
s=s.replace(old,new,1)
old="function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===n&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);"
new="function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);"
if s.count(old)!=1: raise SystemExit('proposal lane anchor mismatch')
s=s.replace(old,new,1)
old="${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?`<details class=\"record-card\"><summary>Refine accepted result<span>Controlled</span></summary>"
new="${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?`<details class=\"record-card\"><summary>Refine accepted result<span>Controlled</span></summary>"
if s.count(old)!=1: raise SystemExit('accepted refinement visibility anchor mismatch')
s=s.replace(old,new,1)
old="function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===current.activeStage&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);}"
new="function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage)).at(-1);}"
if s.count(old)!=1: raise SystemExit('pending proposal lane anchor mismatch')
s=s.replace(old,new,1)
pattern=re.compile(r"const next=clone\(current\),stage=current\.activeStage,changes=engine\.acceptedChanges\(next,stage\),operation=selectedOperation\(stage\),scope=promptOptions\(stage\)\?\.scope\|\|\{\},targetKeys=\['iterationId','candidateId','runId','contextId','baselineId','productId'\],matches=changes\.filter\(change=>String\(change\.operation\|\|'COMPLETE'\)===String\(operation\)&&targetKeys\.every\(key=>scope\[key\]===undefined\|\|scope\[key\]===null\|\|scope\[key\]===''\|\|String\(change\.scope\?\.\[key\]\?\?''\)===String\(scope\[key\]\)\)\),change=matches\.at\(-1\)\|\|\(\(changes\.length===1\)\?changes\[0\]:null\);")
s,count=pattern.subn("const next=clone(current),stage=current.activeStage,change=acceptedLaneChanges(stage).at(-1);",s,count=1)
if count!=1: raise SystemExit(f'accepted refinement action lane anchor mismatch: {count}')
p.write_text(s)

# Ingestion test fixtures must honor all operation target scope requirements.
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
if s.count(old)!=1: raise SystemExit('verify-ingestion next prompt anchor mismatch')
s=s.replace(old,new,1)
s=s.replace("['baseline',20,'baselineId']","['baseline',21,'baselineId']",1)
anchor="scopeNegative('non-required populated scope identity',2,'baselineId');\n"
extra="""for(const [name,stage,operation,key] of [['missing candidate target',10,'COMPLETE','candidateId'],['missing run target',11,'COMPLETE','runId'],['missing context target',11,'COMPLETE','contextId'],['missing corrected-run target',17,'EXECUTE_RUN','runId'],['missing corrected-context target',17,'VERIFY','contextId'],['missing confirmation-run target',19,'EXECUTE_RUN','runId'],['missing confirmation-context target',19,'VERIFY','contextId'],['missing baseline target',21,'COMPLETE','baselineId'],['missing product target',21,'COMPLETE','productId']]){const p=project(`JOB-MISSING-${key}-${stage}`),options=promptOptions(p,stage,operation),pr=prompts.buildPromptRecord(stage,p,options),e=blockedEnvelope(p,stage,pr);e.scope[key]=null;const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='MISSING_REQUIRED_SCOPE'&&i.path===`/scope/${key}`))throw new Error(`${name}: missing required application target was not rejected.`);negativeCount++;}
{
 const issues=[];ingestion.validateValue({valueType:'STRING',nullable:false,enumValues:[]},'12345','/contract-limit',issues,{maxTextFieldLength:4});if(!issues.some(x=>x.code==='TEXT_FIELD_TOO_LARGE'))throw new Error('Effective contract text-field limit is not enforced.');
}
"""
if s.count(anchor)!=1: raise SystemExit('verify-ingestion target negative insertion anchor mismatch')
s=s.replace(anchor,anchor+extra,1)
p.write_text(s)

# Prompt semantic tests: domain fidelity, target ordering, artifact access, continuation and recovery isolation.
p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
old="  engine.ensureShape(p);\n  return p;\n}"
new="  engine.ensureShape(p);\n  p.projectData.candidateFreezes.push({id:'CANDIDATE-000001',stage:10,active:true,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001'},fields:{CANDIDATE_ID:'CANDIDATE-000001',ITERATION_ID:'ITERATION-000001',COMPONENT_HASHES:{fixture:'a'.repeat(64)}}});\n  return p;\n}"
if s.count(old)!=1: raise SystemExit('semantic baseProject anchor mismatch')
s=s.replace(old,new,1)
s=s.replace("if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');","if(!record.prompt.includes('PATENT / REGULATED FILING')||!record.prompt.includes('prior-art or technical evidence')||!record.prompt.includes('claim support')||!record.prompt.includes('antecedent basis')||!record.prompt.includes('prior-art search completeness'))issues.push('PATENT_DOMAIN_RULE_MISSING');",1)
s=s.replace("if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');","if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM')||!record.prompt.includes('same basename in different directories are distinct artifacts')||!record.prompt.includes('must never be flattened or conflated'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');",1)
needle="  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n"
if s.count(needle)!=1: raise SystemExit('semantic physical engineering anchor mismatch')
s=s.replace(needle,needle+"  if(!record.prompt.includes('VERIFIED APPLICATION ARTIFACT MANIFEST / ACCESS BOUNDARY')||!record.prompt.includes('Browser-persisted artifact bytes are not automatically available to the external agent')||!record.prompt.includes('Do not claim complete artifact or repository inspection'))issues.push('ARTIFACT_ACCESS_BOUNDARY_MISSING');\n",1)
anchor="if(schema.STAGE_OPERATIONS[19].includes('CONFIRM_FREEZE')||schema.operationContract(19,'CONFIRM_FREEZE'))throw new Error('Stage 19 still exposes application-owned freeze as an agent response operation.');\n"
proof="""if(!schema.operationContract(12,'COMPLETE').readCollections.includes('verification'))throw new Error('Stage 12 continuation prompts cannot see accepted verification progress.');
for(const stage of [17,19])if(!schema.operationContract(stage,'VERIFY').readCollections.includes('verification'))throw new Error(`Stage ${stage} VERIFY continuation prompts cannot see accepted verification progress.`);
{
 const blank=core.createBlankState('JOB-TARGET-SCOPE');blank.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(blank);let failure=null;try{prompts.buildPromptRecord(10,blank,{operation:'COMPLETE'});}catch(error){failure=error;}if(failure?.code!=='MISSING_REQUIRED_PROMPT_SCOPE'||!failure.missingScope?.includes('iterationId')||!failure.missingScope?.includes('candidateId'))throw new Error('Stage 10 can create a controlling candidate-review prompt before application candidate/iteration identity exists.');
 const run17=schema.operationContract(17,'EXECUTE_RUN').scopeRequirements,verify17=schema.operationContract(17,'VERIFY').scopeRequirements,compare17=schema.operationContract(17,'COMPARE').scopeRequirements,run19=schema.operationContract(19,'EXECUTE_RUN').scopeRequirements,verify19=schema.operationContract(19,'VERIFY').scopeRequirements;if(!run17.includes('runId')||!run17.includes('contextId')||!verify17.includes('runId')||!verify17.includes('contextId')||compare17.includes('runId')||compare17.includes('contextId')||!run19.includes('runId')||!run19.includes('contextId')||!verify19.includes('runId')||!verify19.includes('contextId'))throw new Error('Stage 17/19 run-specific operations are not bound to exact reserved run/context identities.');
 const s20=schema.operationContract(20,'COMPLETE').scopeRequirements,s21=schema.operationContract(21,'COMPLETE').scopeRequirements;if(s20.includes('baselineId')||!s20.includes('candidateId')||!s21.includes('baselineId')||!s21.includes('productId'))throw new Error('Baseline/product target scope is ordered incorrectly across Stage 20/21.');
}
{
 const p=baseProject();for(let i=0;i<260;i++)p.projectData.artifacts.push({id:`ART-${String(i).padStart(4,'0')}`,active:true,scope:{inputVersion:'INPUT-v001'},fields:{ARTIFACT_ID:`ART-${String(i).padStart(4,'0')}`,FILENAME:`pkg/${String(i).padStart(4,'0')}/index.ts`,TYPE:'text/plain',BYTE_SIZE:1,SHA256:'a'.repeat(64),ROLE:'SUPPLIED',STORAGE_REFERENCE:`indexeddb:ART-${i}`,AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}});const r=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});if(!r.prompt.includes('"totalArtifacts": 260')||!r.prompt.includes('"omittedArtifacts": 10')||!r.prompt.includes('"completeManifestSha256"'))throw new Error('Large artifact manifests are silently truncated or lack complete-manifest identity.');if(r.prompt.includes('pkg/0259/index.ts'))throw new Error('Bounded artifact manifest unexpectedly embedded omitted tail content.');
}
{
 const p=baseProject();p.projectData.blockers.push({id:'BLOCKER-OTHER-STAGE',stage:24,active:true,fields:{BLOCKER_ID:'BLOCKER-OTHER-STAGE',STATUS:'OPEN',WHY_WORK_CANNOT_CONTINUE:'Stage 24 only'}});let r=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});if(r.prompt.includes('BLOCKER-OTHER-STAGE'))throw new Error('Stage-inapplicable blocker leaked into prompt context.');p.projectData.blockers.push({id:'BLOCKER-STAGE-2',stage:2,active:true,fields:{BLOCKER_ID:'BLOCKER-STAGE-2',STATUS:'OPEN',WHY_WORK_CANNOT_CONTINUE:'Stage 2 blocker'}});r=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});if(!r.prompt.includes('BLOCKER-STAGE-2'))throw new Error('Applicable Stage 2 blocker was omitted from prompt context.');
}
{
 const p=baseProject(),scope=prompts.scopeFor(2,p,{});p.projectData.rejectedResponses.push({rejectedResponseId:'REJECT-STALE',stage:2,operation:'COMPLETE',scope:{...scope,inputVersion:'INPUT-v000'},requestCorrection:true,reason:'STALE VERSION MUST NOT LEAK'});p.projectData.rejectedResponses.push({rejectedResponseId:'REJECT-LEGACY',stage:2,requestCorrection:true,reason:'MISSING SCOPE MUST NOT LEAK'});p.projectData.rejectedResponses.push({rejectedResponseId:'REJECT-CURRENT',stage:2,operation:'COMPLETE',scope:{...scope},requestCorrection:true,reason:'CURRENT CORRECTION MUST APPEAR'});const r=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});if(r.prompt.includes('STALE VERSION MUST NOT LEAK')||r.prompt.includes('MISSING SCOPE MUST NOT LEAK')||!r.prompt.includes('CURRENT CORRECTION MUST APPEAR'))throw new Error('Prompt recovery feedback is not isolated to the exact current operation/version target.');
}
{
 const p=baseProject();p.projectData.verification.push({id:'VERIFICATION-CONTINUATION',stage:12,active:true,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001'},fields:{VERIFICATION_ID:'VERIFICATION-CONTINUATION',REQ_ID:'REQ-000001',RUN_ID:'RUN-000001',TEST_ID:'TEST-000001',DETERMINATION:'SATISFIED',EXACT_EVIDENCE:'large prose that must not be replayed in a continuation prompt'}});const r=prompts.buildPromptRecord(12,p,{operation:'COMPLETE'});if(!r.prompt.includes('currently missing required REQ_ID × RUN_ID × TEST_ID')||!r.prompt.includes('deterministic non-overlapping batch')||!r.prompt.includes('compact completion manifest'))throw new Error('Stage 12 prompt lacks continuation semantics.');if(!r.prompt.includes('VERIFICATION-CONTINUATION')||!r.prompt.includes('REQ-000001')||!r.prompt.includes('RUN-000001')||!r.prompt.includes('TEST-000001'))throw new Error('Stage 12 continuation prompt omits accepted triple identity.');if(r.prompt.includes('large prose that must not be replayed'))throw new Error('Stage 12 continuation prompt replays full prior verification prose.');
}
"""
if s.count(anchor)!=1: raise SystemExit('semantic insertion anchor mismatch')
s=s.replace(anchor,anchor+proof,1)
p.write_text(s)

# Operator lane regression assertions stay in the existing completion verifier.
p=Path('verify-complete.mjs'); s=p.read_text()
if 'Operator review has no shared exact lane matcher.' not in s:
    s += """

// Multi-operation operator review must remain bound to the selected operation and current scope.
{
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(appSource.includes('function operatorLaneMatches(item,n)'),'Operator review has no shared exact lane matcher.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n))"),'Proposal rendering is still stage-wide.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage))"),'Accept/reject selection is still stage-wide.');
  assert(appSource.includes('operatorLaneMatches(validationLaneRecord(x),n)'),'Validation feedback is still stage-wide.');
  assert(appSource.includes('acceptedLaneChanges(n).length'),'Accepted-result refinement visibility is still stage-wide.');
}
"""
p.write_text(s)

# Exact runtime cache identity from changed runtime blobs.
runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data=Path(path).read_bytes();return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
manifest=''.join(f'{name}:{git_blob_sha(name)}\n' for name in runtime_files)
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
p=Path('index.html'); s=p.read_text(); s,count=re.subn(r'runtime-[0-9a-f]{16}',token,s)
if count!=8: raise SystemExit(f'runtime token expected 8 occurrences, found {count}')
p.write_text(s)
print(f'boundary closure applied; runtime identity {token}')
