from pathlib import Path
import re, subprocess, textwrap

# Reuse the already-reviewed authority-safe 30-stage procedure wording from the earlier audit commit.
subprocess.run(['git','fetch','origin','4f0725249442c9482946349a885b44b75187da48'],check=True,stdout=subprocess.DEVNULL)
oldwf=subprocess.check_output(['git','show','4f0725249442c9482946349a885b44b75187da48:.github/workflows/final-organic-prompt-closure.yml'],text=True)
m=re.search(r"procedures=r'''(const procedures=\{.*?\n          \};)'''",oldwf,re.S)
if not m: raise RuntimeError('Audited procedure block was not found.')
procedures=textwrap.dedent(m.group(1))

p=Path('prompt-engine.js'); s=p.read_text()
s,n=re.subn(r'const procedures=\{.*?\n\};',procedures,s,count=1,flags=re.S)
if n!=1: raise RuntimeError('Prompt procedure block replacement failed.')
s=s.replace('- Do not include collections or fields outside the current stage contract.','- Do not include collections or fields outside the current stage and operation contract.')
if 'INADEQUATE_PRIOR_OUTPUT' not in s:
    s=s.replace('Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability','Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. A materially inadequate accepted prior-stage result requires BLOCKED with INADEQUATE_PRIOR_OUTPUT and must identify the earliest result needing refinement. An unavailable external capability')
p.write_text(s)

p=Path('response-ingestion.js'); s=p.read_text()
if "'INADEQUATE_PRIOR_OUTPUT'" not in s:
    s=s.replace("'MISSING_APPLICATION_CONTEXT','MISSING_AUTHORITY'","'MISSING_APPLICATION_CONTEXT','INADEQUATE_PRIOR_OUTPUT','MISSING_AUTHORITY'",1)
p.write_text(s)

p=Path('workflow-schema.js'); s=p.read_text()
old="if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:1,provenanceRequired:false});"
new="if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});"
if old not in s: raise RuntimeError('Human job-field definition changed unexpectedly.')
s=s.replace(old,new,1)

def replace_owner(name,next_name,human=(),decision=(),agent=(),application=()):
    global s
    def js(xs): return '['+','.join(repr(x) for x in xs)+']'
    block=f'''  "{name}": {{\n    "human": {js(human)},\n    "humanDecision": {js(decision)},\n    "agent": {js(agent)},\n    "application": {js(application)}\n  }},\n  "{next_name}": {{'''
    pattern=r'  "'+re.escape(name)+r'": \{.*?\n  \},\n  "'+re.escape(next_name)+r'": \{'
    s,count=re.subn(pattern,block,s,count=1,flags=re.S)
    if count!=1: raise RuntimeError('Ownership replacement failed for '+name)

replace_owner('iterations','candidateFreezes',application=('ITERATION_ID','CANDIDATE_ID','PREVIOUS_ITERATION_ID','CHANGESET_ID','PURPOSE','STATUS','LINEAGE','EVIDENCE'))
replace_owner('candidateFreezes','runs',application=('CANDIDATE_ID','ITERATION_ID','COMPONENT_MANIFEST','COMPONENT_VERSIONS','COMPONENT_HASHES','ROLE_DISTRIBUTION','IMMUTABLE_LOCATIONS','TOOL_CONFIGURATION','SETTINGS','PERMISSIONS','LIMITATIONS','BATCH_CHANGE_RULE','STATUS','EVIDENCE'))
replace_owner('regressions','changes',agent=('FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT','PRE_CORRECTION_EVIDENCE','CORRECTION','PERMANENT_TEST_LOCATION','APPLICABILITY','RETIREMENT_AUTHORITY'),application=('REG_ID','DEFECT_ID','REQ_ID','FIXTURE_IDENTITY_HASH','POST_CORRECTION_RESULT','POST_CORRECTION_EVIDENCE','ACTIVE_RETIRED_STATE'))
replace_owner('convergenceRecords','confirmationRecords',application=('CONVERGENCE_ID','ITERATION_ID','REQUIREMENT_COVERAGE','VERIFICATION_COVERAGE','REGRESSION_SUCCESS','CRITICAL_DEFECT_COUNT','MAJOR_DEFECT_COUNT','MANDATORY_UNRESOLVED_UNKNOWN_COUNT','CORRECTNESS_AFFECTING_CONTRADICTION_COUNT','CORRECTNESS_AFFECTING_AMBIGUITY_COUNT','UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT','CONVERGED','FAILED_CONDITIONS','RETURN_STAGES','EVIDENCE'))
replace_owner('confirmationRecords','baselines',agent=('COMPARISON_RESULTS','NEW_DEFECTS','NEW_REQUIREMENTS','NEW_FAILURE_CASES','NEW_VARIANCE','EVIDENCE'),application=('CONFIRMATION_ID','SOURCE_ITERATION_ID','CONFIRMATION_ITERATION_ID','ZERO_MATERIAL_CHANGES','VERSION_HASH_COMPARISON','TEN_NEW_CONTEXTS','COMPLETE_TEST_RESULTS','REGRESSION_RESULTS','DETERMINATION'))
replace_owner('baselines','products',decision=('HUMAN_AUTHORIZATION',),application=('BASELINE_ID','SUPPORTING_CONFIRMATION_ID','APPROVED_VERSIONS','HASHES','IMMUTABLE_ARTIFACT_RECORDS','AUTHORIZED_RECIPIENT_ROLES','CONTROLLED_STORAGE','STATUS','EVIDENCE'))
replace_owner('products','deterministicResults',agent=('TOOL_CONFIGURATION','DEVIATIONS','FAILURES'),application=('PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','EXECUTION_ID','PRODUCTION_CONTEXT_ID','BASELINE_MATERIALS','EXECUTION_TIMESTAMPS','INSTRUCTION_VERSION','GENERATED_ARTIFACT_INVENTORY','STATUS'))

