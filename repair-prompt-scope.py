from pathlib import Path

p=Path('prompt-engine.js'); s=p.read_text()
old="function scopeFor(stage,state,overrides={}){const j=state?.job||{};const value={projectRevision:Number(state?.revision||0),inputVersion:j.CURRENT_INPUT_VERSION||null,sourceSetVersion:j.CURRENT_SOURCE_SET_VERSION||null,requirementsVersion:j.CURRENT_REQUIREMENTS_VERSION||null,testSuiteVersion:j.CURRENT_TEST_SUITE_VERSION||null,instructionVersion:j.CURRENT_INSTRUCTION_VERSION||null,iterationId:j.CURRENT_ITERATION||null,candidateId:state?.projectData?.candidateFreezes?.filter(x=>x?.active!==false&&!x?.invalidatedBy).at(-1)?.id||null,runId:overrides.runId||null,contextId:overrides.contextId||null,baselineId:j.CURRENT_BASELINE_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_BASELINE_ID))?j.CURRENT_BASELINE_ID:null,productId:j.CURRENT_PRODUCT_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_PRODUCT_ID))?j.CURRENT_PRODUCT_ID:null};return value;}"
new="""const scopePlaceholder=value=>['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING'].includes(String(value??'').trim().toUpperCase());
function scopeFor(stage,state,overrides={}){const j=state?.job||{},own=(key,fallback)=>Object.prototype.hasOwnProperty.call(overrides,key)?overrides[key]:fallback,iterationId=own('iterationId',j.CURRENT_ITERATION||null),candidate=state?.projectData?.candidateFreezes?.filter(x=>x?.active!==false&&!x?.invalidatedBy).filter(x=>!iterationId||String(x?.fields?.ITERATION_ID??x?.ITERATION_ID??x?.scope?.iterationId??'')===String(iterationId)).at(-1);return {projectRevision:Number(own('projectRevision',state?.revision||0)),inputVersion:own('inputVersion',j.CURRENT_INPUT_VERSION||null),sourceSetVersion:own('sourceSetVersion',j.CURRENT_SOURCE_SET_VERSION||null),requirementsVersion:own('requirementsVersion',j.CURRENT_REQUIREMENTS_VERSION||null),testSuiteVersion:own('testSuiteVersion',j.CURRENT_TEST_SUITE_VERSION||null),instructionVersion:own('instructionVersion',j.CURRENT_INSTRUCTION_VERSION||null),iterationId,candidateId:own('candidateId',candidate?recordId(candidate,'candidateFreezes'):null),runId:own('runId',null),contextId:own('contextId',null),baselineId:own('baselineId',j.CURRENT_BASELINE_ID&&!scopePlaceholder(j.CURRENT_BASELINE_ID)?j.CURRENT_BASELINE_ID:null),productId:own('productId',j.CURRENT_PRODUCT_ID&&!scopePlaceholder(j.CURRENT_PRODUCT_ID)?j.CURRENT_PRODUCT_ID:null)};}
function assertRequiredPromptScope(stage,operation,scope){const required=schema.operationContract(stage,operation)?.scopeRequirements||[],laneKeys=['runId','contextId'],missing=required.filter(key=>laneKeys.includes(key)&&scopePlaceholder(scope?.[key]));if(missing.length){const error=new Error(`Controlling instruction cannot be created until application execution-lane identity exists for: ${missing.join(', ')}.`);error.code='MISSING_REQUIRED_PROMPT_SCOPE';error.missingScope=missing;throw error;}return scope;}"""
if s.count(old)!=1: raise SystemExit(f'scopeFor anchor mismatch: {s.count(old)}')
s=s.replace(old,new,1)
old2="const opContract=schema.operationContract(stage,operation);const scope=scopeFor(stage,state,options.scope||{}),feedback=recoveryFeedback(state,stage,operation,scope),contextManifest="
new2="const opContract=schema.operationContract(stage,operation);const scope=assertRequiredPromptScope(stage,operation,scopeFor(stage,state,options.scope||{})),feedback=recoveryFeedback(state,stage,operation,scope),contextManifest="
if s.count(old2)!=1: raise SystemExit('build scope anchor mismatch')
s=s.replace(old2,new2,1)
s=s.replace("scopeFor,responseContractDescriptor,responseContract});","scopeFor,assertRequiredPromptScope,responseContractDescriptor,responseContract});",1)
p.write_text(s)

