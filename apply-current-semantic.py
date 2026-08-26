from pathlib import Path
import re


def replace_once(path, old, new, label):
    p=Path(path); s=p.read_text(); count=s.count(old)
    if count!=1: raise SystemExit(f'{label}: expected one anchor, found {count}')
    p.write_text(s.replace(old,new,1))

# Share one exact operation/scope comparator from the workflow engine.
replace_once('workflow-engine.js',
"function samePromptTarget(a,b){return Number(a?.stage)===Number(b?.stage)&&String(a?.operation||'COMPLETE')===String(b?.operation||'COMPLETE')&&['iterationId','candidateId','runId','contextId','baselineId','productId'].every(key=>String(a?.scope?.[key]??'')===String(b?.scope?.[key]??''));}",
"const PROMPT_TARGET_SCOPE_KEYS=Object.freeze(['iterationId','candidateId','runId','contextId','baselineId','productId']);\nfunction samePromptTarget(a,b,scopeKeys=PROMPT_TARGET_SCOPE_KEYS){return Number(a?.stage)===Number(b?.stage)&&String(a?.operation||'COMPLETE')===String(b?.operation||'COMPLETE')&&safe(scopeKeys).every(key=>String(a?.scope?.[key]??'')===String(b?.scope?.[key]??''));}",
'workflow target comparator')
replace_once('workflow-engine.js',
"version:'closed-loop-workflow-engine/1',STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,",
"version:'closed-loop-workflow-engine/1',PROMPT_TARGET_SCOPE_KEYS,samePromptTarget,STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,",
'workflow target comparator export')

# Bind operator proposal/validation/accept/reject/refinement controls to the selected lane.
p=Path('app-core.js'); s=p.read_text()
anchor="function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}\n"
helpers="""function operatorTarget(item){return {stage:Number(item?.stage),operation:item?.envelope?.operation||item?.operation||'COMPLETE',scope:item?.envelope?.scope||item?.scope||{}};}
function currentOperatorTarget(n){const operation=selectedOperation(n),scope=globalThis.closedLoopPromptEngine.scopeFor(n,current,promptOptions(n).scope||{});return {stage:Number(n),operation,scope};}
function operatorLaneMatches(item,n){if(item?.invalidatedBy)return false;const expected=currentOperatorTarget(n),keys=(schema.operationContract(n,expected.operation)?.scopeRequirements||[]).filter(key=>key!=='projectRevision');return engine.samePromptTarget(operatorTarget(item),expected,keys);}
function validationLaneRecord(validation){return safe(current.projectData.generatedPrompts).find(x=>(x.instructionId||x.promptId)===validation?.promptId)||validation;}
function acceptedLaneChanges(n){return engine.acceptedChanges(current,n).filter(x=>operatorLaneMatches(x,n));}
"""
if 'function operatorLaneMatches(item,n)' not in s:
    if s.count(anchor)!=1: raise SystemExit('operator helper anchor mismatch')
    s=s.replace(anchor,anchor+helpers,1)
repls=[
("function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n).at(-1);if(!v||v.valid)return '';","function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n&&!x.valid&&operatorLaneMatches(validationLaneRecord(x),n)).at(-1);if(!v)return '';"),
("function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===n&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);","function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);"),
("${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?`<details class=\"record-card\"><summary>Refine accepted result<span>Controlled</span></summary>","${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?`<details class=\"record-card\"><summary>Refine accepted result<span>Controlled</span></summary>"),
("function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===current.activeStage&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);}","function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage)).at(-1);}")]
for old,new in repls:
    if old in s: s=s.replace(old,new,1)
pattern=re.compile(r"const next=clone\(current\),stage=current\.activeStage,changes=engine\.acceptedChanges\(next,stage\),operation=selectedOperation\(stage\),scope=promptOptions\(stage\)\?\.scope\|\|\{\},targetKeys=\['iterationId','candidateId','runId','contextId','baselineId','productId'\],matches=changes\.filter\(change=>String\(change\.operation\|\|'COMPLETE'\)===String\(operation\)&&targetKeys\.every\(key=>scope\[key\]===undefined\|\|scope\[key\]===null\|\|scope\[key\]===''\|\|String\(change\.scope\?\.\[key\]\?\?''\)===String\(scope\[key\]\)\)\),change=matches\.at\(-1\)\|\|\(\(changes\.length===1\)\?changes\[0\]:null\);")
s,count=pattern.subn("const next=clone(current),stage=current.activeStage,change=acceptedLaneChanges(stage).at(-1);",s,count=1)
if count not in (0,1): raise SystemExit('refinement lane replacement mismatch')
for required in ['function operatorLaneMatches(item,n)',"filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n))","filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage))",'operatorLaneMatches(validationLaneRecord(x),n)','acceptedLaneChanges(n).length']:
    if required not in s: raise SystemExit(f'operator lane closure missing {required}')
