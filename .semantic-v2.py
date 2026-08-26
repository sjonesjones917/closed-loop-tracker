from pathlib import Path

def replace_once(path, old, new):
    p=Path(path); s=p.read_text()
    if s.count(old)!=1:
        raise SystemExit(f'{path}: expected exactly one occurrence, found {s.count(old)} for {old[:120]!r}')
    p.write_text(s.replace(old,new,1))

# Prompt authority: stage-aware scope, recovery feedback, and honest execution limits.
replace_once('prompt-engine.js',
"const hash=globalThis.closedLoopHash;\nif(!core||!schema||!hash)throw new Error('workbook.js, hash.js, and workflow-schema.js must load before prompt-engine.js.');",
"const hash=globalThis.closedLoopHash;\nconst engine=globalThis.closedLoopWorkflowEngine;\nif(!core||!schema||!hash||!engine)throw new Error('workbook.js, hash.js, workflow-schema.js, and workflow-engine.js must load before prompt-engine.js.');")
replace_once('prompt-engine.js',
"Do not begin substantive external-source research or downstream production work.'",
"Do not begin substantive external-source research or downstream production work. Before normalizing the requested deliverable, assess whether the available environment and authorized tools can reliably produce it. Preserve the verbatim request unchanged. If a large implementation depends on an inaccessible external repository, service, deployment environment, or other unavailable execution surface, define the workflow deliverable as a complete implementation-ready specification rather than pretending implementation can occur here; disclose that limitation and require normal human intent confirmation. Self-contained deliverables that can actually be produced with the available tools remain direct deliverables.'")
replace_once('prompt-engine.js',
"Create one applicable verification record for every required REQ_ID × RUN_ID relation, linked to TEST_ID.",
"Create exactly one current verification record for every required REQ_ID × RUN_ID × TEST_ID triple.")
replace_once('prompt-engine.js',
"preserve failure fixture and identity/hash when available, reproduction procedure, detection method, pre-correction result and evidence, correction, post-correction result and evidence, permanent test location, applicability, active/retired state, and retirement authority where applicable.'",
"preserve failure fixture and identity/hash when available, reproduction procedure, detection method, the actual pre-correction failing result and evidence, correction, permanent test location, applicability, active/retired state, and retirement authority where applicable. At Stage 15, post-correction result and evidence are PENDING unless a later actual corrected execution already exists; never invent future success.'")
replace_once('prompt-engine.js',
"21:'Generate this job’s finished target product here, in a fresh production context, using only the approved baseline materials.",
"21:'Generate the approved workflow deliverable here, in a fresh production context, using only the approved baseline materials. The approved deliverable may be the requested self-contained product, or it may be the complete implementation-ready specification confirmed at Stage 01 when direct implementation was not reliably available.")
replace_once('prompt-engine.js',
"function boundedCollection(state,collection){\n const list=Array.isArray(state?.projectData?.[collection])?state.projectData[collection]:[];if(!list.length)return 'NONE';\n const active=list.filter(x=>x?.active!==false&&!x?.invalidatedBy);\n return show({totalActive:active.length,records:active.map(record=>({id:recordId(record,collection),stage:record.stage??'UNKNOWN',scope:record.scope||{},fields:record.fields||record,relationships:record.relationships||{},contentSha256:record.contentSha256||record.sha256||'UNKNOWN'})),omitted:0,selectionRule:'All active records selected by the explicit stage readCollections contract; large artifact bytes are referenced by canonical artifact identity.'});\n}",
"const activeRecords=(state,collection)=>(Array.isArray(state?.projectData?.[collection])?state.projectData[collection]:[]).filter(x=>x?.active!==false&&!x?.invalidatedBy);\nfunction contextRecords(stage,state,collection){\n const active=activeRecords(state,collection);if(!active.length)return [];\n const policy=schema.RECORD_SCHEMAS?.[collection]?.commitPolicy;\n const completeHistory=stage===30;\n const permanentRegistry=policy==='APPEND_ONLY'||collection==='regressions';\n const crossIterationIdentity=[17,19,20].includes(stage)&&['iterations','candidateFreezes','changes'].includes(collection);\n if(completeHistory||permanentRegistry||crossIterationIdentity)return active;\n return engine.recordsForCurrentScope(state,collection);\n}\nfunction boundedCollection(stage,state,collection){\n const selected=contextRecords(stage,state,collection);if(!selected.length)return 'NONE';\n return show({totalSelected:selected.length,records:selected.map(record=>({id:recordId(record,collection),stage:record.stage??'UNKNOWN',scope:record.scope||{},fields:record.fields||record,relationships:record.relationships||{},contentSha256:record.contentSha256||record.sha256||'UNKNOWN'})),omitted:0,selectionRule:stage===30?'Complete active historical record set required for permanent preservation.':(schema.RECORD_SCHEMAS?.[collection]?.commitPolicy==='APPEND_ONLY'||collection==='regressions')?'All active append-only/permanent records required by this stage.':'Current canonical scope selected by the workflow engine; explicit cross-iteration identity context is retained only where the stage requires it.'});\n}")
replace_once('prompt-engine.js',
" if(answered.length)parts.push(`ANSWERED HUMAN CLARIFICATIONS\\n${show(answered)}`);\n for(const collection of contextCollections[stage]||[])parts.push(`${collection.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toUpperCase()}\\n${boundedCollection(state,collection)}`);",
" if(answered.length)parts.push(`ANSWERED HUMAN CLARIFICATIONS\\n${show(answered)}`);\n const latestAccepted=(state?.projectData?.acceptedChanges||[]).filter(x=>Number(x.stage)===stage&&x.status==='COMMITTED'&&!x.invalidatedBy).at(-1),acceptedAt=latestAccepted?.committedAt||'';\n const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection===true&&(!acceptedAt||String(x.rejectedAt||'')>acceptedAt));\n if(corrections.length)parts.push(`OPERATOR CORRECTION REQUESTS SINCE THE LAST ACCEPTED STAGE RESPONSE\\n${show(corrections.map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,operatorLabel:x.operator||'HUMAN_OPERATOR',rejectedAt:x.rejectedAt})))}`);\n const latestValidationFailure=(state?.projectData?.responseValidations||[]).filter(x=>Number(x.stage)===stage&&x.valid===false&&(!acceptedAt||String(x.createdAt||'')>acceptedAt)).at(-1);\n if(latestValidationFailure)parts.push(`LATEST APPLICATION VALIDATION FAILURE TO CORRECT\\n${show({validationId:latestValidationFailure.validationId,issues:latestValidationFailure.issues||[]})}`);\n for(const collection of contextCollections[stage]||[])parts.push(`${collection.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toUpperCase()}\\n${boundedCollection(stage,state,collection)}`);")
replace_once('prompt-engine.js',
"- Use only DATA_PROPOSAL, HUMAN_INPUT_REQUIRED, BLOCKED, or EXECUTION_FAILED as responseType.\n",
"- Use only DATA_PROPOSAL, HUMAN_INPUT_REQUIRED, BLOCKED, or EXECUTION_FAILED as responseType.\n- Before substantive work, decide whether the combination of current human input, current canonical application context, prior accepted results, and actually available capabilities is sufficient to complete this stage reliably. What is sufficient is stage- and job-dependent; reason about it rather than using a fixed checklist.\n- If a missing fact or genuine authority decision can only come from the human, return HUMAN_INPUT_REQUIRED with the minimum precise questions needed.\n- If required canonical project context, evidence, an artifact, or a prior-stage fact should exist but is absent or inconsistent, return BLOCKED with structured unresolved items; do not ask the human to manually reconstruct application-owned state.\n- If an attempted tool or execution failed, return EXECUTION_FAILED with the exact failed capability and evidence.\n- If a prior response was rejected or validation failed but the available context is sufficient to fix it, return a complete replacement response addressing the supplied correction or validation feedback; never require the human to transcribe agent-owned fields.\n")
replace_once('prompt-engine.js',
"- When the environment cannot perform a requested implementation or execution, provide an implementation-ready specification rather than pretending implementation occurred.",
"- The operating application itself has no external repository, service, deployment, or remote execution capability. Use only capabilities actually available to the external agent and listed or established for this job. When direct implementation or execution is unavailable or too large to perform reliably, do not claim it occurred; produce the complete implementation-ready specification selected and confirmed for this workflow instead.")
replace_once('prompt-engine.js',
"readCollections:Object.fromEntries((opContract?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]).map(collection=>[collection,(state?.projectData?.[collection]||[]).filter(x=>x?.active!==false&&!x?.invalidatedBy).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(record.fields||record)}))]))",
"readCollections:Object.fromEntries((opContract?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]).map(collection=>[collection,contextRecords(stage,state,collection).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(record.fields||record)}))]))")

