from pathlib import Path


def replace_once(text, old, new, label):
    count=text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old,new,1)

p=Path('workflow-engine.js')
s=p.read_text()

# Integrate semantic projection inside the single gate authority. Do not wrap/reassign gate at runtime.
s=replace_once(s,
"function gate(stage,project){\n  ensureShape(project);\n  const reasons=[];",
"function gate(stage,project){\n  ensureShape(project);\n  const canonicalProject=project;\n  project=adjudicatedClone(project);\n  const reasons=[];",
'gate semantic projection')

# Stage 7 uses the controlled execution outcome; arbitrary ACTUAL_RESULT prose is never truth-coerced.
s=replace_once(s,
"if(truth(recordValue(mutation,'ACTUAL_RESULT'))&&upper(recordValue(mutation,'EXPECTED_REJECTION')).includes('REJECT')&&!String(recordValue(mutation,'VALIDATOR_DEFECT_ID')||mutation.relationships?.VALIDATOR_DEFECT_ID||'').trim())reasons.push('A known-invalid fixture was accepted without a linked validator defect.');",
"const effective=evaluateResultConsistency('failureTests',mutation,null,canonicalProject);if(effective.determination!=='SATISFIED')reasons.push(...(effective.reasons.length?effective.reasons:[recordId(mutation,'failureTests')+': failure-test execution did not establish the expected rejection.']));",
'Stage 7 controlled outcome')

# Central failure-test adjudication.
marker="function evaluateResultConsistency(collection,record,test,project){"
insert="""function failureTestDetermination(project,record){
  const reasons=[],evidence=evaluateEvidenceContract(null,record,null,project),outcome=upper(recordValue(record,'EXECUTION_OUTCOME'));
  if(!String(recordValue(record,'FIXTURE')||'').trim())reasons.push('Failure fixture is not identifiable.');
  if(!String(recordValue(record,'EXPECTED_REJECTION')||'').trim())reasons.push('Expected rejection is missing.');
  if(!String(recordValue(record,'ACTUAL_RESULT')||'').trim())reasons.push('Actual failure-test execution result is missing.');
  if(!evidence.sufficient)reasons.push(...evidence.reasons);
  if(!['REJECTED_INVALID','ACCEPTED_INVALID','UNDETERMINED','NOT_RUN'].includes(outcome))return {determination:'UNDETERMINED',reasons:[...reasons,'EXECUTION_OUTCOME is not a controlled failure-test outcome.'],evidence};
  if(outcome==='ACCEPTED_INVALID'){
    if(!String(recordValue(record,'VALIDATOR_DEFECT_ID')||record?.relationships?.VALIDATOR_DEFECT_ID||'').trim())reasons.push('Known-invalid fixture was accepted without a linked validator defect.');
    return {determination:'VIOLATED',reasons,evidence};
  }
  if(['UNDETERMINED','NOT_RUN'].includes(outcome))return {determination:'UNDETERMINED',reasons:[...reasons,'Failure test did not conclusively demonstrate rejection.'],evidence};
  return {determination:reasons.length?'UNDETERMINED':'SATISFIED',reasons,evidence};
}
"""
if marker not in s: raise SystemExit('evaluateResultConsistency marker missing')
s=s.replace(marker,insert+marker,1)

s=replace_once(s,
"  if(collection==='regressionExecutions')return {...effectiveRegressionDetermination(project,record),claimedDetermination:claimed};",
"  if(collection==='regressionExecutions')return {...effectiveRegressionDetermination(project,record),claimedDetermination:claimed};\n  if(collection==='failureTests')return {...failureTestDetermination(project,record),claimedDetermination:claimed};",
'failureTests central adjudication')

# Release-critical Stage 12 verification requires application-established independence, not a naked distinct-context claim.
s=replace_once(s,
"if(!['APPLICATION_ESTABLISHED','EXTERNALLY_SUPPORTED'].includes(ind.determination))reasons.push('Verification independence is neither application-established nor externally supported.');",
"const trust=releaseVerificationTrust(project,record);if(trust.determination!=='APPLICATION_ESTABLISHED')reasons.push(...(trust.reasons.length?trust.reasons:['Verification independence is not application-established.']));",
'Stage 12 application-established independence')

