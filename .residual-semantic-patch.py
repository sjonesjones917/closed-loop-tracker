from pathlib import Path

def rep(path, old, new, count=1):
    p=Path(path); s=p.read_text()
    if s.count(old)<count: raise SystemExit(f'missing patch anchor in {path}: {old[:120]}')
    p.write_text(s.replace(old,new,count))

# 1. Stage 18 convergence is application-derived; do not advertise the collection as agent-writable.
rep('workflow-schema.js',"  18:['convergenceRecords'],","  18:[],")

# 2. Preserve explicitly selected resource identities when constructing prompt scope.
rep('prompt-engine.js',
"function scopeFor(stage,state,overrides={}){const j=state?.job||{};const value={projectRevision:Number(state?.revision||0),inputVersion:j.CURRENT_INPUT_VERSION||null,sourceSetVersion:j.CURRENT_SOURCE_SET_VERSION||null,requirementsVersion:j.CURRENT_REQUIREMENTS_VERSION||null,testSuiteVersion:j.CURRENT_TEST_SUITE_VERSION||null,instructionVersion:j.CURRENT_INSTRUCTION_VERSION||null,iterationId:j.CURRENT_ITERATION||null,candidateId:state?.projectData?.candidateFreezes?.filter(x=>x?.active!==false&&!x?.invalidatedBy).at(-1)?.id||null,runId:overrides.runId||null,contextId:overrides.contextId||null,baselineId:j.CURRENT_BASELINE_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_BASELINE_ID))?j.CURRENT_BASELINE_ID:null,productId:j.CURRENT_PRODUCT_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_PRODUCT_ID))?j.CURRENT_PRODUCT_ID:null};return value;}",
"function scopeFor(stage,state,overrides={}){const j=state?.job||{},has=key=>Object.prototype.hasOwnProperty.call(overrides,key),pick=(key,fallback)=>has(key)?overrides[key]:fallback;const value={projectRevision:Number(state?.revision||0),inputVersion:j.CURRENT_INPUT_VERSION||null,sourceSetVersion:j.CURRENT_SOURCE_SET_VERSION||null,requirementsVersion:j.CURRENT_REQUIREMENTS_VERSION||null,testSuiteVersion:j.CURRENT_TEST_SUITE_VERSION||null,instructionVersion:j.CURRENT_INSTRUCTION_VERSION||null,iterationId:pick('iterationId',j.CURRENT_ITERATION||null),candidateId:pick('candidateId',state?.projectData?.candidateFreezes?.filter(x=>x?.active!==false&&!x?.invalidatedBy).at(-1)?.id||null),runId:pick('runId',null),contextId:pick('contextId',null),baselineId:pick('baselineId',j.CURRENT_BASELINE_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_BASELINE_ID))?j.CURRENT_BASELINE_ID:null),productId:pick('productId',j.CURRENT_PRODUCT_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_PRODUCT_ID))?j.CURRENT_PRODUCT_ID:null)};return value;}")

# 3. Bind run prompt scope to the selected run's exact iteration and candidate, not globals.
rep('app-core.js',
"function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}",
"function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||''),iterationId=String(run.scope?.iterationId||recordValue(run,'ITERATION_ID')||''),candidateId=String(run.scope?.candidateId||recordValue(run,'CANDIDATE_ID')||'');options.scope={iterationId,candidateId,runId,contextId};}}return options;}")

# 4. UI confirmation state must use the same current-change/current-input authority rule as the Stage 1 gate.
rep('app-core.js',
"function stageConfirmationMarkup(n,locked){if(n!==1||current.isRetainedTestProject||current.stages[1].status==='COMPLETE')return '';const accepted=engine.acceptedChanges(current,1).length>0,confirmed=safe(current.projectData.stageConfirmations).some(x=>Number(x.stage)===1&&x.confirmed&&!x.invalidatedBy);if(!accepted||confirmed)return '';",
"function stageConfirmationMarkup(n,locked){if(n!==1||current.isRetainedTestProject)return '';const latest=engine.acceptedChanges(current,1).at(-1),accepted=Boolean(latest),confirmed=safe(current.projectData.stageConfirmations).some(x=>Number(x.stage)===1&&x.confirmed&&!x.invalidatedBy&&x.acceptedChangeId===latest?.changeId&&x.inputVersion===current.job.CURRENT_INPUT_VERSION);if(current.stages[1].status==='COMPLETE'&&confirmed)return '';if(!accepted||confirmed)return '';")

# 5. Repeated Stage 17/19 operation proof must belong to the exact current iteration.
rep('workflow-engine.js',
"function acceptedOperationSet(project,stage){const proposals=safe(project.projectData.responseProposals),out=new Set();for(const c of acceptedChanges(project,stage)){const op=c.operation||proposals.find(p=>p.proposalId===c.proposalId)?.envelope?.operation;if(op)out.add(String(op));}return out;}",
"function acceptedOperationSet(project,stage,iterationId=null){const proposals=safe(project.projectData.responseProposals),out=new Set(),id=String(iterationId||'');const changes=acceptedChanges(project,stage);let freezeWindow=null;if(Number(stage)===17&&id){const events=safe(project.projectData.history).filter(e=>e.type==='CANDIDATE_FROZEN'&&Number(e.stage)===17),currentEvent=events.find(e=>String(e.iterationId||'')===id),prior=events.filter(e=>currentEvent&&Number(e.eventSequence||0)<Number(currentEvent.eventSequence||0)).at(-1);if(currentEvent)freezeWindow={after:Number(prior?.eventSequence||0),through:Number(currentEvent.eventSequence||0)};}for(const c of changes){const op=String(c.operation||proposals.find(p=>p.proposalId===c.proposalId)?.envelope?.operation||'');if(!op)continue;if(!id||String(c.scope?.iterationId||'')===id){out.add(op);continue;}if(Number(stage)===17&&op==='FREEZE'&&freezeWindow){const seq=Number(c.eventSequence||0);if(seq>freezeWindow.after&&seq<=freezeWindow.through)out.add(op);}}return out;}")
rep('workflow-engine.js',"ops=acceptedOperationSet(project,stage),requiredOps=", "ops=acceptedOperationSet(project,stage,iterationId),requiredOps=")

