from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')

def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

def replace_exact(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old,new,1)

# Restore the prompt preview geometry to the current-main visual baseline.
p='index.html'; s=read(p)
s=replace_exact(s,'.expandable-prompt{max-height:80vh}', '.expandable-prompt{max-height:280px}', 'prompt preview visual baseline')
write(p,s)

# NEXT_REQUIRED_ACTION is an application-owned structured action, not prose.
p='workflow-schema.js'; s=read(p)
old="if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`});"
new="if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`,valueType:name==='NEXT_REQUIRED_ACTION'?'OBJECT':'STRING',closedProperties:name==='NEXT_REQUIRED_ACTION'?['actionType','heading','explanation','primaryButton','secondaryAction','filesToSend','filesToWithhold','expectedReturnFiles','blockingReason','canonicalStateChanged','newPromptRequired']:null});"
s=replace_exact(s,old,new,'structured NEXT_REQUIRED_ACTION schema')
write(p,s)

# Make the Stage 04 instruction explicitly consume the full application-generated obligation universe.
p='prompt-engine.js'; s=read(p)
pattern=r"4:'Compile atomic requirement proposals only from .*?Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior\.',"
replacement="4:'Compile the requirement specification from the APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST supplied in this controlling prompt. That manifest is the complete application-enumerated obligation universe for this stage and is built before you act from the current User Job Input, the accepted Stage 01 job definition, all human-origin obligations captured from supplied project material, accepted Stage 03 source research, candidate external-source obligations, and applicable source identities and evidence. Do not rediscover or narrow that input universe. The original Stage 01 intent file is prohibited downstream input: never request it, attach it, resend it, retype it, summarize it, reopen it, or rely on an earlier conversation that contains it. If project-relevant information was supplied earlier, use the canonical statement/obligation presented here; do not ask the human to repeat it. If required prior-stage information is absent from the application-provided manifest, return BLOCKED with the missing application context and responsible earlier stage rather than turning an application capture defect into another user request. For every obligationId in the manifest, produce one or more atomic requirements, or explicitly classify it as retained nonnormative context, inapplicable with reason, or blocked with reason. No obligationId may disappear. One obligation may map to multiple requirements. Multiple obligations may map to one requirement only when materially equivalent and no semantic distinction, normative force, condition, exception, dependency, prohibition, definition, or acceptance criterion is lost. Put every exact originating obligationId in OBLIGATION_TRACE. Preserve human-origin traceability independently from external SOURCE_ID provenance. Each proposed requirement must be independently testable where possible and state requirement type, mandatory/optional status, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, and notes. The application owns input-set selection, stable identities, provenance preservation, mapping completeness, canonical REQ_ID allocation, versions, hashes, counts, current scope, and stale rejection; you own semantic interpretation, compound-obligation separation, atomic formulation, defined-term detection, dependencies, applicability reasoning, success/failure semantics, verification semantics, and semantic duplicate determination. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.',"
s2,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'Stage 04 procedure replacement count={n}')
s=s2
write(p,s)