for a,b in [("  10:['iterations','candidateFreezes'],","  10:[],"),("  18:['convergenceRecords'],","  18:[],"),("  20:['baselines'],","  20:[],"),("  21:['products','artifacts'],","  21:['products'],")]:
    if a not in s: raise RuntimeError('Stage collection token missing: '+a)
    s=s.replace(a,b,1)
base="const APPLICATION_COLLECTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['blockers','freshContexts','artifacts','releaseRecords','artifactIdentities','evidenceChains'])])));"
replacement="const APPLICATION_COLLECTION_EXTRAS=Object.freeze({10:['iterations','candidateFreezes'],17:['iterations','candidateFreezes'],18:['convergenceRecords'],19:['iterations','candidateFreezes','confirmationRecords'],20:['baselines'],21:['products'],27:['releaseRecords'],28:['artifactIdentities'],29:['evidenceChains']});\nconst APPLICATION_COLLECTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>{const stage=i+1;return [stage,Object.freeze([...new Set(['blockers','freshContexts','artifacts','releaseRecords','artifactIdentities','evidenceChains',...(APPLICATION_COLLECTION_EXTRAS[stage]||[])])])];})));"
if base not in s: raise RuntimeError('Application collection definition changed unexpectedly.')
s=s.replace(base,replacement,1)
s=s.replace("'PRE_CORRECTION_EVIDENCE','CORRECTION','POST_CORRECTION_RESULT','POST_CORRECTION_EVIDENCE','PERMANENT_TEST_LOCATION'","'PRE_CORRECTION_EVIDENCE','CORRECTION','PERMANENT_TEST_LOCATION'",1)
p.write_text(s)

p=Path('workflow-engine.js'); s=p.read_text()
old="function coverageMetrics(project){const requirements=mandatoryRequirements(project);const tests=recordsForCurrentScope(project,'tests');const covered=new Set(tests.map(testRequirementId).filter(Boolean));const requirementCoverage=requirements.length?requirements.filter(req=>covered.has(requirementId(req))).length/requirements.length:0;const iteration=latestIteration(project,[10,17,19]);const iterationId=recordId(iteration,'iterations')||project.job.CURRENT_ITERATION||'';const matrix=verificationMatrix(project,iterationId);const regressions=records(project,'regressions').filter(r=>upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED');const executions=currentRegressionExecutions(project,iterationId);"
new="function coverageMetrics(project,iterationIdOverride=null){const iterationId=iterationIdOverride||recordId(latestIteration(project,[10,17,19]),'iterations')||project.job.CURRENT_ITERATION||'',scope=iterationId?scopeForIteration(project,iterationId):currentScope(project),requirements=mandatoryRequirements(project,scope),tests=iterationId?recordsForScope(project,'tests',scope):recordsForCurrentScope(project,'tests'),covered=new Set(tests.map(testRequirementId).filter(Boolean));const requirementCoverage=requirements.length?requirements.filter(req=>covered.has(requirementId(req))).length/requirements.length:0;const matrix=verificationMatrix(project,iterationId);const regressions=activeRegressions(project);const executions=currentRegressionExecutions(project,iterationId);"
if old not in s: raise RuntimeError('coverageMetrics implementation changed unexpectedly.')
s=s.replace(old,new,1)
s=s.replace('const coverage=coverageMetrics(project);const material=','const coverage=coverageMetrics(project,iterationId);const material=',1)
s=s.replace("const verification=recordsForCurrentScope(project,'verification',iterationId?{iterationId}:{});","const verification=iterationId?recordsForIteration(project,'verification',iterationId):recordsForCurrentScope(project,'verification');",1)
s=s.replace("const comparisons=recordsForCurrentScope(project,'comparisons',iterationId?{iterationId}:{});","const comparisons=iterationId?recordsForIteration(project,'comparisons',iterationId):recordsForCurrentScope(project,'comparisons');",1)

