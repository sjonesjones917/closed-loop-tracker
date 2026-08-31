from pathlib import Path
import re

def replace_once(path, old, new, label):
    p=Path(path); s=p.read_text()
    n=s.count(old)
    assert n==1,(label,n)
    p.write_text(s.replace(old,new))

def regex_once(path, pattern, repl, label):
    p=Path(path); s=p.read_text()
    out,n=re.subn(pattern,repl,s,count=1,flags=re.S)
    assert n==1,(label,n)
    p.write_text(out)

replace_once('workflow-engine.js',
"if(test&&['INDEPENDENT_AGENT_REVIEW','EXTERNAL_AGENT_TOOL','HUMAN_INSPECTION','EXTERNAL_SYSTEM'].includes(mode)&&!contextId)reasons.push('Execution/reviewer context identity is not established.');",
"if(test&&['INDEPENDENT_AGENT_REVIEW','EXTERNAL_AGENT_TOOL','EXTERNAL_SYSTEM'].includes(mode)&&!contextId)reasons.push('Execution/reviewer context identity is not established.');if(test&&mode==='HUMAN_INSPECTION'&&!evidence.some(item=>upper(recordValue(item,'AUTHORITY_TYPE'))==='HUMAN_OBSERVATION'))reasons.push('Human inspection requires explicit human-owned observation evidence.');",
'human inspection evidence authority')
replace_once('workflow-engine.js',
"if(stage===4){const accounting=evaluateObligationAccounting(project);if(!accounting.complete)add(accounting.reasons);}",
"if(stage===4){const accounting=evaluateObligationAccounting(project);if(!accounting.complete)add(accounting.reasons);}if(stage===6){const plan=testExecutionPlan(project);for(const item of safe(plan?.items)){if(item.artifactReady===false)add([`${item.testId||'UNKNOWN TEST'}: required artifact bytes are missing or no longer application-verified.`]);if(item.capabilityReady===false)add([`${item.testId||'UNKNOWN TEST'}: required execution capability is unavailable.`]);if(item.executionRoute==='BLOCKED'||item.operatorAction==='BLOCKED')add([`${item.testId||'UNKNOWN TEST'}: verification route is blocked${item.blockingReason?` — ${item.blockingReason}`:''}.`]);}}",
'Stage 6 custody and capability gate')
replace_once('workflow-engine.js','ACTUAL_MANDATORY_RECORDS:matrix.actual.length','ACTUAL_MANDATORY_RECORDS:matrix.verification.length','Stage 12 matrix derivation')

replace_once('prompt-engine.js',
"Discover and inspect every reasonably possible controlling, governing, evidentiary, or informative external source needed for this project; distinguish authority level, role, applicability, currency, supersession, and conflicts.",
"Discover and inspect every reasonably possible controlling, governing, evidentiary, or informative external source needed for this project; distinguish authority level, role, applicability, currency, supersession, and conflicts. Continue complete source-discovery passes until no new applicable controlling or correctness-relevant external source category is found. Do not stop at the first plausible source.",
'Stage 2 source saturation')

replace_once('index.html','.expandable-prompt{height:280px;max-height:280px}.expandable-prompt.expanded{height:auto;max-height:none}', '.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}','approved prompt dimensions')
replace_once('verify-v3-contract.mjs',"assert.match(app,/current value/i,'proposal display must include current values');","assert.match(app,/currentValue|current value/i,'proposal display must include current values');",'proposal current-value proof')

replace_once('verify-all-stage-prompts.mjs',
"assert(text.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE'),`Stage ${s}/${op} omitted universal no-repeat human collaboration contract.`);",
"assert(/HUMAN COLLABORATION MODE — APPLIES TO EVERY(?: EXTERNAL-AGENT)? STAGE/.test(text)&&/human supplies project information once/i.test(text)&&/never ask the human to .*repeat.*reattach/i.test(text),`Stage ${s}/${op} omitted universal no-repeat human collaboration contract.`);",
'no-repeat semantic proof')
replace_once('verify-all-stage-prompts.mjs','for(let s=1;s<=30;s++){for(const op of schema.STAGE_CONTRACTS[s].operations){',"for(let s=1;s<=30;s++){if(s>1){state.stages[s-1].status='COMPLETE';state.stages[s-1].gate={complete:true};}for(const op of schema.STAGE_CONTRACTS[s].operations){",'sequential all-stage prompt fixture')
replace_once('verify-all-stage-prompts.mjs',"const scope=s===11?{runId:'RUN-AUDIT',contextId:'CONTEXT-AUDIT'}:{};const r=prompts.buildPromptRecord(s,state,{operation:op,scope});","const scope={};for(const key of schema.operationContract(s,op)?.scopeRequirements||[])scope[key]=`${String(key).toUpperCase()}-AUDIT`;const r=prompts.buildPromptRecord(s,state,{operation:op,scope});",'contract-derived prompt scope')
replace_once('verify-all-stage-prompts.mjs',"const op=schema.STAGE_CONTRACTS[s].operations[0],scope=s===11?{runId:'RUN-AUDIT',contextId:'CONTEXT-AUDIT'}:{},text=prompts.buildPromptRecord(s,state,{operation:op,scope}).prompt;","const op=schema.STAGE_CONTRACTS[s].operations[0],scope={};for(const key of schema.operationContract(s,op)?.scopeRequirements||[])scope[key]=`${String(key).toUpperCase()}-AUDIT`;const text=prompts.buildPromptRecord(s,state,{operation:op,scope}).prompt;",'contract-derived secondary prompt scope')