# Human-visible workbook wording must match actual chronology and triple mathematics.
replace_once('workbook.js',"'Every mandatory requirement has one verification record per run'","'Every required REQ_ID × RUN_ID × TEST_ID triple has exactly one current verification record'")
replace_once('workbook.js',"'Every regression fails before correction and succeeds after correction'","'Every regression has an actual pre-correction failing execution; post-correction success is proven only by a later actual execution'")
replace_once('workbook.js',"'Convert every confirmed defect into a permanent test that reproduces the failure before correction and succeeds after correction.'","'Convert every confirmed defect into a permanent test that reproduces the failure before correction; later corrected or confirmation iterations must prove success.'")

# Operator refinement: preserve exact correction guidance, and distinguish current records from preserved history.
replace_once('app-core.js',
"<div class=\"button-row\"><button class=\"primary\" id=\"accept-proposal\">Accept response</button><button id=\"reject-proposal\">Reject response</button><button id=\"request-correction\">Request correction</button></div>",
"<div class=\"field full\"><label>Correction guidance</label><textarea id=\"correction-reason\" placeholder=\"Describe exactly what the next response should add, correct, or clarify.\"></textarea></div><div class=\"button-row\"><button class=\"primary\" id=\"accept-proposal\">Accept response</button><button id=\"reject-proposal\">Reject response</button><button id=\"request-correction\">Request correction</button></div>")
replace_once('app-core.js',
"async function rejectPendingProposal(requestCorrection=false){const p=pendingProposal();if(!p)return;const result=ingestion.reject(current,p.proposalId,{operator:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR',reason:requestCorrection?'Correction requested after proposal review.':'Rejected after proposal review.',requestCorrection});",
"async function rejectPendingProposal(requestCorrection=false){const p=pendingProposal();if(!p)return;const guidance=$('#correction-reason')?.value.trim()||'';if(requestCorrection&&!guidance){$('#correction-reason')?.focus();alert('Describe what the next response should correct or add.');return;}const result=ingestion.reject(current,p.proposalId,{operator:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR',reason:requestCorrection?guidance:'Rejected after proposal review.',requestCorrection});")
old="function acceptedStageMarkup(n){const s=current.stages[n],collections=schema.STAGE_CONTRACTS[n].allowedCollections,records=collections.flatMap(c=>engine.records(current,c,{stage:n}).map(r=>({collection:c,...r})));return `<div class=\"panel\"><h2 class=\"section-title\">Accepted canonical stage record</h2><p class=\"section-intro\">Agent-owned and application-derived data are read-only after validated ingestion. Corrections use the owning authority's controlled path; canonical application state is not directly editable.</p>${Object.keys(s.agentData||{}).length?details('Accepted agent data',s.agentData):'<div class=\"empty-state\">No accepted agent data yet.</div>'}${Object.keys(s.derivedData||{}).length?details('Application-derived values',s.derivedData):''}${records.length?details('Accepted linked records',records):''}${s.gate?.reasons?.length?`<div class=\"notice warn\"><strong>Completion gate is not satisfied.</strong><br>${s.gate.reasons.map(esc).join('<br>')}</div>`:`<div class=\"notice success\">Completion gate is satisfied by current canonical evidence.</div>`}</div>`;}"
new="function acceptedStageMarkup(n){const s=current.stages[n],collections=schema.STAGE_CONTRACTS[n].allowedCollections,currentRecords=[],history=[];for(const c of collections){const currentIds=new Set(engine.recordsForCurrentScope(current,c).filter(r=>Number(r.stage)===n).map(r=>engine.recordId(r,c)));for(const r of engine.records(current,c,{stage:n})){const entry={collection:c,...r};(currentIds.has(engine.recordId(r,c))?currentRecords:history).push(entry);}}return `<div class=\"panel\"><h2 class=\"section-title\">Accepted canonical stage record</h2><p class=\"section-intro\">Agent-owned and application-derived data are read-only after validated ingestion. Current-scope records are separated from preserved active history. Corrections use the owning authority's controlled path; canonical application state is not directly editable.</p>${Object.keys(s.humanData||{}).length?details('Accepted human authority data',s.humanData):''}${Object.keys(s.agentData||{}).length?details('Accepted agent data',s.agentData):'<div class=\"empty-state\">No accepted agent data yet.</div>'}${Object.keys(s.derivedData||{}).length?details('Application-derived values',s.derivedData):''}${currentRecords.length?details('Current-scope linked records',currentRecords):''}${history.length?details('Preserved active history from other scopes',history):''}${s.gate?.reasons?.length?`<div class=\"notice warn\"><strong>Completion gate is not satisfied.</strong><br>${s.gate.reasons.map(esc).join('<br>')}</div>`:`<div class=\"notice success\">Completion gate is satisfied by current canonical evidence.</div>`}</div>`;}"
replace_once('app-core.js',old,new)