p.write_text(s)

# Prompt context must contain only applicable blockers and exact operation/version/target recovery records.
p=Path('prompt-engine.js'); s=p.read_text()
replace_old="const hash=globalThis.closedLoopHash;\nif(!core||!schema||!hash)throw new Error('workbook.js, hash.js, and workflow-schema.js must load before prompt-engine.js.');"
replace_new="const hash=globalThis.closedLoopHash;\nconst engine=globalThis.closedLoopWorkflowEngine;\nif(!core||!schema||!hash||!engine)throw new Error('workbook.js, hash.js, workflow-schema.js, and workflow-engine.js must load before prompt-engine.js.');"
if replace_old in s: s=s.replace(replace_old,replace_new,1)
pattern=re.compile(r"const samePromptScope=.*?return \{corrections,acceptedRefinements,validationFailures\};\n\}",re.S)
new_block="""function promptTarget(state,item){
 if(!item)return null;
 const generated=state?.projectData?.generatedPrompts||[],promptId=item?.promptId||item?.instructionId,prompt=promptId?generated.find(x=>(x.instructionId||x.promptId)===promptId):null;
 if(prompt)return {stage:Number(prompt.stage),operation:prompt.operation||schema.STAGE_CONTRACTS[Number(prompt.stage)]?.operations?.[0]||'COMPLETE',scope:prompt.scope||{}};
 const proposals=state?.projectData?.responseProposals||[],proposal=item?.proposalId?proposals.find(x=>x.proposalId===item.proposalId):(item?.rawResponseId?proposals.find(x=>x.rawResponseId===item.rawResponseId):null);
 if(proposal)return {stage:Number(proposal.stage),operation:proposal.envelope?.operation||proposal.operation||'COMPLETE',scope:proposal.envelope?.scope||proposal.scope||{}};
 const change=item?.rawResponseId?(state?.projectData?.acceptedChanges||[]).find(x=>x.rawResponseId===item.rawResponseId):null;
 if(change)return {stage:Number(change.stage),operation:change.operation||'COMPLETE',scope:change.scope||{}};
 if(item?.operation&&item?.scope)return {stage:Number(item.stage),operation:item.operation,scope:item.scope};
 return null;
}
function promptTargetMatches(state,item,stage,operation,scope,{versioned=true,inputVersion=null}={}){const actual=promptTarget(state,item);if(!actual)return false;const normalized=inputVersion?{...actual,scope:{...actual.scope,inputVersion}}:actual,keys=versioned?(schema.operationContract(stage,operation)?.scopeRequirements||[]).filter(key=>key!=='projectRevision'):engine.PROMPT_TARGET_SCOPE_KEYS;return engine.samePromptTarget(normalized,{stage,operation,scope},keys);}
function recoveryFeedback(state,stage,operation,scope={}){
 const lane=x=>promptTargetMatches(state,x,stage,operation,scope,{versioned:true});
 const history=state?.projectData?.history||[];
 const accepted=(state?.projectData?.acceptedChanges||[]).filter(x=>lane(x)&&x.status==='COMMITTED'&&x.responseType==='DATA_PROPOSAL').at(-1);
 const cutoff=Number(accepted?.eventSequence||0);
 const eventAfter=(field,id)=>!cutoff||history.some(event=>String(event?.[field]||'')===String(id||'')&&Number(event?.eventSequence||0)>cutoff);
 const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>lane(x)&&x.requestCorrection&&!x.invalidatedBy&&eventAfter('rejectedResponseId',x.rejectedResponseId)).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));
 const acceptedRefinements=history.filter(x=>lane(x)&&x.type==='ACCEPTED_RESPONSE_INVALIDATED'&&(!cutoff||Number(x.eventSequence||0)>cutoff)).map(x=>({eventId:x.eventId,reason:x.reason,rawResponseId:x.rawResponseId,promptId:x.promptId}));
 const validationFailures=(state?.projectData?.responseValidations||[]).filter(x=>Number(x.stage)===stage&&!x.valid&&eventAfter('validationId',x.validationId)&&lane(x)).slice(-1).map(x=>({validationId:x.validationId,issues:(x.issues||[]).map(i=>({code:i.code,path:i.path,message:i.message}))}));
 return {corrections,acceptedRefinements,validationFailures};
}"""
s,count=pattern.subn(new_block,s,count=1)
if count!=1: raise SystemExit(f'prompt recovery block mismatch: {count}')
old=" const open=(state?.projectData?.blockers||[]).filter(x=>!x.invalidatedBy&&!['CLOSED','RESOLVED','RETIRED'].includes(String(x?.fields?.STATUS||x?.STATUS||x?.status||'OPEN').toUpperCase()));if(open.length)parts.push(`APPLICABLE OPEN BLOCKERS\\n${show(open)}`);\n const questions=(state?.projectData?.humanInputRequests||[]).filter(x=>Number(x.stage)===stage&&String(x.status||'OPEN').toUpperCase()==='OPEN'&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope)));if(questions.length)parts.push(`UNRESOLVED HUMAN INPUT REQUESTS\\n${show(questions)}`);\n const answered=(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage&&(!x.operation||x.operation===operation)&&(!x.scope||samePromptScope(x.scope,scope))).map(x=>({questionId:x.requestId,question:x.question,answer:x.answer,answerType:x.answerType||'UNKNOWN',inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||'UNKNOWN',operatorLabel:x.operatorLabel||x.operator||'UNSPECIFIED',affectedStageFields:x.affectedStageFields||[],affectedRecords:x.affectedRecords||[]}));if(answered.length)parts.push(`ANSWERED HUMAN CLARIFICATIONS\\n${show(answered)}`);"
new=" const open=engine.openBlockers(state,stage);if(open.length)parts.push(`APPLICABLE OPEN BLOCKERS\\n${show(open)}`);\n const questions=(state?.projectData?.humanInputRequests||[]).filter(x=>String(x.status||'OPEN').toUpperCase()==='OPEN'&&promptTargetMatches(state,x,stage,operation,scope,{versioned:true}));if(questions.length)parts.push(`UNRESOLVED HUMAN INPUT REQUESTS\\n${show(questions)}`);\n const answered=(state?.projectData?.humanInputAnswers||[]).filter(x=>promptTargetMatches(state,x,stage,operation,scope,{versioned:true,inputVersion:x.inputVersion||null})).map(x=>({questionId:x.requestId,question:x.question,answer:x.answer,answerType:x.answerType||'UNKNOWN',inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||'UNKNOWN',operatorLabel:x.operatorLabel||x.operator||'UNSPECIFIED',affectedStageFields:x.affectedStageFields||[],affectedRecords:x.affectedRecords||[]}));if(answered.length)parts.push(`ANSWERED HUMAN CLARIFICATIONS\\n${show(answered)}`);"
if s.count(old)!=1: raise SystemExit('context blocker/question anchor mismatch')
s=s.replace(old,new,1)
manifest_pattern=re.compile(r" const opContract=schema\.operationContract\(stage,operation\);const scope=assertRequiredPromptScope\(stage,operation,scopeFor\(stage,state,options\.scope\|\|\{\}\)\),feedback=recoveryFeedback\(state,stage,operation,scope\),contextManifest=\{.*?latestValidationFailure:feedback\.validationFailures\};",re.S)
manifest_new=""" const opContract=schema.operationContract(stage,operation);const scope=assertRequiredPromptScope(stage,operation,scopeFor(stage,state,options.scope||{})),feedback=recoveryFeedback(state,stage,operation,scope),manifestBlockers=engine.openBlockers(state,stage),manifestQuestions=(state?.projectData?.humanInputRequests||[]).filter(x=>String(x.status||'OPEN').toUpperCase()==='OPEN'&&promptTargetMatches(state,x,stage,operation,scope,{versioned:true})),manifestAnswers=(state?.projectData?.humanInputAnswers||[]).filter(x=>promptTargetMatches(state,x,stage,operation,scope,{versioned:true,inputVersion:x.inputVersion||null})),contextManifest={stage,operation,scope,readCollections:Object.fromEntries((opContract?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]).map(collection=>[collection,selectedContextRecords(state,collection,scope).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(record.fields||record)}))])),applicableBlockers:manifestBlockers.map(record=>({id:recordId(record,'blockers'),recordSha256:record.recordSha256||record.sha256||hash.sha256Value(record.fields||record)})),unresolvedHumanInputRequests:manifestQuestions.map(x=>({requestId:x.requestId,promptId:x.promptId,scope:x.scope||{}})),answeredHumanClarifications:manifestAnswers.map(x=>({requestId:x.requestId,answerId:x.answerId,inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||null})),operatorCorrectionRequests:feedback.corrections,acceptedResultRefinements:feedback.acceptedRefinements,latestValidationFailure:feedback.validationFailures};"""
s,count=manifest_pattern.subn(manifest_new,s,count=1)
if count!=1: raise SystemExit(f'context manifest anchor mismatch: {count}')
p.write_text(s)