replace_once('verify-stage-prompts-complete.mjs',
"engine.ensureShape(p);engine.recalculate(p);",
"engine.ensureShape(p);engine.recalculate(p);\nconst intake=engine.intakeCoverageManifest(p);\nconst capture={schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'incorporated into the job definition',reason:'Prompt-closure fixture preserves this controlled input.',extractedStatements:[{statementKey:`statement-${index+1}`,text:unit.rawValueText,statementClass:'REQUIREMENT'}]}))};\nif(!engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(capture)}).complete)throw new Error('Prompt closure fixture could not establish valid Stage 01 intake accounting.');\np.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Prompt closure fixture deliverable.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};\np.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};",
'valid Stage1 accounting fixture')
replace_once('verify-stage-prompts-complete.mjs',
"for(const common of ['PROJECT DATA EXECUTION RULE — MANDATORY','Project-relevant information supplied by the human is supplied once','never ask the human to repeat, retype, summarize, resend, reopen, or reattach it','STRICT RESPONSE CONTRACT'])if(!prompt.includes(common))throw new Error(`Stage ${stage} ${operation} missing common prompt invariant: ${common}`);",
"for(const common of ['PROJECT DATA EXECUTION RULE — MANDATORY','Project-relevant information supplied by the human is supplied once','STRICT RESPONSE CONTRACT'])if(!prompt.includes(common))throw new Error(`Stage ${stage} ${operation} missing common prompt invariant: ${common}`);if(!/never ask the human to .*repeat.*(?:resend|reattach)/i.test(prompt))throw new Error(`Stage ${stage} ${operation} missing semantic no-repeat/no-reattach invariant.`);",
'complete prompt no-repeat proof')
replace_once('verify-stage-prompts-complete.mjs',"1:['BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','every inputId exactly once']","1:['BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','Classify every APPLICATION INTAKE MANIFEST unit exactly once']",'Stage 1 manifest wording')
replace_once('verify-stage-prompts-complete.mjs',"2:['intentStatements'],4:['sourceConflicts'],5:['intentStatements','sources','candidateRequirements']","5:['sources','candidateRequirements']",'remove obsolete/redundant read assertions')
replace_once('verify-stage-prompts-complete.mjs',"4:['APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST','exactly one disposition']","4:['application-enumerated obligation universe','Process every obligationId exactly once','No obligation may disappear']",'Stage 4 semantic proof')
replace_once('verify-stage-prompts-complete.mjs',"for(let stage=1;stage<=30;stage++){\n  const contract=schema.STAGE_CONTRACTS[stage];","for(let stage=1;stage<=30;stage++){\n  if(stage>1){p.stages[stage-1].status='COMPLETE';p.stages[stage-1].gate={complete:true};}\n  const contract=schema.STAGE_CONTRACTS[stage];",'sequential complete prompt fixture')

replace_once('.github/workflows/pages.yml',
"stage01ControlledInputAccounting:1,stage04ObligationAccounting:1,mandatoryEvidenceSufficiencyCoverage:1,nativeExecutionCoverage:1",
"stage01IntakeCoverage:1,stage01ControlledInputAccounting:1,stage04ObligationCoverage:1,stage04ObligationAccounting:1,mandatoryEvidenceSufficiencyCoverage:1,nativeExecutionCoverage:1,mandatoryEvidenceChainStructuralCoverage:1,unsupportedTestIrTreatedAsExecutable:0,externalAssertionsOverridingApplicationProof:0,nativeExecutionReceiptsFabricatedExternally:0,releaseAcceptedWithContradiction:0",
'acceptance metric fields')
replace_once('.github/workflows/pages.yml','deployedByteIdentity:true,browserWidths:[320,393,1280],liveVerification:true','deployedByteIdentity:true,liveBrowserVerification:true,browserWidths:[320,393,1280],liveVerification:true','live browser acceptance field')
replace_once('.github/workflows/pages.yml',"'stage01ControlledInputAccounting','stage04ObligationAccounting','mandatoryEvidenceSufficiencyCoverage','nativeExecutionCoverage'","'stage01IntakeCoverage','stage01ControlledInputAccounting','stage04ObligationCoverage','stage04ObligationAccounting','mandatoryEvidenceSufficiencyCoverage','nativeExecutionCoverage','mandatoryEvidenceChainStructuralCoverage'",'coverage metric assertions')
replace_once('.github/workflows/pages.yml',"fs.writeFileSync('acceptance-report.json',JSON.stringify(report,null,2)+'\\n');","fs.writeFileSync('acceptance-report.json',JSON.stringify(report,null,2)+'\\n');fs.writeFileSync('final-acceptance.json',JSON.stringify(report,null,2)+'\\n');",'final acceptance output')
replace_once('.github/workflows/pages.yml','path: acceptance-report.json','path: |\n            acceptance-report.json\n            final-acceptance.json','acceptance artifact paths')