p=Path('response-ingestion.js'); s=p.read_text()
old="if(!object(envelope.scope))issues.push(issue('INVALID_SCOPE','/scope','scope must be an object.'));else{unknownKeys(envelope.scope,RESPONSE_SCOPE_KEYS,'/scope',issues);const expected=currentScope(project,promptRecord);for(const key of RESPONSE_SCOPE_KEYS)if(JSON.stringify(envelope.scope[key]??null)!==JSON.stringify(expected[key]??null))issues.push(issue('STALE_SCOPE',`/scope/${key}`,`Scope ${key} does not match the controlling prompt.`));}"
new="if(!object(envelope.scope))issues.push(issue('INVALID_SCOPE','/scope','scope must be an object.'));else{unknownKeys(envelope.scope,RESPONSE_SCOPE_KEYS,'/scope',issues);const expected=currentScope(project,promptRecord),placeholder=value=>['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING'].includes(String(value??'').trim().toUpperCase()),laneKeys=['runId','contextId'];for(const key of operationContract?.scopeRequirements||[])if(laneKeys.includes(key)){if(placeholder(envelope.scope[key]))issues.push(issue('MISSING_REQUIRED_SCOPE',`/scope/${key}`,`Required execution-lane scope ${key} is missing or unresolved.`));if(placeholder(expected[key]))issues.push(issue('INVALID_CONTROLLING_PROMPT_SCOPE',`/scope/${key}`,`The saved controlling prompt is missing required execution-lane scope ${key}.`));}for(const key of RESPONSE_SCOPE_KEYS)if(JSON.stringify(envelope.scope[key]??null)!==JSON.stringify(expected[key]??null))issues.push(issue('STALE_SCOPE',`/scope/${key}`,`Scope ${key} does not match the controlling prompt.`));}"
if s.count(old)!=1: raise SystemExit(f'ingestion scope anchor mismatch: {s.count(old)}')
s=s.replace(old,new,1); p.write_text(s)

p=Path('app-core.js'); s=p.read_text()
old="function currentStagePrompt(n){const saved=currentPromptRecord(n);if(saved?.prompt)return saved.prompt;const preview=clone(current);preview.revision=Number(current.revision||0)+1;return globalThis.closedLoopPromptEngine.buildPromptRecord(n,preview,promptOptions(n)).prompt;}"
new="function currentStagePrompt(n){const saved=currentPromptRecord(n);if(saved?.prompt)return saved.prompt;const preview=clone(current);preview.revision=Number(current.revision||0)+1;try{return globalThis.closedLoopPromptEngine.buildPromptRecord(n,preview,promptOptions(n)).prompt;}catch(error){if(error?.code==='MISSING_REQUIRED_PROMPT_SCOPE')return `CONTROLLING INSTRUCTION UNAVAILABLE\\n\\n${error.message}\\n\\nReserve/select the exact execution lane shown for this stage, then save or copy the instruction.`;throw error;}}"
if s.count(old)!=1: raise SystemExit('currentStagePrompt anchor mismatch')
s=s.replace(old,new,1)
old="async function prepareStageResponse(){\n  const n=current.activeStage,text=$('#stage-output')?.value||'',prompt=await savePromptRecord(n);let captured;"
new="async function prepareStageResponse(){\n  const n=current.activeStage,text=$('#stage-output')?.value||'';let prompt;try{prompt=await savePromptRecord(n);}catch(error){alert(error.message||error);return;}let captured;"
if s.count(old)!=1: raise SystemExit('prepareStageResponse anchor mismatch')
s=s.replace(old,new,1)
old="if($('#save-prompt'))$('#save-prompt').onclick=async()=>{await savePromptRecord(current.activeStage);announce('instruction saved');render();};if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{const record=await savePromptRecord(current.activeStage);try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard API unavailable.');await navigator.clipboard.writeText(record.prompt);announce('instruction saved and copied');}catch(error){console.error(error);announce('instruction saved; clipboard copy failed');}};"
new="if($('#save-prompt'))$('#save-prompt').onclick=async()=>{try{await savePromptRecord(current.activeStage);announce('instruction saved');render();}catch(error){alert(error.message||error);}};if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{let record;try{record=await savePromptRecord(current.activeStage);}catch(error){alert(error.message||error);return;}try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard API unavailable.');await navigator.clipboard.writeText(record.prompt);announce('instruction saved and copied');}catch(error){console.error(error);announce('instruction saved; clipboard copy failed');}};"
if s.count(old)!=1: raise SystemExit('prompt button anchor mismatch')
s=s.replace(old,new,1); p.write_text(s)

p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
test="""
// Execution-lane scope must fail closed before a controlling run prompt can exist.
{
 const p=baseProject();let failure=null;try{prompts.buildPromptRecord(11,p,{operation:'COMPLETE',scope:{iterationId:'ITERATION-X',candidateId:'CANDIDATE-X'}});}catch(error){failure=error;}
 if(failure?.code!=='MISSING_REQUIRED_PROMPT_SCOPE'||!failure.missingScope?.includes('runId')||!failure.missingScope?.includes('contextId'))throw new Error('A controlling run prompt was created without its required run/context scope.');
 const scope=prompts.scopeFor(21,p,{iterationId:'ITERATION-OVERRIDE',candidateId:'CANDIDATE-OVERRIDE',baselineId:'BASELINE-OVERRIDE',productId:'PRODUCT-OVERRIDE'});
 for(const [key,value] of Object.entries({iterationId:'ITERATION-OVERRIDE',candidateId:'CANDIDATE-OVERRIDE',baselineId:'BASELINE-OVERRIDE',productId:'PRODUCT-OVERRIDE'}))if(scope[key]!==value)throw new Error(`Explicit application scope override was ignored for ${key}.`);
}
"""
if 'A controlling run prompt was created without its required run/context scope.' not in s:s+='\n'+test
p.write_text(s)

Path('repair-prompt-scope.py').unlink(missing_ok=True)
Path('.github/workflows/fail-closed-prompt-scope.yml').unlink(missing_ok=True)
