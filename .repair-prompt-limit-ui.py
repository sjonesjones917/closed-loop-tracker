from pathlib import Path

p=Path('prompt-engine.js')
s=p.read_text()
old="if(!core||!schema||!hash)throw new Error('workbook.js, hash.js, and workflow-schema.js must load before prompt-engine.js.');\nconst show=v=>"
new="""if(!core||!schema||!hash)throw new Error('workbook.js, hash.js, and workflow-schema.js must load before prompt-engine.js.');
const MAX_CONTROLLING_PROMPT_BYTES=750000;
function assertPromptWithinLimit(prompt){const byteLength=new TextEncoder().encode(String(prompt??'')).byteLength;if(byteLength>MAX_CONTROLLING_PROMPT_BYTES){const error=new Error(`The complete controlling prompt is ${byteLength} bytes and exceeds the application's ${MAX_CONTROLLING_PROMPT_BYTES}-byte safety limit. No context was silently omitted. Reduce the authorized project scope or split the job before generating or using this instruction. This application safety limit does not assert compatibility with any particular external agent context window.`);error.code='PROMPT_CONTEXT_LIMIT';error.byteLength=byteLength;error.limit=MAX_CONTROLLING_PROMPT_BYTES;throw error;}return byteLength;}
const show=v=>"""
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
old="const prompt=bodyText+identityBlock;return {instructionId,promptId:instructionId,stage,operation,role:d.role,bodySha256,sha256:bodySha256,contractSha256,contextSignature,contextManifest,scope,scopeSha256:hash.sha256Value(scope),prompt,fullTextSha256:hash.sha256Text(prompt)};"
new="const prompt=bodyText+identityBlock,promptByteLength=assertPromptWithinLimit(bodyText+identityBlock);return {instructionId,promptId:instructionId,stage,operation,role:d.role,bodySha256,sha256:bodySha256,contractSha256,contextSignature,contextManifest,scope,scopeSha256:hash.sha256Value(scope),prompt,promptByteLength,fullTextSha256:hash.sha256Text(prompt)};"
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
old="globalThis.closedLoopPromptEngine=Object.freeze({version:'closed-loop-prompt-engine/5',build,buildPromptRecord,procedures,contextFor,scopeFor,responseContractDescriptor,responseContract});"
new="globalThis.closedLoopPromptEngine=Object.freeze({version:'closed-loop-prompt-engine/5',MAX_CONTROLLING_PROMPT_BYTES,assertPromptWithinLimit,build,buildPromptRecord,procedures,contextFor,scopeFor,responseContractDescriptor,responseContract});"
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
p.write_text(s)

p=Path('app-core.js')
s=p.read_text()
old="function currentStagePrompt(n){const saved=currentPromptRecord(n);if(saved?.prompt)return saved.prompt;const preview=clone(current);preview.revision=Number(current.revision||0)+1;return globalThis.closedLoopPromptEngine.buildPromptRecord(n,preview,promptOptions(n)).prompt;}"
new="""function promptLimitPreview(error){return `PROMPT GENERATION BLOCKED — ${error.code}\n${error.message}`;}
function currentStagePromptState(n){const saved=currentPromptRecord(n);try{if(saved?.prompt){globalThis.closedLoopPromptEngine.assertPromptWithinLimit(saved.prompt);return {prompt:saved.prompt,error:null};}const preview=clone(current);preview.revision=Number(current.revision||0)+1;return {prompt:globalThis.closedLoopPromptEngine.buildPromptRecord(n,preview,promptOptions(n)).prompt,error:null};}catch(error){if(error?.code==='PROMPT_CONTEXT_LIMIT')return {prompt:promptLimitPreview(error),error};throw error;}}
function currentStagePrompt(n){return currentStagePromptState(n).prompt;}"""
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
old="savedPrompt=currentPromptRecord(n),prompt=savedPrompt?.prompt||currentStagePrompt(n),responseLocked=locked||s.status==='COMPLETE',promptIntro=savedPrompt?'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.':'This is an unsaved preview. Save or copy it before sending it to an agent; only the committed instruction identity is controlling.';"
new="savedPrompt=currentPromptRecord(n),promptState=currentStagePromptState(n),prompt=promptState.prompt,promptLimited=Boolean(promptState.error),responseLocked=locked||s.status==='COMPLETE',promptIntro=promptLimited?'Prompt generation is blocked until the complete controlling context fits within the application safety limit.':savedPrompt?'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.':'This is an unsaved preview. Save or copy it before sending it to an agent; only the committed instruction identity is controlling.';"
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
old='<div class="panel"><h2 class="section-title">Generated instruction</h2><p class="section-intro">${promptIntro}</p><pre class="prompt" id="generated-prompt">${esc(prompt)}</pre><div class="button-row"><button id="save-prompt"${locked?\' disabled\':\'\'}>Save instruction</button><button id="copy-prompt"${locked?\' disabled\':\'\'}>Save and copy instruction</button></div></div>'
new='<div class="panel"><h2 class="section-title">Generated instruction</h2>${promptLimited?`<div class="notice danger"><strong>PROMPT_CONTEXT_LIMIT</strong><br>${esc(promptState.error.message)}</div>`:\'\'}<p class="section-intro">${promptIntro}</p><pre class="prompt" id="generated-prompt">${esc(prompt)}</pre><div class="button-row"><button id="save-prompt"${locked||promptLimited?\' disabled\':\'\'}>Save instruction</button><button id="copy-prompt"${locked||promptLimited?\' disabled\':\'\'}>Save and copy instruction</button></div></div>'
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
old="const existing=currentPromptRecord(n);if(existing)return existing;"
new="const existing=currentPromptRecord(n);if(existing){globalThis.closedLoopPromptEngine.assertPromptWithinLimit(existing.prompt);return existing;}"
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
old="if($('#save-prompt'))$('#save-prompt').onclick=async()=>{await savePromptRecord(current.activeStage);announce('instruction saved');render();};if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{const record=await savePromptRecord(current.activeStage);try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard API unavailable.');await navigator.clipboard.writeText(record.prompt);announce('instruction saved and copied');}catch(error){console.error(error);announce('instruction saved; clipboard copy failed');}};"
new="if($('#save-prompt'))$('#save-prompt').onclick=async()=>{try{await savePromptRecord(current.activeStage);announce('instruction saved');render();}catch(error){console.error(error);announce('instruction generation blocked');alert(error.message||error);}};if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{let record;try{record=await savePromptRecord(current.activeStage);}catch(error){console.error(error);announce('instruction generation blocked');alert(error.message||error);return;}try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard API unavailable.');await navigator.clipboard.writeText(record.prompt);announce('instruction saved and copied');}catch(error){console.error(error);announce('instruction saved; clipboard copy failed');}};"
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
p.write_text(s)