# Enforce the effective stage contract text limit instead of a hard-coded duplicate constant.
p=Path('response-ingestion.js'); s=p.read_text()
s=s.replace("function validateValue(definition,value,path,issues,{required=false}={})","function validateValue(definition,value,path,issues,{required=false,maxTextFieldLength=schema.DEFAULT_RESOURCE_LIMITS.maxTextFieldLength}={})",1)
s=s.replace("typeof value==='string'&&value.length>200000","typeof value==='string'&&value.length>Number(maxTextFieldLength||schema.DEFAULT_RESOURCE_LIMITS.maxTextFieldLength)",1)
old="  const contract=schema.STAGE_CONTRACTS[stageNumber];\n"
new="  const contract=schema.STAGE_CONTRACTS[stageNumber];\n  const valueLimits={maxTextFieldLength:contract?.resourceLimits?.maxTextFieldLength??schema.DEFAULT_RESOURCE_LIMITS.maxTextFieldLength};\n"
if s.count(old)!=1: raise SystemExit('value limit contract anchor mismatch')
s=s.replace(old,new,1)
s=s.replace("validateValue(definition,value,path,issues);","validateValue(definition,value,path,issues,valueLimits);",1)
s=s.replace("validateValue(fieldDefinition,value,fieldPath,issues,{required:definition.required.includes(name)});","validateValue(fieldDefinition,value,fieldPath,issues,{required:definition.required.includes(name),maxTextFieldLength:valueLimits.maxTextFieldLength});",1)
p.write_text(s)