s=s.replace("const expected=recordsForCurrentScope(project,'tests').filter(test=>upper(recordValue(test,'TEST_TYPE')).includes('DETERMINISTIC')","const mandatoryIds=new Set(mandatoryRequirements(project,currentScope(project)).map(requirementId)),expected=recordsForCurrentScope(project,'tests').filter(test=>mandatoryIds.has(testRequirementId(test))&&upper(recordValue(test,'TEST_TYPE')).includes('DETERMINISTIC')",1)
s=s.replace("const requirements=mandatoryRequirements(project).filter(req=>upper(recordValue(req,'INTENDED_VERIFICATION_METHOD')).includes('MEANING'))","const requirements=mandatoryRequirements(project,currentScope(project)).filter(req=>upper(recordValue(req,'INTENDED_VERIFICATION_METHOD')).includes('MEANING'))",1)

old24="case 24:{\n      requireAccepted();requireCount('adversarialResults',1);\n      if(collection('adversarialResults').some(record=>['VIOLATED','UNDETERMINED','FAILED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Adversarial verification found an unresolved result.');\n      break;\n    }"
new24="case 24:{requireAccepted();const results=recordsForCurrentScope(project,'adversarialResults');if(!results.length)reasons.push('At least one current adversarial execution is required.');const active=activeRegressions(project),covered=results.map(r=>upper(recordValue(r,'ATTACK'))+' '+upper(recordValue(r,'METHOD'))).join(' '),missing=active.filter(r=>!covered.includes(upper(recordId(r,'regressions')))).map(r=>recordId(r,'regressions'));if(missing.length)reasons.push('Active historical regression patterns were not explicitly exercised adversarially: '+missing.join(', ')+'.');if(results.some(record=>!String(recordValue(record,'EVIDENCE')||'').trim()||['VIOLATED','UNDETERMINED','FAILED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Adversarial verification found an unresolved or unsupported result.');break;}"
if old24 not in s: raise RuntimeError('Stage 24 gate changed unexpectedly.')
s=s.replace(old24,new24,1)

s=s.replace("case 20:requireAccepted();requireCount('baselines',1);if(!all('confirmationRecords').some(record=>upper(recordValue(record,'DETERMINATION'))==='SATISFIED'))reasons.push('A successful unchanged confirmation is required.');break;","case 20:{requireAccepted();const confirmations=recordsForCurrentScope(project,'confirmationRecords').filter(r=>upper(recordValue(r,'DETERMINATION'))==='SATISFIED'),baselines=recordsForCurrentScope(project,'baselines');if(!confirmations.length)reasons.push('A current successful unchanged confirmation is required.');if(baselines.length!==1)reasons.push('Exactly one current application-frozen production baseline is required.');if(baselines.some(r=>upper(recordValue(r,'HUMAN_AUTHORIZATION'))!=='AUTHORIZED'||String(recordValue(r,'SUPPORTING_CONFIRMATION_ID')||r.relationships?.SUPPORTING_CONFIRMATION_ID||'')!==recordId(confirmations.at(-1),'confirmationRecords')))reasons.push('The current baseline is not bound to the current human-authorized unchanged confirmation.');break;}",1)
s=s.replace("case 21:requireAccepted();requireCount('products',1);if(!all('baselines').length)reasons.push('An approved production baseline is required.');break;","case 21:{requireAccepted();const products=recordsForCurrentScope(project,'products'),product=products.at(-1),productId=recordId(product,'products'),artifacts=recordsForCurrentScope(project,'artifacts').filter(a=>String(a.scope?.productId||'')===productId);if(products.length!==1)reasons.push('Exactly one current application-reserved product identity is required.');if(!recordsForCurrentScope(project,'baselines').length)reasons.push('An approved production baseline is required.');if(!artifacts.length)reasons.push('Actual finished-product artifact bytes must be persisted and hashed before Stage 21 can complete.');if(product&&JSON.stringify(recordValue(product,'GENERATED_ARTIFACT_INVENTORY')||[])!==JSON.stringify(artifacts.map(a=>recordId(a,'artifacts'))))reasons.push('The application-derived product artifact inventory does not match current persisted product bytes.');break;}",1)

# Stage 18 gate must use the exact Stage 17 calculation even after Stage 19 exists.
s=s.replace("requireAccepted();const metrics=convergenceMetrics(project);\n      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');","requireAccepted();const metrics=convergenceMetrics(project);\n      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');",1)