# Replace free-form next-action prose with the required structured action object.
p='workflow-engine.js'; s=read(p)
pattern=r"function operationalNextAction\(project,currentStage\)\{.*?\n\nfunction applicationTestCapabilities\(\)"
replacement=r'''const NEXT_ACTION_TYPES=Object.freeze(['RUN_APP_TESTS','AI_REVIEW','EXTERNAL_AGENT_TOOL','HUMAN_INSPECTION','EXTERNAL_SYSTEM','ATTACH_REQUIRED_FILES','CONTINUE_AGENT_CONVERSATION','PASTE_FINAL_JSON','REVIEW_PROPOSAL','BLOCKED','COMPLETE']);
function nextAction({actionType,heading,explanation,primaryButton='',secondaryAction='',filesToSend=[],filesToWithhold=[],expectedReturnFiles=[],blockingReason='',canonicalStateChanged=false,newPromptRequired=false}={}){
  if(!NEXT_ACTION_TYPES.includes(actionType))throw new Error('Unknown operational action type: '+actionType);
  return {actionType,heading:String(heading||''),explanation:String(explanation||''),primaryButton:String(primaryButton||''),secondaryAction:String(secondaryAction||''),filesToSend:safe(filesToSend).map(clone),filesToWithhold:safe(filesToWithhold).map(clone),expectedReturnFiles:safe(expectedReturnFiles).map(clone),blockingReason:String(blockingReason||''),canonicalStateChanged:Boolean(canonicalStateChanged),newPromptRequired:Boolean(newPromptRequired)};
}
function operationalNextAction(project,currentStage){
  const stage=Number(currentStage||1),requests=unresolvedHumanRequests(project,stage),prompts=safe(project?.projectData?.generatedPrompts).filter(p=>Number(p.stage)===stage&&!p.invalidatedBy),currentPrompt=prompts.at(-1)||null,pending=safe(project?.projectData?.responseProposals).filter(p=>Number(p.stage)===stage&&!p.invalidatedBy&&upper(p.status||'PENDING')==='PENDING').at(-1);
  if(Object.values(project?.stages||{}).filter(s=>s?.status==='COMPLETE').length===30)return nextAction({actionType:'COMPLETE',heading:'Workflow complete',explanation:'Preserve the completed workflow and exact release evidence.',primaryButton:'Review release evidence'});
  if(pending)return nextAction({actionType:'REVIEW_PROPOSAL',heading:'Review the validated proposal',explanation:'The response has been parsed and validated. Review the proposed canonical changes before acceptance.',primaryButton:'Review proposal',canonicalStateChanged:false,newPromptRequired:false});
  if(requests.length)return nextAction({actionType:'CONTINUE_AGENT_CONVERSATION',heading:'Answer only the unresolved human-authority question'+(requests.length===1?'':'s'),explanation:'Do not repeat information already present in canonical project state. Saving a genuine new human answer versions User Job Input and requires a replacement prompt for this same stage.',primaryButton:'Continue conversation',canonicalStateChanged:false,newPromptRequired:true});
  if(stage===16){const correction=stage16CorrectionPlan(project);if(correction.actionType==='BLOCKED')return nextAction({actionType:'BLOCKED',heading:correction.heading,explanation:correction.explanation,blockingReason:correction.explanation});return nextAction({actionType:'REVIEW_PROPOSAL',heading:correction.heading,explanation:correction.explanation,primaryButton:'Review root-cause correction'});}
  const plan=testExecutionPlan(project),relevant=[12,22,23,24].includes(stage)?plan.items:[],blocked=relevant.find(i=>!i.executableNow);
  if(blocked){const missingFiles=safe(blocked.requiredArtifactIds).map((id,n)=>({artifactId:id,filename:safe(blocked.requiredArtifactNames)[n]||'',reason:blocked.blockingReason||'Required bytes are unavailable.'}));return nextAction({actionType:missingFiles.length?'ATTACH_REQUIRED_FILES':'BLOCKED',heading:missingFiles.length?'Attach the exact required files':'Verification is blocked',explanation:blocked.blockingReason||('The required capability '+(blocked.requiredCapability||'is unavailable')+'.'),primaryButton:missingFiles.length?'Attach required files':'',filesToSend:[],filesToWithhold:safe(blocked.handoff?.withhold),expectedReturnFiles:safe(blocked.handoff?.expectBack),blockingReason:blocked.blockingReason||'',canonicalStateChanged:false,newPromptRequired:false});}
  const item=relevant.find(i=>i.operatorAction!=='NO_ACTION');
  if(item){const common={filesToSend:safe(item.handoff?.send),filesToWithhold:safe(item.handoff?.withhold),expectedReturnFiles:safe(item.handoff?.expectBack),canonicalStateChanged:false,newPromptRequired:false};if(item.operatorAction==='SEND_TO_INDEPENDENT_REVIEWER')return nextAction({...common,actionType:'AI_REVIEW',heading:'Use a fresh independent reviewer',explanation:'Send only the exact authorized verification package. Do not send withheld prior conclusions or generator self-evaluation.',primaryButton:'Prepare reviewer package'});if(item.operatorAction==='SEND_TO_TOOL_AGENT')return nextAction({...common,actionType:'EXTERNAL_AGENT_TOOL',heading:'Use the required tool-capable agent',explanation:'Run the current instruction only in an environment that actually has '+(item.requiredCapability||'the required capability')+' and the listed exact files.',primaryButton:'Prepare execution package'});if(item.operatorAction==='HUMAN_INSPECTION')return nextAction({...common,actionType:'HUMAN_INSPECTION',heading:'Human inspection is required',explanation:'Perform the current inspection and preserve the requested human-owned observation evidence.',primaryButton:'Review inspection instructions'});if(item.operatorAction==='USE_EXTERNAL_SYSTEM')return nextAction({...common,actionType:'EXTERNAL_SYSTEM',heading:'Use the required external system',explanation:'Use '+(item.requiredCapability||'the declared external system')+' and return its attributable result and required evidence.',primaryButton:'Prepare external-system package'});}
  if(relevant.length&&relevant.every(i=>i.operatorAction==='NO_ACTION'))return nextAction({actionType:'RUN_APP_TESTS',heading:'Run application verification',explanation:'No external action is required. The application can execute the current ready deterministic tests against the exact verified artifact bytes.',primaryButton:'Run tests'});
  if(stage===3||stage===4){const explanation=stage===4?'The current Stage 04 instruction already contains the application-generated obligation manifest and captured project intent. Do not attach, resend, retype, summarize, or reopen the original intent file.':'The current Stage 03 instruction consumes canonical Stage 01 intent statements and current accepted source records. Do not reattach the original intent file.';return nextAction({actionType:currentPrompt?'PASTE_FINAL_JSON':'CONTINUE_AGENT_CONVERSATION',heading:stage===4?'Compile requirements from captured project data':'Research the current canonical inputs',explanation,primaryButton:currentPrompt?'Paste final JSON':'Save and use current instruction',newPromptRequired:!currentPrompt});}
  if([23,24].includes(stage)){const reviewer=records(project,'freshContexts').filter(r=>isActiveRecord(r)&&Number(r.stage)===stage).at(-1);if(!reviewer)return nextAction({actionType:'AI_REVIEW',heading:'Open a fresh independent reviewer context',explanation:'Register the fresh context before sending any review material so the application can bind it to the controlling prompt.',primaryButton:'Register reviewer context'});}
  return nextAction({actionType:currentPrompt?'PASTE_FINAL_JSON':'CONTINUE_AGENT_CONVERSATION',heading:currentPrompt?'Return the final structured response':'Use the current stage instruction',explanation:currentPrompt?'The agent should return one final strict JSON response, plus only explicitly required returned files.':'Save or copy the current controlling instruction and perform the stage work in the authorized context.',primaryButton:currentPrompt?'Paste final JSON':'Save and use instruction',newPromptRequired:!currentPrompt});
}

function applicationTestCapabilities()'''
s2,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'operationalNextAction replacement count={n}')
s=s2
# Completed state must also stay structured.
s=s.replace("project.job.NEXT_REQUIRED_ACTION=completed===30?'Preserve the completed workflow and exact release evidence.':operationalNextAction(project,currentStage);","project.job.NEXT_REQUIRED_ACTION=operationalNextAction(project,currentStage);",1)
# Export action types for verification/UI introspection.
s=s.replace("evidenceChainExplanation,stage16CorrectionPlan,operationalNextAction,operationalMetrics,gate", "evidenceChainExplanation,stage16CorrectionPlan,NEXT_ACTION_TYPES,operationalNextAction,operationalMetrics,gate",1)
write(p,s)