# Dynamic and semantic proof for exact prompt/operator lanes and blocker isolation.
p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
if 'UNRELATED-BLOCKER-MUST-NOT-LEAK' not in s:
    s += r'''

// Applicable blocker and recovery context are exact to the current stage/operation/version/target.
{
 const p=baseProject();
 p.projectData.blockers.push({id:'BLOCKER-STAGE-2',stage:2,active:true,fields:{BLOCKER_ID:'BLOCKER-STAGE-2',STATUS:'OPEN',DOWNSTREAM_WORK_STOPPED:'STAGE 02',MISSING_ITEM_TYPE:'MISSING_EVIDENCE',MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE:'STAGE2-ONLY',WHY_WORK_CANNOT_CONTINUE:'STAGE2-ONLY'}});
 p.projectData.blockers.push({id:'UNRELATED-BLOCKER-MUST-NOT-LEAK',stage:24,active:true,fields:{BLOCKER_ID:'UNRELATED-BLOCKER-MUST-NOT-LEAK',STATUS:'OPEN',DOWNSTREAM_WORK_STOPPED:'STAGE 24',MISSING_ITEM_TYPE:'MISSING_EVIDENCE',MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE:'UNRELATED',WHY_WORK_CANNOT_CONTINUE:'UNRELATED'}});
 const r=prompts.buildPromptRecord(2,p,{operation:'COMPLETE'});if(!r.prompt.includes('BLOCKER-STAGE-2')||r.prompt.includes('UNRELATED-BLOCKER-MUST-NOT-LEAK'))throw new Error('Prompt blocker context is not stage-applicable.');if(!r.contextManifest.applicableBlockers?.some(x=>x.id==='BLOCKER-STAGE-2')||r.contextManifest.applicableBlockers.some(x=>x.id==='UNRELATED-BLOCKER-MUST-NOT-LEAK'))throw new Error('Prompt context signature manifest does not bind the exact applicable blocker set.');
}
{
 const p=baseProject(),scope1={iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-ONE',contextId:'CONTEXT-ONE'},scope2={iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-TWO',contextId:'CONTEXT-TWO'},one=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:scope1}),two=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:scope2});p.projectData.generatedPrompts.push(one,two);p.projectData.rejectedResponses.push({rejectedResponseId:'REJECT-ONE',stage:17,promptId:one.instructionId,rawResponseId:'RAW-ONE',requestCorrection:true,reason:'RUN-ONE-CORRECTION'});p.projectData.rejectedResponses.push({rejectedResponseId:'REJECT-TWO',stage:17,promptId:two.instructionId,rawResponseId:'RAW-TWO',requestCorrection:true,reason:'RUN-TWO-MUST-NOT-LEAK'});p.projectData.rejectedResponses.push({rejectedResponseId:'REJECT-UNTARGETED',stage:17,rawResponseId:'RAW-UNTARGETED',requestCorrection:true,reason:'UNTARGETED-MUST-NOT-LEAK'});const r=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:scope1});if(!r.prompt.includes('RUN-ONE-CORRECTION')||r.prompt.includes('RUN-TWO-MUST-NOT-LEAK')||r.prompt.includes('UNTARGETED-MUST-NOT-LEAK'))throw new Error('Recovery feedback crossed operation/run target boundaries or accepted unresolvable targeting.');
}
{
 const p=baseProject(),scope={iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-VERSION',contextId:'CONTEXT-VERSION'},old=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope});p.projectData.generatedPrompts.push(old);p.projectData.rejectedResponses.push({rejectedResponseId:'REJECT-OLD-VERSION',stage:17,promptId:old.instructionId,rawResponseId:'RAW-OLD-VERSION',requestCorrection:true,reason:'OLD-REQUIREMENTS-MUST-NOT-LEAK'});p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v002';const current=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope});if(current.prompt.includes('OLD-REQUIREMENTS-MUST-NOT-LEAK'))throw new Error('Recovery feedback from an obsolete upstream requirements version leaked into the current prompt.');
}
'''
p.write_text(s)