# Keep product inventory authoritative when verified Stage 21 bytes are registered.
needle="project.projectData.artifacts.push(record);addHistory(project,'ARTIFACT_BYTES_REGISTERED'"
if needle in s:
    s=s.replace(needle,"project.projectData.artifacts.push(record);if(Number(stage)===21){const product=recordsForCurrentScope(project,'products').at(-1);if(product){const ids=recordsForCurrentScope(project,'artifacts').filter(a=>String(a.scope?.productId||'')===recordId(product,'products')).map(a=>recordId(a,'artifacts'));product.fields={...(product.fields||{}),GENERATED_ARTIFACT_INVENTORY:ids};product.GENERATED_ARTIFACT_INVENTORY=ids;}}addHistory(project,'ARTIFACT_BYTES_REGISTERED'",1)

metrics="""
function operationalMetrics(project){ensureShape(project);const history=safe(project.projectData.history),validations=safe(project.projectData.responseValidations),proposals=safe(project.projectData.responseProposals),releases=safe(project.projectData.releaseRecords);return {rawResponses:safe(project.projectData.rawResponses).length,validationFailures:validations.filter(x=>x.valid===false).length,staleResponses:proposals.filter(x=>x.status==='STALE'||x.invalidatedBy).length,rejectedProposals:safe(project.projectData.rejectedResponses).length,acceptedDataChanges:safe(project.projectData.acceptedChanges).length,clarificationCycles:safe(project.projectData.humanInputAnswers).length,controlledCorrections:history.filter(x=>['ACCEPTED_RESPONSE_INVALIDATED','STAGE_AUTHORITY_CHANGED','DOWNSTREAM_INVALIDATED'].includes(x.type)).length,storageFailures:history.filter(x=>String(x.type||'').includes('STORAGE')&&String(x.type||'').includes('FAIL')).length,gateRegressions:history.filter(x=>x.type==='DOWNSTREAM_INVALIDATED').length,releaseRejections:releases.filter(x=>upper(recordValue(x,'DETERMINATION'))==='REJECTED').length,releaseBlocks:releases.filter(x=>upper(recordValue(x,'DETERMINATION'))==='BLOCKED').length};}
"""
if 'function operationalMetrics(' not in s:
    marker='globalThis.closedLoopWorkflowEngine=Object.freeze({recordMigratedAcceptedChange,'
    if marker not in s: raise RuntimeError('Engine export marker missing.')
    s=s.replace(marker,metrics+'\n'+marker,1)
    s=s.replace('convergenceMetrics,releaseMetrics,gate','convergenceMetrics,releaseMetrics,operationalMetrics,gate',1)
p.write_text(s)

p=Path('app-core.js'); s=p.read_text()
s=s.replace('>Freeze baseline</button>','>Authorize and freeze baseline</button>')
p.write_text(s)

# Update prompt assertions to the new semantic vocabulary and Stage 15 chronology.
for name in ['build-test-project.mjs','verify.mjs']:
    p=Path(name); t=p.read_text(); t=t.replace('genuinely independent external governing sources','independent external source inventory').replace('Research only the current accepted Stage 02 external governing source set','Research only the current accepted Stage 02 independent external source set'); p.write_text(t)
p=Path('verify-full-cycle.mjs'); t=p.read_text();t=t.replace("POST_CORRECTION_RESULT:'PENDING',POST_CORRECTION_EVIDENCE:'Pending later execution',",'');p.write_text(t)

# Permanent semantic assertions: the prompt must never assign deterministic authority to the agent.
p=Path('verify-prompt-semantics.mjs'); t=p.read_text()
if 'AGENT_ASSIGNS_JOB_ID' not in t:
    insert="""
const forbiddenProcedureSemantics=[[/Assign and preserve this job’s unique JOB_ID/i,'AGENT_ASSIGNS_JOB_ID'],[/Create SOURCE-SET-vN/i,'AGENT_CREATES_SOURCE_SET'],[/Each REQ_ID must express/i,'AGENT_COORDINATES_REQ_ID'],[/Calculate mandatory requirement-to-test coverage exactly/i,'AGENT_CALCULATES_COVERAGE'],[/Assign CANDIDATE_ID and ITERATION_ID/i,'AGENT_ASSIGNS_CANDIDATE'],[/Assign BASELINE_ID/i,'AGENT_ASSIGNS_BASELINE'],[/Assign PRODUCT_ID, PRODUCT_VERSION/i,'AGENT_ASSIGNS_PRODUCT'],[/produce exactly one determination/i,'AGENT_SETS_RELEASE'],[/Determine convergence.*Calculate mandatory requirement coverage/i,'AGENT_CALCULATES_CONVERGENCE']];
for(const [pattern,code] of forbiddenProcedureSemantics)for(const [stage,text] of Object.entries(prompts.procedures))if(pattern.test(text))throw new Error(`Stage ${stage} prompt authority contradiction: ${code}`);
"""
    t=t.replace('function semanticIssues(record){',insert+'\nfunction semanticIssues(record){',1)
p.write_text(t)

print('semantic patch applied')
