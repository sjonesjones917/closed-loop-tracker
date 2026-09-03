from pathlib import Path

schema_path=Path('workflow-schema.js')
text=schema_path.read_text()

def replace_once(old,new,label):
    global text
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text=text.replace(old,new,1)

replace_once(
    "const EXTERNAL_OPERATION_KEYS=new Set();",
    """const APPLICATION_WRITES_BY_OPERATION=Object.freeze({
  '10:FREEZE':Object.freeze(['iterations','candidateFreezes']),
  '17:FREEZE':Object.freeze(['iterations','candidateFreezes']),
  '18:COMPLETE':Object.freeze(['convergenceRecords']),
  '19:CONFIRM_FREEZE':Object.freeze(['iterations']),
  '19:CONFIRM':Object.freeze(['confirmationRecords']),
  '20:FREEZE_BASELINE':Object.freeze(['baselines']),
  '22:RUN_NATIVE_TESTS':Object.freeze(['deterministicResults']),
  '24:RUN_NATIVE_ATTACKS':Object.freeze(['adversarialResults']),
  '25:FREEZE_DELIVERY_CANDIDATE':Object.freeze(['deliveryCandidateSets']),
  '27:CALCULATE_RELEASE':Object.freeze(['releaseRecords']),
  '28:VERIFY_IDENTITY':Object.freeze(['artifactIdentities']),
  '29:CALCULATE_EVIDENCE_CHAINS':Object.freeze(['evidenceChains']),
  '30:CALCULATE_TERMINAL':Object.freeze(['deliveryRecords'])
});
const HUMAN_DECISION_WRITES_BY_OPERATION=Object.freeze({'28:CAPTURE_DELIVERY_INTENT':Object.freeze(['humanDecisions'])});
const OPERATOR_WRITES_BY_OPERATION=Object.freeze({
  '30:EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS':Object.freeze(['deliveryAttempts','commandReceipts']),
  '30:RECORD_DELIVERY_EVIDENCE':Object.freeze(['deliveryAttempts','evidenceRecords','commandReceipts'])
});
const EXTERNAL_OPERATION_KEYS=new Set();""",
    'authority maps')
replace_once(
    "(stage===10&&operation==='FREEZE')||(stage===18&&operation==='COMPLETE')",
    "(stage===10&&operation==='FREEZE')||(stage===17&&operation==='FREEZE')||(stage===18&&operation==='COMPLETE')",
    'Stage 17 FREEZE executor')
replace_once(
    "writableCollections:Object.freeze(external?[...(base.agentWritableCollections||[])]:[]),agentWritableCollections:Object.freeze(external?[...(base.agentWritableCollections||[])]:[]),allowedStageData",
    "writableCollections:Object.freeze(external?[...(base.agentWritableCollections||[])]:humanDecision?[...(HUMAN_DECISION_WRITES_BY_OPERATION[key]||[])]:operator?[...(OPERATOR_WRITES_BY_OPERATION[key]||[])]:[...(APPLICATION_WRITES_BY_OPERATION[key]||base.applicationCollections||[])]),agentWritableCollections:Object.freeze(external?[...(base.agentWritableCollections||[])]:[]),humanDecisionWritableCollections:Object.freeze(humanDecision?[...(HUMAN_DECISION_WRITES_BY_OPERATION[key]||[])]:[]),operatorWritableCollections:Object.freeze(operator?[...(OPERATOR_WRITES_BY_OPERATION[key]||[])]:[]),allowedStageData",
    'operation write authority')
replace_once(
    "VERIFICATION_PHASE_VALUES,EXACT_SCOPE_DIMENSIONS,TARGET_DIMENSIONS_BY_OPERATION,allowedCollections",
    "VERIFICATION_PHASE_VALUES,EXACT_SCOPE_DIMENSIONS,TARGET_DIMENSIONS_BY_OPERATION,APPLICATION_WRITES_BY_OPERATION,HUMAN_DECISION_WRITES_BY_OPERATION,OPERATOR_WRITES_BY_OPERATION,allowedCollections",
    'authority exports')
schema_path.write_text(text)

oracle_path=Path('verify-spec-grounded-route-oracle.mjs')
oracle=oracle_path.read_text()

def oracle_replace(old,new,label):
    global oracle
    count=oracle.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    oracle=oracle.replace(old,new,1)

oracle_replace(
    "setEq(op.readCollections,ex.r,`Stage ${stage}/${operation} read contract`);setEq(op.agentWritableCollections,ex.w,`Stage ${stage}/${operation} write contract`);",
    "setEq(op.readCollections,ex.r,`Stage ${stage}/${operation} read contract`);if(op.executorClass==='EXTERNAL_AGENT')setEq(op.agentWritableCollections,ex.w,`Stage ${stage}/${operation} agent write contract`);else setEq(op.agentWritableCollections,[],`Stage ${stage}/${operation} must expose no agent writes for ${op.executorClass}`);",
    'route oracle write authority')