# Stage 23/24 reviewer separation is application-established against the current Stage 21 production context.
s=replace_once(s,
"else if(collection==='meaningResults'){if(!evidence.sufficient)reasons.push(...evidence.reasons);",
"else if(collection==='meaningResults'){if(!evidence.sufficient)reasons.push(...evidence.reasons);const reviewer=reviewerTrust(project,record);if(reviewer.determination!=='APPLICATION_ESTABLISHED')reasons.push(...(reviewer.reasons.length?reviewer.reasons:['Meaning-review independence is not application-established.']));",
'meaning reviewer trust')
s=replace_once(s,
"else if(collection==='adversarialResults'){if(!evidence.sufficient)reasons.push(...evidence.reasons);",
"else if(collection==='adversarialResults'){if(!evidence.sufficient)reasons.push(...evidence.reasons);const reviewer=reviewerTrust(project,record);if(reviewer.determination!=='APPLICATION_ESTABLISHED')reasons.push(...(reviewer.reasons.length?reviewer.reasons:['Adversarial-review independence is not application-established.']));",
'adversarial reviewer trust')

reviewer_fn="""function reviewerTrust(project,record){
  const stage=Number(record?.stage||0),reviewerContextId=String(recordValue(record,'REVIEWER_CONTEXT_ID')||'').trim(),product=recordsForCurrentScope(project,'products').at(-1),productionContextId=String(recordValue(product,'PRODUCTION_CONTEXT_ID')||product?.relationships?.PRODUCTION_CONTEXT_ID||'').trim(),contexts=records(project,'freshContexts'),reviewer=contexts.find(c=>recordId(c,'freshContexts')===reviewerContextId&&Number(c.stage)===stage&&isActiveRecord(c)),production=contexts.find(c=>recordId(c,'freshContexts')===productionContextId&&isActiveRecord(c)),reasons=[];
  if(![23,24].includes(stage))reasons.push('Reviewer trust is only defined for Stages 23 and 24.');
  if(!product||!productionContextId||!production)reasons.push('Current Stage 21 production context is not canonically established.');
  if(!reviewerContextId||!reviewer)reasons.push('Current reviewer context is not canonically registered for this stage.');
  if(reviewerContextId&&productionContextId&&reviewerContextId===productionContextId)reasons.push('Reviewer context reuses the Stage 21 production context.');
  const reviewerExternal=String(recordValue(reviewer,'EXTERNAL_CONTEXT_IDENTIFIER')||'').trim(),productionExternal=String(recordValue(production,'EXTERNAL_CONTEXT_IDENTIFIER')||'').trim();
  if(!reviewerExternal||['UNKNOWN','NONE','UNASSIGNED','PENDING','NOT APPLICABLE'].includes(upper(reviewerExternal)))reasons.push('Reviewer external context identity is not established.');
  if(reviewerExternal&&productionExternal&&upper(reviewerExternal)===upper(productionExternal))reasons.push('Reviewer external context identity reuses the production context identity.');
  const forbidden=/generator\\s*(?:reasoning|self[- ]?evaluation|correctness)|prior\\s*(?:review|reviewer|meaning|adversarial)|comparison\\s*findings|root\\s*cause|\\bRCA\\b|correction\\s*proposal/i;
  if(reviewer&&forbidden.test(JSON.stringify(recordValue(reviewer,'AUTHORIZED_PROJECT_INPUTS')||[])))reasons.push('Reviewer context contains prohibited generator/prior-review/correction material.');
  const rawId=String(record?.rawResponseId||'').trim(),proposalId=String(record?.sourceProposalId||'').trim(),accepted=acceptedChanges(project,stage).find(change=>change.rawResponseId===rawId&&(!proposalId||change.proposalId===proposalId)),receipt=safe(project.projectData.outputReceipts).find(item=>item.rawResponseId===rawId);
  if(!rawId||!proposalId||!accepted||!receipt||Number(receipt.stage)!==stage)reasons.push('No current accepted reviewer execution receipt is bound to this result.');
  return {determination:reasons.length?'UNDETERMINED':'APPLICATION_ESTABLISHED',reasons,reviewerContextId:reviewerContextId||null,productionContextId:productionContextId||null,basis:reasons.length?'NONE':'REGISTERED_REVIEWER_CONTEXT_AND_ACCEPTED_RECEIPT'};
}
"""
marker="function releaseMetrics(project){"
if marker not in s: raise SystemExit('releaseMetrics marker missing')
s=s.replace(marker,reviewer_fn+marker,1)

# Effective determinations, not submitted strings, drive stability diagnostics.
s=replace_once(s,
".map(v=>upper(recordValue(v,'DETERMINATION'))))),counts=",
".map(v=>effectiveDetermination('verification',v,testForResult(project,v),project)))),counts=",
'requirement stability effective determination')
s=replace_once(s,
".map(v=>upper(recordValue(v,'DETERMINATION'))),counts=",
".map(v=>effectiveDetermination('verification',v,testForResult(project,v),project)),counts=",
'test stability effective determination')