# Release must not be poisoned forever by a corrected material defect from an earlier iteration.
replace_once('workflow-engine.js',
"const baseline=recordsForCurrentScope(project,'baselines').at(-1);const product=recordsForCurrentScope(project,'products').at(-1);const blockers=openBlockers(project);const defects=unresolvedMaterialDefects(project);",
"const baseline=recordsForCurrentScope(project,'baselines').at(-1);const product=recordsForCurrentScope(project,'products').at(-1);const blockers=openBlockers(project);const currentIterationId=recordId(latestIteration(project,[19,17,10]),'iterations');const defects=unresolvedMaterialDefects(project).filter(r=>!currentIterationId||!r.scope?.iterationId||String(r.scope.iterationId)===String(currentIterationId));")

# Semantic acceptance cases beyond structural/token checks.
p=Path('verify-prompt-semantics.mjs');s=p.read_text();marker="const p=baseProject();\nconst original=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN'"
if marker not in s: raise SystemExit('prompt semantic insertion marker missing')
insert="""
{
  const p=baseProject(),s1=prompts.buildPromptRecord(1,p),s12=prompts.buildPromptRecord(12,p),s15=prompts.buildPromptRecord(15,p),s21=prompts.buildPromptRecord(21,p);
  if(!s1.prompt.includes('complete implementation-ready specification')||!s1.prompt.includes('require normal human intent confirmation'))throw new Error('Stage 01 does not establish honest implementation/specification fallback.');
  if(!s12.prompt.includes('REQ_ID × RUN_ID × TEST_ID triple'))throw new Error('Stage 12 prompt does not require exact verification triples.');
  if(s15.prompt.includes('fails before correction and succeeds after correction'))throw new Error('Stage 15 still asks for impossible future post-correction evidence.');
  if(!s21.prompt.includes('approved workflow deliverable')||!s21.prompt.includes('implementation-ready specification'))throw new Error('Stage 21 contradicts the approved specification fallback.');
  if(!s12.prompt.includes('current human input, current canonical application context')||!s12.prompt.includes('do not ask the human to manually reconstruct application-owned state')||!s12.prompt.includes('complete replacement response'))throw new Error('Prompt recovery protocol does not distinguish missing-human, missing-context, and inadequate-response cases.');
}
{
  const p=baseProject();p.job.CURRENT_ITERATION='ITERATION-CURRENT';
  p.projectData.verification.push({id:'VERIFICATION-OLD',active:true,stage:12,scope:{iterationId:'ITERATION-OLD'},fields:{VERIFICATION_ID:'VERIFICATION-OLD',EXACT_EVIDENCE:'OLD-SCOPE-MUST-NOT-CONTAMINATE'}});
  p.projectData.verification.push({id:'VERIFICATION-CURRENT',active:true,stage:12,scope:{iterationId:'ITERATION-CURRENT'},fields:{VERIFICATION_ID:'VERIFICATION-CURRENT',EXACT_EVIDENCE:'CURRENT-SCOPE-MUST-APPEAR'}});
  const r=prompts.buildPromptRecord(13,p),ids=r.contextManifest.readCollections.verification.map(x=>x.id);
  if(ids.includes('VERIFICATION-OLD')||!ids.includes('VERIFICATION-CURRENT')||r.prompt.includes('OLD-SCOPE-MUST-NOT-CONTAMINATE')||!r.prompt.includes('CURRENT-SCOPE-MUST-APPEAR'))throw new Error('Current-stage prompt context accepts historical append-scoped verification data.');
}
{
  const p=baseProject();p.job.CURRENT_ITERATION='ITERATION-CURRENT';
  p.projectData.defects.push({id:'DEFECT-HISTORICAL',active:true,stage:14,scope:{iterationId:'ITERATION-OLD'},fields:{DEFECT_ID:'DEFECT-HISTORICAL',OBSERVED_FAILURE:'PERMANENT-HISTORY-MUST-APPEAR'}});
  const r=prompts.buildPromptRecord(30,p),ids=r.contextManifest.readCollections.defects.map(x=>x.id);
  if(!ids.includes('DEFECT-HISTORICAL')||!r.prompt.includes('PERMANENT-HISTORY-MUST-APPEAR'))throw new Error('Stage 30 prompt loses required permanent defect history.');
}
{
  const p=baseProject();p.projectData.rejectedResponses.push({rejectedResponseId:'REJECTED-CORRECTION',stage:2,requestCorrection:true,reason:'Add the missing jurisdiction analysis and verify the effective date.',operator:'HUMAN_OPERATOR',rejectedAt:'2099-01-01T00:00:00.000Z'});p.projectData.responseValidations.push({validationId:'VALIDATION-LATEST',stage:2,valid:false,createdAt:'2099-01-01T00:00:01.000Z',issues:[{code:'MISSING_PROVENANCE',message:'Evidence is required.'}]});const text=prompts.buildPromptRecord(2,p).prompt;if(!text.includes('Add the missing jurisdiction analysis and verify the effective date.'))throw new Error('Operator refinement guidance is not carried into the next prompt.');if(!text.includes('MISSING_PROVENANCE')||!text.includes('Evidence is required.'))throw new Error('Application rejection feedback is not carried into the next prompt.');
}

"""
s=s.replace(marker,insert+marker,1)
# Update old oracle strings to the stronger new environment rule.
s=s.replace("if(!record.prompt.includes('implementation-ready specification rather than pretending implementation occurred'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');","if(!record.prompt.includes('do not claim it occurred; produce the complete implementation-ready specification'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');")
s=s.replace("{...original,prompt:original.prompt.replace('implementation-ready specification rather than pretending implementation occurred','assume implementation occurred')}","{...original,prompt:original.prompt.replace('do not claim it occurred; produce the complete implementation-ready specification','assume implementation occurred')}")
p.write_text(s)