p=Path('verify-complete.mjs'); s=p.read_text()
if 'Exact operator target matcher accepted a different run lane.' not in s:
    s += r'''

// Operator review target matching is executable and fails closed across operation/run/version boundaries.
{
 const keys=['inputVersion','requirementsVersion','iterationId','candidateId','runId','contextId'],base={stage:17,operation:'EXECUTE_RUN',scope:{inputVersion:'INPUT-v001',requirementsVersion:'REQUIREMENTS-v001',iterationId:'ITERATION-1',candidateId:'CANDIDATE-1',runId:'RUN-1',contextId:'CONTEXT-1'}},same=structuredClone(base),otherRun=structuredClone(base),otherVersion=structuredClone(base),missingRun=structuredClone(base);otherRun.scope.runId='RUN-2';otherVersion.scope.requirementsVersion='REQUIREMENTS-v002';delete missingRun.scope.runId;assert(engine.samePromptTarget(base,same,keys),'Exact operator target matcher rejected the same lane.');assert(!engine.samePromptTarget(base,otherRun,keys),'Exact operator target matcher accepted a different run lane.');assert(!engine.samePromptTarget(base,otherVersion,keys),'Exact operator target matcher accepted a stale requirements version.');assert(!engine.samePromptTarget(base,missingRun,keys),'Exact operator target matcher treated missing scope as a wildcard.');
 const appSource=fs.readFileSync('app-core.js','utf8');assert(appSource.includes('engine.samePromptTarget(operatorTarget(item),expected,keys)'),'Operator UI is not using the executable exact target matcher.');
}
'''
p.write_text(s)

p=Path('verify-ingestion.mjs'); s=p.read_text()
marker="console.log(JSON.stringify({persistedPromptAuthority:true,readableClarificationTargets:true,humanInputResponseExclusivity:true,choiceContractValidation:true,humanAnswerEdgeValidation:true,totalNegativeCases:negativeCount},null,2));"
check="""{\n  const issues=[];\n  ingestion.validateValue({valueType:'STRING',nullable:false,enumValues:[]},'12345','/contract-limit',issues,{maxTextFieldLength:4});\n  if(!issues.some(x=>x.code==='TEXT_FIELD_TOO_LARGE'))throw new Error('Effective contract text-field limit is not enforced.');\n}\n"""
if 'Effective contract text-field limit is not enforced.' not in s:
    if s.count(marker)!=1: raise SystemExit('verify-ingestion output marker mismatch')
    s=s.replace(marker,check+marker,1)
p.write_text(s)

print('current semantic/operator closure applied')