# Baseline freeze cannot be authorized by an agent-authored favorable confirmation.
s=replace_once(s,
"const confirmation=recordsForCurrentScope(project,'confirmationRecords').filter(r=>upper(recordValue(r,'DETERMINATION'))==='SATISFIED').at(-1);",
"const confirmation=recordsForCurrentScope(project,'confirmationRecords').filter(r=>effectiveDetermination('confirmationRecords',r,null,project)==='SATISFIED').at(-1);",
'freezeBaseline effective confirmation')

# Move the existing semantic gate checks into the one gate function; delete runtime gate reassignment.
start=s.find("\nconst applicationadjudicationGate=gate;")
end=s.find("\nfunction deriveStageData",start)
if start<0 or end<0: raise SystemExit('runtime gate wrapper block not found')
wrapper=s[start:end]
# Preserve the substantive checks, but run them directly against canonicalProject.
semantic="""
  const add=x=>{for(const r of safe(x))if(r&&!reasons.includes(r))reasons.push(r);};
  if(stage===9)for(const r of recordsForCurrentScope(canonicalProject,'preflightRecords')){const e=evaluateResultConsistency('preflightRecords',r,null,canonicalProject);if(e.determination!=='SATISFIED')add(e.reasons.length?e.reasons:['Preflight is not application-derived SATISFIED.']);}
  if(stage===13){const iteration=latestIteration(canonicalProject,[10,17,19]),iterationId=recordId(iteration,'iterations');for(const req of mandatoryRequirements(canonicalProject,scopeForIteration(canonicalProject,iterationId))){const facts=comparisonFacts(canonicalProject,requirementId(req),iterationId),rows=recordsForIteration(canonicalProject,'comparisons',iterationId).filter(r=>String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')===requirementId(req));if(rows.length!==1)add(['Exactly one comparison record is required for '+requirementId(req)+'.']);if(!facts.allSatisfied&&facts.anyViolation)add(['Derived comparison contains a violation for '+requirementId(req)+'.']);if(facts.anyUndetermined)add(['Derived comparison contains an undetermined result for '+requirementId(req)+'.']);}}
  if(stage===14)for(const defect of confirmedDefects(canonicalProject)){const id=recordId(defect,'defects'),rcas=records(canonicalProject,'rootCauses').filter(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===id);if(rcas.length!==1)add(['Exactly one complete RCA is required for '+id+'.']);else{const v=validateRootCauseRecord(rcas[0],canonicalProject);if(!v.valid)add(v.reasons.map(x=>id+': '+x));}}
  if(stage===16){for(const defect of confirmedDefects(canonicalProject)){const id=recordId(defect,'defects'),changes=records(canonicalProject,'changes',{stage:16}).filter(c=>{const raw=recordValue(c,'TRIGGERING_DEFECT_IDS'),ids=Array.isArray(raw)?raw.map(String):String(raw||'').split(/[;,\\s]+/).filter(Boolean);return ids.includes(id);});if(changes.length!==1)add(['Exactly one responsible-layer changeset trace is required for '+id+'.']);else{const v=validateChangeTrace(changes[0],canonicalProject);if(!v.valid)add(v.reasons.map(x=>id+': '+x));}}}
  if(stage===19)for(const r of recordsForCurrentScope(canonicalProject,'confirmationRecords')){const e=confirmationDetermination(canonicalProject,r);if(e.determination!=='SATISFIED')add(e.reasons.length?e.reasons:['Unchanged confirmation is not application-derived SATISFIED.']);}
  if(stage===20){const ok=recordsForCurrentScope(canonicalProject,'confirmationRecords').filter(r=>effectiveDetermination('confirmationRecords',r,null,canonicalProject)==='SATISFIED');if(ok.length!==1)add(['Exactly one application-derived successful unchanged confirmation is required.']);}
  if(stage===21)for(const r of recordsForCurrentScope(canonicalProject,'products')){const e=evaluateResultConsistency('products',r,null,canonicalProject);if(e.determination!=='SATISFIED')add(e.reasons.length?e.reasons:['Production execution is not application-derived SATISFIED.']);}
  const stageCollection={22:'deterministicResults',23:'meaningResults',24:'adversarialResults',25:'representationInspections'}[stage];if(stageCollection)for(const r of recordsForCurrentScope(canonicalProject,stageCollection)){const e=evaluateResultConsistency(stageCollection,r,testForResult(canonicalProject,r),canonicalProject);if(e.determination!=='SATISFIED')add(e.reasons.length?e.reasons:[stageCollection+' contains a non-satisfied effective result.']);}
  if(stage===26){for(const r of recordsForCurrentScope(canonicalProject,'processAudits')){const e=auditDetermination('processAudits',r,canonicalProject);if(e.determination!=='SATISFIED')add(e.reasons);}for(const r of recordsForCurrentScope(canonicalProject,'productAudits')){const e=auditDetermination('productAudits',r,canonicalProject);if(e.determination!=='SATISFIED')add(e.reasons);}}
  if(stage>=27&&releaseMetrics(canonicalProject).determination==='ACCEPTED'&&detectCurrentContradictions(canonicalProject).length)add(['Release cannot be ACCEPTED while an adjudication contradiction exists.']);
"""
needle="  const blocked=questions.length>0||blockers.length>0||executionFailures.length>0;"
s=replace_once(s,needle,semantic+"\n"+needle,'integrated semantic gate checks')
s=s[:start]+"\n"+s[end:]