p=Path('verify-complete.mjs');s=p.read_text();marker="console.log(JSON.stringify({"
if marker not in s: raise SystemExit('verify-complete marker missing')
insert="""
// A corrected historical material defect remains preserved but cannot poison the current release; a current material defect still rejects it.
{
  const p=project('JOB-RELEASE-DEFECT-SCOPE');p.job.CURRENT_ITERATION='ITERATION-NEW';
  const it=record('iterations',19,{CANDIDATE_ID:'CANDIDATE-NEW',STATUS:'FROZEN'},'ITERATION-NEW');it.scope={iterationId:'ITERATION-NEW',candidateId:'CANDIDATE-NEW'};p.projectData.iterations.push(it);
  const old=record('defects',14,{SEVERITY:'MAJOR',STATUS:'CONFIRMED'},'DEFECT-OLD');old.scope={iterationId:'ITERATION-OLD',candidateId:'CANDIDATE-OLD'};p.projectData.defects.push(old);
  let metrics=engine.releaseMetrics(p);assert(metrics.majorDefects===0&&metrics.determination!=='REJECTED','Historical corrected-scope major defect incorrectly rejects the current release.');
  const current=record('defects',24,{SEVERITY:'MAJOR',STATUS:'CONFIRMED'},'DEFECT-CURRENT');current.scope={iterationId:'ITERATION-NEW',candidateId:'CANDIDATE-NEW'};p.projectData.defects.push(current);
  metrics=engine.releaseMetrics(p);assert(metrics.majorDefects===1&&metrics.determination==='REJECTED','Current major defect does not reject release.');
}

"""
p.write_text(s.replace(marker,insert+marker,1))

# Browser must expose actionable correction guidance after a valid proposal is ready.
p=Path('verify-browser-extra.mjs');s=p.read_text();marker="await fill(cdp,'#stage-output',JSON.stringify(envelope));await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);"
if marker not in s: raise SystemExit('browser proposal marker missing')
s=s.replace(marker,marker+"assert(await evalValue(cdp,`Boolean(document.querySelector('#correction-reason'))`),'Correction guidance control is missing from proposal review.');",1)
p.write_text(s)