# Render the action object without changing layout/CSS.
p='app-core.js'; s=read(p)
anchor="const stageDisplayTitle=d=>Number(d?.number)===16?'CORRECT THE ROOT CAUSE':d?.title||'';"
insert=anchor+"\nconst normalizedNextAction=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{actionType:'BLOCKED',heading:'Next action unavailable',explanation:String(value||'No next action recorded.'),primaryButton:'Continue current stage',secondaryAction:'',filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],blockingReason:'',canonicalStateChanged:false,newPromptRequired:false};\nconst nextActionText=value=>{const a=normalizedNextAction(value);return [a.heading,a.explanation,a.blockingReason?('Blocked: '+a.blockingReason):''].filter(Boolean).join(' — ');};"
s=replace_exact(s,anchor,insert,'app action helpers')
# Overview: use heading/explanation and primary button label, preserving existing panel geometry.
old="<div class=\"panel next-action-panel\"><h2 class=\"section-title\">Next required action</h2><div class=\"notice\">${esc(current.job.NEXT_REQUIRED_ACTION||'No next action recorded.')}</div><div class=\"button-row overview-actions\"><button class=\"primary\" data-stage=\"${currentStage}\">Continue current stage</button></div></div>"
new="<div class=\"panel next-action-panel\"><h2 class=\"section-title\">Next required action</h2><div class=\"notice\"><strong>${esc(normalizedNextAction(current.job.NEXT_REQUIRED_ACTION).heading)}</strong><br>${esc(normalizedNextAction(current.job.NEXT_REQUIRED_ACTION).explanation)}</div><div class=\"button-row overview-actions\"><button class=\"primary\" data-stage=\"${currentStage}\">${esc(normalizedNextAction(current.job.NEXT_REQUIRED_ACTION).primaryButton||'Continue current stage')}</button></div></div>"
s=replace_exact(s,old,new,'overview structured next action')
# Workflow adjacency strip uses readable structured text.
s=s.replace("<span>${esc(current.job.NEXT_REQUIRED_ACTION)}</span>","<span>${esc(nextActionText(current.job.NEXT_REQUIRED_ACTION))}</span>",1)
write(p,s)