# Stronger static invariant: no hidden runtime gate reassignment remains.
if 'applicationadjudicationGate' in s or 'gate=function adjudicationGate' in s:
    raise SystemExit('runtime gate wrapper survived')

p.write_text(s)

# Minimal schema extension: the current contract otherwise cannot bind Stage 23/24 results to a canonical reviewer context.
p=Path('workflow-schema.js')
s=p.read_text()
s=replace_once(s,
'      "PRODUCT_LOCATION",\n      "EXTERNAL_SOURCE_EVIDENCE",',
'      "REVIEWER_CONTEXT_ID",\n      "PRODUCT_LOCATION",\n      "EXTERNAL_SOURCE_EVIDENCE",',
'meaning reviewer context field')
s=replace_once(s,
'      "ATTACK",\n      "METHOD",',
'      "REVIEWER_CONTEXT_ID",\n      "ATTACK",\n      "METHOD",',
'adversarial reviewer context field')
p.write_text(s)

# Professional prompts: make the canonical reviewer identity and separation requirement explicit.
p=Path('prompt-engine.js')
s=p.read_text()
s=replace_once(s,
"23:'Verify the actual finished product",
"23:'Use the application-registered fresh independent reviewer context for this review. Echo REVIEWER_CONTEXT_ID exactly from the authorized context; never invent or substitute it. The reviewer context must be different from the Stage 21 production context, and if that canonical reviewer identity is unavailable return BLOCKED with MISSING_APPLICATION_CONTEXT. Verify the actual finished product",
'Stage 23 reviewer prompt')
s=replace_once(s,
"24:'Attack the actual finished product",
"24:'Use the application-registered fresh independent reviewer context for this adversarial review. Echo REVIEWER_CONTEXT_ID exactly from the authorized context; never invent or substitute it. The reviewer context must be different from the Stage 21 production context, and if that canonical reviewer identity is unavailable return BLOCKED with MISSING_APPLICATION_CONTEXT. Attack the actual finished product",
'Stage 24 reviewer prompt')
p.write_text(s)

# Extend the existing universal semantic suite; do not create a parallel guard family.
p=Path('verify-semantic-invariant.mjs')
s=p.read_text()
append="""

// Architecture and residual semantic guards from the controlling mandate.
const engineSource=fs.readFileSync('workflow-engine.js','utf8');
assert(!engineSource.includes('applicationadjudicationGate')&&!engineSource.includes('gate=function adjudicationGate'),'Semantic gate is implemented as a prohibited runtime wrapper/monkey patch');
assert(!engineSource.includes("map(v=>upper(recordValue(v,'DETERMINATION')))"),'Stability diagnostics still consume submitted determinations');
assert(!engineSource.includes("filter(r=>upper(recordValue(r,'DETERMINATION'))==='SATISFIED').at(-1)"),'Baseline authorization still selects raw confirmation verdicts');
const schemaSource=fs.readFileSync('workflow-schema.js','utf8');
assert((schemaSource.match(/\"REVIEWER_CONTEXT_ID\"/g)||[]).length>=2,'Stage 23/24 contracts do not bind results to reviewer contexts');
const promptSource=fs.readFileSync('prompt-engine.js','utf8');
assert(promptSource.includes('Echo REVIEWER_CONTEXT_ID exactly')&&promptSource.includes('different from the Stage 21 production context'),'Stage 23/24 professional prompts do not establish reviewer identity/separation');

console.log(JSON.stringify({directSemanticGate:true,effectiveStability:true,effectiveBaselineAuthorization:true,reviewerContextBinding:true}));
"""
if 'directSemanticGate:true' not in s:
    s=s.rstrip()+append
p.write_text(s)

# Remove transient source-export machinery from the final reliability tree.
for name in ['.export-source/READY','.github/workflows/export-source.yml']:
    Path(name).unlink(missing_ok=True)