p=Path('verify-prompt-semantics.mjs')
s=p.read_text()
marker="const p=baseProject();\nconst original=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN'"
test="""// The complete copied prompt must fail visibly when legal canonical context exceeds the application safety ceiling; no context may be silently omitted.
{
  const large=baseProject(),largeScope=prompts.scopeFor(3,large,{});
  large.projectData.sources.push({id:'SOURCE-PROMPT-LIMIT',stage:2,active:true,scope:largeScope,fields:{SOURCE_ID:'SOURCE-PROMPT-LIMIT',TITLE:'X'.repeat(760000)},relationships:{},contentSha256:'large-context-fixture'});
  let error=null;try{prompts.buildPromptRecord(3,large);}catch(e){error=e;}
  if(error?.code!=='PROMPT_CONTEXT_LIMIT'||!String(error.message||'').includes('No context was silently omitted')||error.byteLength<=error.limit)throw new Error('Oversized complete controlling prompt did not fail visibly with PROMPT_CONTEXT_LIMIT.');
  let savedError=null;try{prompts.assertPromptWithinLimit('X'.repeat(prompts.MAX_CONTROLLING_PROMPT_BYTES+1));}catch(e){savedError=e;}
  if(savedError?.code!=='PROMPT_CONTEXT_LIMIT')throw new Error('Previously saved oversized prompt would not be rejected by the shared prompt-size assertion.');
}

"""
assert s.count(marker)==1, s.count(marker)
s=s.replace(marker,test+marker,1)
p.write_text(s)

p=Path('verify-browser-extra.mjs')
s=p.read_text()
marker="  assert(cdp.dialogs.length===0,`Unexpected browser dialogs: ${cdp.dialogs.join(' | ')}`);"
test="""  console.log('extra:prompt-context-limit-ui');
  await evalValue(cdp,`(async()=>{const store=closedLoopProjectStore,id=document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0],all=await store.readAll(),p=all.find(x=>x.job?.JOB_ID===id)||all[0];p.job.EXACT_USER_OBJECTIVE_VERBATIM='X'.repeat(760000);p.projectData.userEntered={...(p.projectData.userEntered||{}),objective:p.job.EXACT_USER_OBJECTIVE_VERBATIM};await store.writeProject(p,{expectedProjectRevision:p.revision});location.reload();return true;})()`);await sleep(500);await waitExpr(cdp,`globalThis.closedLoopAppReady===true`,20000);await openStage(cdp,1);await waitExpr(cdp,`document.body.innerText.includes('PROMPT_CONTEXT_LIMIT')`,12000);assert(await evalValue(cdp,`document.querySelector('#generated-prompt')?.innerText.includes('PROMPT GENERATION BLOCKED')`),'Oversized prompt did not render a fail-visible blocked preview.');assert(await evalValue(cdp,`document.querySelector('#save-prompt')?.disabled===true&&document.querySelector('#copy-prompt')?.disabled===true`),'Oversized prompt remained saveable or copyable.');assert(!(await evalValue(cdp,`globalThis.closedLoopAppError`)),'Oversized prompt crashed the application instead of remaining recoverable.');

"""
assert s.count(marker)==1, s.count(marker)
s=s.replace(marker,test+marker,1)
old="transactionMutatorLifetime:true,runtimeErrors:0"
new="transactionMutatorLifetime:true,promptContextLimitUi:true,runtimeErrors:0"
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
p.write_text(s)