# Expand execution package API without weakening byte verification.
p='project-store.js'; s=read(p)
s=s.replace("async function createExecutionPackage({project,stage,testIds=[],productId=null}={}){", "async function createExecutionPackage({project,jobId:requestedJobId=null,stage,operation='COMPLETE',testIds=[],productId=null,runId=null,reviewerAliasContext=null}={}){",1)
s=s.replace("if(!project||typeof project!=='object')throw new Error('A canonical project is required for an execution package.');const engine=globalThis.closedLoopWorkflowEngine,jobId=projectIdentity(project),ids=", "if(!project||typeof project!=='object')throw new Error('A canonical project is required for an execution package.');const engine=globalThis.closedLoopWorkflowEngine,jobId=projectIdentity(project);if(requestedJobId&&String(requestedJobId)!==jobId)throw storageError('Execution-package JOB_ID does not match the canonical project.','EXECUTION_PACKAGE_JOB_MISMATCH');const ids=",1)
s=s.replace("jobId,stage:Number(stage),productId:productId||project.job?.CURRENT_PRODUCT_ID||null,testIds:ids,artifacts:", "jobId,stage:Number(stage),operation:String(operation||'COMPLETE'),productId:productId||project.job?.CURRENT_PRODUCT_ID||null,runId:runId||null,reviewerAliasContext:reviewerAliasContext?clone(reviewerAliasContext):null,testIds:ids,artifacts:",1)
write(p,s)

# Permanent focused regression for the repaired invariants.
write('verify-followup-spec.mjs', r'''import fs from 'node:fs';
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const index=fs.readFileSync('index.html','utf8');
assert(index.includes('.prompt{height:clamp(260px,45vh,520px);max-height:80vh;'),'prompt base geometry changed');
assert(index.includes('.expandable-prompt{max-height:280px}'),'prompt collapsed preview height was not restored to visual baseline');
const schema=fs.readFileSync('workflow-schema.js','utf8');
assert(schema.includes("valueType:name==='NEXT_REQUIRED_ACTION'?'OBJECT':'STRING'"),'NEXT_REQUIRED_ACTION is not structured in schema');
const engine=fs.readFileSync('workflow-engine.js','utf8');
for(const key of ['actionType','heading','explanation','primaryButton','secondaryAction','filesToSend','filesToWithhold','expectedReturnFiles','blockingReason','canonicalStateChanged','newPromptRequired'])assert(engine.includes(key),'structured action missing '+key);
assert(!/function operationalNextAction[\s\S]*?return 'Use the current Stage/.test(engine),'operationalNextAction still returns free-form stage prose');
const prompt=fs.readFileSync('prompt-engine.js','utf8');
assert(prompt.includes('APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST — THIS IS THE COMPLETE INPUT UNIVERSE'),'Stage 04 obligation manifest missing from generated prompt');
assert(prompt.includes('That manifest is the complete application-enumerated obligation universe for this stage'),'Stage 04 procedure does not tell the agent that the manifest is the complete input universe');
assert(prompt.includes('do not ask the human to repeat it'),'Stage 04 procedure does not prohibit repeated human transcription');
const app=fs.readFileSync('app-core.js','utf8');
assert(!app.includes("esc(current.job.NEXT_REQUIRED_ACTION||'No next action recorded.')"),'overview still treats structured action as prose');
const store=fs.readFileSync('project-store.js','utf8');
for(const token of ["operation='COMPLETE'","runId=null","reviewerAliasContext=null"])assert(store.includes(token),'execution package API missing '+token);
console.log('Follow-up controlling-spec regressions passed.');
''')