old_prompt="""    let rec;try{rec=prompts.buildPromptRecord(stage,state,{operation,scope:lane});}catch(error){throw new Error(`Stage ${stage}/${operation} prompt generation failed under the route oracle: ${error?.message||error}`);}assert(rec?.prompt&&rec?.contextManifest,`Stage ${stage}/${operation} did not produce a complete prompt record.`);promptsBuilt++;
    const manifest=rec.contextManifest.readCollections||{};for(const c of ex.r){const ids=(manifest[c]||[]).map(x=>x.id),s=sent[c];assert(ids.includes(s.id),`Stage ${stage}/${operation} prompt manifest omitted current ${c}.`);assert(!ids.includes(s.sid),`Stage ${stage}/${operation} prompt manifest leaked stale ${c}.`);assert(rec.prompt.includes(s.text)||rec.prompt.includes(s.id),`Stage ${stage}/${operation} prompt omitted current ${c}.`);assert(!rec.prompt.includes(s.stale)&&!rec.prompt.includes(s.sid),`Stage ${stage}/${operation} prompt leaked stale ${c}.`);}for(const c of WITHHOLD[`${stage}:${operation}`]||[]){const s=sent[c];assert(!rec.prompt.includes(s.text)&&!rec.prompt.includes(s.id),`Stage ${stage}/${operation} leaked withheld ${c}.`);}for(const c of ex.w){assert(rec.prompt.includes(c),`Stage ${stage}/${operation} omitted writable collection ${c}.`);for(const f of schema.recordAgentFields(c))assert(rec.prompt.includes(f),`Stage ${stage}/${operation} omitted legitimate field ${c}.${f}.`);}for(const f of op.allowedStageData)assert(rec.prompt.includes(f),`Stage ${stage}/${operation} omitted legitimate stageData ${f}.`);
    for(const phrase of ['CONVERSATION PRECEDENCE — HUMAN EXPERIENCE IS PART OF EXECUTION','ask the human directly in concise plain language','The human supplies project information once','Before final JSON, re-read the complete current-stage instruction'])assert(rec.prompt.includes(phrase),`Stage ${stage}/${operation} omitted human-experience rule: ${phrase}`);"""
new_prompt="""    if(op.executorClass==='EXTERNAL_AGENT'){
      let rec;try{rec=prompts.buildPromptRecord(stage,state,{operation,scope:lane});}catch(error){throw new Error(`Stage ${stage}/${operation} prompt generation failed under the route oracle: ${error?.message||error}`);}assert(rec?.prompt&&rec?.contextManifest,`Stage ${stage}/${operation} did not produce a complete prompt record.`);promptsBuilt++;
      const manifest=rec.contextManifest.readCollections||{};for(const c of ex.r){const ids=(manifest[c]||[]).map(x=>x.id),s=sent[c];assert(ids.includes(s.id),`Stage ${stage}/${operation} prompt manifest omitted current ${c}.`);assert(!ids.includes(s.sid),`Stage ${stage}/${operation} prompt manifest leaked stale ${c}.`);assert(rec.prompt.includes(s.text)||rec.prompt.includes(s.id),`Stage ${stage}/${operation} prompt omitted current ${c}.`);assert(!rec.prompt.includes(s.stale)&&!rec.prompt.includes(s.sid),`Stage ${stage}/${operation} prompt leaked stale ${c}.`);}for(const c of WITHHOLD[`${stage}:${operation}`]||[]){const s=sent[c];assert(!rec.prompt.includes(s.text)&&!rec.prompt.includes(s.id),`Stage ${stage}/${operation} leaked withheld ${c}.`);}for(const c of ex.w){assert(rec.prompt.includes(c),`Stage ${stage}/${operation} omitted writable collection ${c}.`);for(const f of schema.recordAgentFields(c))assert(rec.prompt.includes(f),`Stage ${stage}/${operation} omitted legitimate field ${c}.${f}.`);}for(const f of op.allowedStageData)assert(rec.prompt.includes(f),`Stage ${stage}/${operation} omitted legitimate stageData ${f}.`);
      for(const phrase of ['CONVERSATION PRECEDENCE — HUMAN EXPERIENCE IS PART OF EXECUTION','ask the human directly in concise plain language','The human supplies project information once','Before final JSON, re-read the complete current-stage instruction'])assert(rec.prompt.includes(phrase),`Stage ${stage}/${operation} omitted human-experience rule: ${phrase}`);
    }else{
      assert(op.acceptsExternalResponse===false,`Stage ${stage}/${operation} ${op.executorClass} operation must reject external response envelopes.`);assert(op.reservationRequired===false,`Stage ${stage}/${operation} ${op.executorClass} operation must not require an external-agent reservation.`);
    }"""
oracle_replace(old_prompt,new_prompt,'route oracle prompt boundary')
marker="const state=core.createBlankState('JOB-SPEC-ROUTE-ORACLE');"
app_assert="""const APP_WRITES={'10:FREEZE':['iterations','candidateFreezes'],'17:FREEZE':['iterations','candidateFreezes'],'18:COMPLETE':['convergenceRecords'],'19:CONFIRM_FREEZE':['iterations'],'19:CONFIRM':['confirmationRecords'],'20:FREEZE_BASELINE':['baselines'],'22:RUN_NATIVE_TESTS':['deterministicResults'],'24:RUN_NATIVE_ATTACKS':['adversarialResults'],'25:FREEZE_DELIVERY_CANDIDATE':['deliveryCandidateSets'],'27:CALCULATE_RELEASE':['releaseRecords'],'28:VERIFY_IDENTITY':['artifactIdentities'],'29:CALCULATE_EVIDENCE_CHAINS':['evidenceChains'],'30:CALCULATE_TERMINAL':['deliveryRecords']};
for(const [key,writes] of Object.entries(APP_WRITES)){const [stage,operation]=key.split(':');const op=schema.operationContract(Number(stage),operation);assert(op?.executorClass==='APPLICATION',`${key} must be APPLICATION executed.`);setEq(op.writableCollections,writes,`${key} application write contract`);setEq(op.agentWritableCollections,[],`${key} application command must not expose agent writes`);}
"""
oracle_replace(marker,app_assert+marker,'route oracle application assertions')
oracle_path.write_text(oracle)
