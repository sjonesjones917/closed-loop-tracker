from pathlib import Path

e=Path('workflow-engine.js')
s=e.read_text()

old="""  if(Number(stage)===19){const appIteration=records(project,'iterations').find(r=>Number(r.stage)===19&&isActiveRecord(r)&&upper(recordValue(r,'PURPOSE'))==='UNCHANGED_CONFIRMATION'&&(!scopeRule.iterationId||recordId(r,'iterations')===String(scopeRule.iterationId))&&(!scopeRule.candidateId||String(recordValue(r,'CANDIDATE_ID')||r.scope?.candidateId||'')===String(scopeRule.candidateId)));if(appIteration)out.add('CONFIRM_FREEZE');}
  return out;
}"""
new="""  if(Number(stage)===17){const appIteration=records(project,'iterations').find(r=>Number(r.stage)===17&&isActiveRecord(r)&&upper(recordValue(r,'PURPOSE'))==='CORRECTED'&&(!scopeRule.iterationId||recordId(r,'iterations')===String(scopeRule.iterationId))&&(!scopeRule.candidateId||String(recordValue(r,'CANDIDATE_ID')||r.scope?.candidateId||'')===String(scopeRule.candidateId))),candidateId=appIteration?String(recordValue(appIteration,'CANDIDATE_ID')||appIteration.scope?.candidateId||''):'' ,candidate=candidateId?records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===candidateId&&isActiveRecord(r)):null;if(appIteration&&candidate)out.add('FREEZE');}
  if(Number(stage)===19){const appIteration=records(project,'iterations').find(r=>Number(r.stage)===19&&isActiveRecord(r)&&upper(recordValue(r,'PURPOSE'))==='UNCHANGED_CONFIRMATION'&&(!scopeRule.iterationId||recordId(r,'iterations')===String(scopeRule.iterationId))&&(!scopeRule.candidateId||String(recordValue(r,'CANDIDATE_ID')||r.scope?.candidateId||'')===String(scopeRule.candidateId)));if(appIteration)out.add('CONFIRM_FREEZE');}
  return out;
}"""
if old not in s: raise SystemExit('acceptedOperationSet anchor not found')
s=s.replace(old,new)

old="""    case 13:{
      requireAccepted();const reqs=mandatoryRequirements(project),compared=new Set(collection('comparisons').map(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')));
      const missing=reqs.filter(req=>!compared.has(requirementId(req))).map(requirementId);
      if(missing.length)reasons.push(`Cross-run comparison is missing for: ${missing.join(', ')}.`);
      break;
    }"""
new="""    case 13:{
      requireAccepted();const iteration=latestIteration(project,[10,17,19]),iterationId=recordId(iteration,'iterations'),scope=iterationId?scopeForIteration(project,iterationId):currentScope(project),reqs=mandatoryRequirements(project,scope),comparisons=iterationId?recordsForIteration(project,'comparisons',iterationId):[],byReq=new Map();for(const record of comparisons){const id=String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');if(!byReq.has(id))byReq.set(id,[]);byReq.get(id).push(record);}for(const req of reqs){const id=requirementId(req),rows=byReq.get(id)||[],facts=comparisonFacts(project,id,iterationId);if(rows.length!==1)reasons.push(`Exactly one current comparison is required for ${id}; found ${rows.length}.`);if(facts.runDeterminations.length!==10||new Set(facts.runDeterminations.map(x=>String(x.RUN_ID||x.runId||''))).size!==10)reasons.push(`Cross-run comparison for ${id} does not cover exactly ten distinct current runs.`);if(facts.determinations.length!==10)reasons.push(`Application-derived comparison facts for ${id} do not contain exactly ten current determinations.`);}const expected=new Set(reqs.map(requirementId)),unexpected=comparisons.filter(r=>!expected.has(String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')));if(unexpected.length)reasons.push('Stage 13 contains comparison records outside the current mandatory requirement set.');
      break;
    }"""
if old not in s: raise SystemExit('Stage13 gate anchor not found')
s=s.replace(old,new)