# 6. Release records may not be created before the reconciled Stage 26 audit is complete.
rep('workflow-engine.js',
"function recordReleaseDetermination(project){ensureShape(project);const metrics=releaseMetrics(project);",
"function recordReleaseDetermination(project){ensureShape(project);if(project.stages?.[26]?.status!=='COMPLETE')throw new Error('Stage 26 must be COMPLETE before a release determination can be recorded.');const metrics=releaseMetrics(project);")

# 7. Release aggregation and Stage 29 operate on the current requirement version only.
rep('workflow-engine.js',"function releaseMetrics(project){const requirements=mandatoryRequirements(project);", "function releaseMetrics(project){const requirements=mandatoryRequirements(project,currentScope(project));")
rep('workflow-engine.js',"function constructEvidenceChains(project){ensureShape(project);const requirements=mandatoryRequirements(project);", "function constructEvidenceChains(project){ensureShape(project);const requirements=mandatoryRequirements(project,currentScope(project));")
rep('workflow-engine.js',
"const prior=records(project,'evidenceChains',{active:false}).find(r=>String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')===reqId&&!r.invalidatedBy);",
"const prior=recordsForCurrentScope(project,'evidenceChains').find(r=>String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')===reqId&&!r.invalidatedBy);")
rep('workflow-engine.js',
"      const reqs=mandatoryRequirements(project),chains=all('evidenceChains'),byReq=new Map(chains.map(record=>[String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||''),record]));",
"      const reqs=mandatoryRequirements(project,currentScope(project)),chains=recordsForCurrentScope(project,'evidenceChains'),byReq=new Map(chains.map(record=>[String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||''),record]));")

# 8. Stage 28 and the authorization function must use current scope and independently verify audited identities against canonical bytes.
rep('workflow-engine.js',
"      const release=all('releaseRecords').at(-1);\n      if(upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')reasons.push('Stage 27 must be ACCEPTED before artifact identity verification.');\n      if(!all('artifactIdentities').length)reasons.push('No audited-versus-delivery artifact identity comparison exists.');\n      if(all('artifactIdentities').some(record=>!truth(recordValue(record,'EXACT_HASH_MATCH'))||!truth(recordValue(record,'EXACT_SIZE_MATCH'))||upper(recordValue(record,'AUTHORIZATION'))!=='AUTHORIZED'))reasons.push('At least one release artifact does not exactly match the audited artifact.');",
"      const release=recordsForCurrentScope(project,'releaseRecords').at(-1),identities=recordsForCurrentScope(project,'artifactIdentities');\n      if(upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')reasons.push('Stage 27 must be ACCEPTED before artifact identity verification.');\n      if(!identities.length)reasons.push('No current audited-versus-delivery artifact identity comparison exists.');\n      if(identities.some(record=>!truth(recordValue(record,'EXACT_HASH_MATCH'))||!truth(recordValue(record,'EXACT_SIZE_MATCH'))||upper(recordValue(record,'AUTHORIZATION'))!=='AUTHORIZED'))reasons.push('At least one current release artifact does not exactly match the audited artifact.');")
rep('workflow-engine.js',
"function verifyArtifactIdentity(project,audited,delivery){ensureShape(project);if(upper(recordValue(records(project,'releaseRecords').at(-1),'DETERMINATION'))!=='ACCEPTED')throw new Error('Artifact identity verification is prohibited until Stage 27 is ACCEPTED.');const a=safe(audited),d=safe(delivery);",
"function verifyArtifactIdentity(project,audited,delivery){ensureShape(project);if(project.stages?.[27]?.status!=='COMPLETE'||upper(recordValue(recordsForCurrentScope(project,'releaseRecords').at(-1),'DETERMINATION'))!=='ACCEPTED')throw new Error('Artifact identity verification is prohibited until current Stage 27 is COMPLETE and ACCEPTED.');const a=safe(audited),d=safe(delivery),canonical=recordsForCurrentScope(project,'artifacts');for(const left of a){const matches=canonical.filter(record=>recordId(record,'artifacts')===String(left.artifactId||'')&&String(recordValue(record,'FILENAME'))===String(left.name||'')&&Number(recordValue(record,'BYTE_SIZE'))===Number(left.size)&&String(recordValue(record,'SHA256')||'').toLowerCase()===String(left.sha256||'').toLowerCase()&&upper(recordValue(record,'AVAILABILITY'))==='BYTES_PERSISTED_AND_VERIFIED');if(matches.length!==1)throw new Error('Every audited artifact identity must match exactly one current canonical verified-byte artifact.');}")

# 9. Current-scope derivations must not aggregate historical derived records.
rep('workflow-engine.js',"function deriveArtifactIdentity(project){const current=records(project,'artifactIdentities');", "function deriveArtifactIdentity(project){const current=recordsForCurrentScope(project,'artifactIdentities');")
rep('workflow-engine.js',"function deriveEvidenceChains(project){const current=records(project,'evidenceChains');", "function deriveEvidenceChains(project){const current=recordsForCurrentScope(project,'evidenceChains');")