old="""    case 16:requireAccepted();if(confirmedDefects(project).length&&!collection('changes').length)reasons.push('A responsible-layer changeset or blocker is required for confirmed defects.');break;"""
new="""    case 16:{requireAccepted();const defects=confirmedDefects(project),rcas=recordsForCurrentScope(project,'rootCauses'),changes=recordsForCurrentScope(project,'changes').filter(r=>Number(r.stage)===16),blockers=openBlockers(project,16),triggered=new Set(changes.flatMap(c=>{const raw=recordValue(c,'TRIGGERING_DEFECT_IDS');return Array.isArray(raw)?raw.map(String):String(raw||'').split(/[;,\\s]+/).filter(Boolean);}));for(const defect of defects){const id=recordId(defect,'defects'),rca=rcas.filter(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===id);if(rca.length!==1){reasons.push(`Exactly one current root-cause analysis is required for ${id} before correction; found ${rca.length}.`);continue;}const blocked=blockers.some(b=>[recordValue(b,'AFFECTED_ARTIFACTS'),recordValue(b,'AFFECTED_REQUIREMENTS'),recordValue(b,'WHY_WORK_CANNOT_CONTINUE'),recordValue(b,'RESOLUTION_EVIDENCE')].some(v=>String(v||'').includes(id)));if(!triggered.has(id)&&!blocked)reasons.push(`Confirmed defect ${id} has neither a current controlled root-cause correction nor a defect-specific blocker.`);}if(changes.some(c=>truth(recordValue(c,'IN_PLACE_MODIFICATION'))))reasons.push('Stage 16 cannot modify a controlled artifact in place; a new version is required.');break;}"""
if old not in s: raise SystemExit('Stage16 gate anchor not found')
s=s.replace(old,new)

old="""    case 20:{requireAccepted();const confirmations=recordsForCurrentScope(project,'confirmationRecords').filter(record=>upper(recordValue(record,'DETERMINATION'))==='SATISFIED'),baselines=recordsForCurrentScope(project,'baselines'),iteration=latestIteration(project,[19]),iterationId=recordId(iteration,'iterations'),candidateId=iterationCandidateId(project,iterationId);"""
new="""    case 20:{const confirmations=recordsForCurrentScope(project,'confirmationRecords').filter(record=>effectiveDetermination('confirmationRecords',record,null,project)==='SATISFIED'),baselines=recordsForCurrentScope(project,'baselines'),iteration=latestIteration(project,[19]),iterationId=recordId(iteration,'iterations'),candidateId=iterationCandidateId(project,iterationId);"""
if old not in s: raise SystemExit('Stage20 gate anchor not found')
s=s.replace(old,new)

old="""  if(stage===20&&acceptedChanges(project,20).length){
    const baselines=recordsForCurrentScope(project,'baselines').filter(isActiveRecord);
    if(!baselines.length)return actionEnvelope(project,stage,{actionType:'FREEZE_BASELINE',heading:'Authorize and freeze the production baseline',explanation:'Select the exact approved component files. The application binds them to the successful unchanged confirmation, computes byte identities, allocates the baseline identity, and freezes the immutable baseline.',primaryButton:'Freeze baseline'});
  }"""
new="""  if(stage===20){
    const confirmations=recordsForCurrentScope(project,'confirmationRecords').filter(record=>effectiveDetermination('confirmationRecords',record,null,project)==='SATISFIED'),baselines=recordsForCurrentScope(project,'baselines').filter(isActiveRecord);
    if(confirmations.length===1&&!baselines.length)return actionEnvelope(project,stage,{actionType:'FREEZE_BASELINE',heading:'Authorize and freeze the production baseline',explanation:'Select the exact approved component files. The application binds them to the successful unchanged confirmation, computes byte identities, allocates the baseline identity, and freezes the immutable baseline. No external-agent response is required for this application-owned freeze.',primaryButton:'Freeze baseline'});
  }"""
if old not in s: raise SystemExit('Stage20 action anchor not found')
s=s.replace(old,new)

old="""    case 28:{
      const release=all('releaseRecords').at(-1);
      if(upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')reasons.push('Stage 27 must be ACCEPTED before artifact identity verification.');
      if(!all('artifactIdentities').length)reasons.push('No audited-versus-delivery artifact identity comparison exists.');
      if(all('artifactIdentities').some(record=>!truth(recordValue(record,'EXACT_HASH_MATCH'))||!truth(recordValue(record,'EXACT_SIZE_MATCH'))||upper(recordValue(record,'AUTHORIZATION'))!=='AUTHORIZED'))reasons.push('At least one release artifact does not exactly match the audited artifact.');
      break;
    }"""
new="""    case 28:{
      const identity=verifyArtifactIdentity(project),release=recordsForCurrentScope(project,'releaseRecords').at(-1);if(!release||upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')reasons.push('Stage 27 must have exactly one current ACCEPTED release before artifact identity verification.');if(identity.determination!=='ACCEPTED')reasons.push(identity.reason||'Current release artifact identity is not established.');if(identity.releaseId&&release&&identity.releaseId!==recordId(release,'releaseRecords'))reasons.push('Artifact identity verification is not bound to the current release record.');
      break;
    }"""
if old not in s: raise SystemExit('Stage28 gate anchor not found')
s=s.replace(old,new)

old="""    case 29:{
      const reqs=mandatoryRequirements(project),chains=all('evidenceChains'),byReq=new Map(chains.map(record=>[String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||''),record]));
      const incomplete=reqs.filter(req=>upper(recordValue(byReq.get(requirementId(req)),'STATUS'))!=='COMPLETE').map(requirementId);
      if(incomplete.length)reasons.push(`Complete evidence chains are missing for: ${incomplete.join(', ')}.`);
      break;
    }"""
new="""    case 29:{
      const reqs=mandatoryRequirements(project,currentScope(project)),chains=recordsForCurrentScope(project,'evidenceChains').filter(isActiveRecord),release=recordsForCurrentScope(project,'releaseRecords').at(-1),releaseId=recordId(release,'releaseRecords'),identities=new Set(recordsForCurrentScope(project,'artifactIdentities').map(r=>recordId(r,'artifactIdentities'))),byReq=new Map();for(const chain of chains){const id=String(recordValue(chain,'REQ_ID')||chain.relationships?.REQ_ID||'');if(!byReq.has(id))byReq.set(id,[]);byReq.get(id).push(chain);}for(const req of reqs){const id=requirementId(req),rows=byReq.get(id)||[];if(rows.length!==1){reasons.push(`Exactly one current application-derived evidence chain is required for ${id}; found ${rows.length}.`);continue;}const chain=rows[0];if(chain.source!=='APPLICATION_DERIVATION'||chain.derivationKey!=='stage29.evidenceChains')reasons.push(`Evidence chain for ${id} is not application-derived.`);if(upper(recordValue(chain,'STATUS'))!=='COMPLETE')reasons.push(`Evidence chain for ${id} is incomplete.`);if(String(recordValue(chain,'RELEASE_DECISION_ID')||chain.relationships?.RELEASE_DECISION_ID||'')!==releaseId)reasons.push(`Evidence chain for ${id} is not bound to the current release.`);const chainIdentity=recordValue(chain,'ARTIFACT_HASH_IDENTITY'),chainIds=Array.isArray(chainIdentity)?chainIdentity.map(String):String(chainIdentity||'').split(/[;,\\s]+/).filter(Boolean);if(chainIds.some(x=>!identities.has(x)))reasons.push(`Evidence chain for ${id} references a stale or non-current artifact identity.`);}const expected=new Set(reqs.map(requirementId)),unexpected=chains.filter(c=>!expected.has(String(recordValue(c,'REQ_ID')||c.relationships?.REQ_ID||'')));if(unexpected.length)reasons.push('Current evidence-chain batch contains a chain outside the current mandatory requirement set.');
      break;
    }"""
if old not in s: raise SystemExit('Stage29 gate anchor not found')
s=s.replace(old,new)
e.write_text(s)

q=Path('workflow-schema.js')
t=q.read_text()
old="required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','CORRECTION','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE']"
new="required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE']"
if old not in t: raise SystemExit('Regression required-field anchor not found')
t=t.replace(old,new,1)
q.write_text(t)

for name in ['index.html','app-core.js','test-runtime.js']:
    p=Path(name)
    text=p.read_text().replace('runtime-20260830-live-operator-60','runtime-20260830-live-operator-61')
    p.write_text(text)
