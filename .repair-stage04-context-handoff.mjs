import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const requireContains = (content, needle, label) => {
  if (!content.includes(needle)) throw new Error(`Patch precondition failed for ${label}`);
};
const replaceOnce = (content, needle, replacement, label) => {
  const first = content.indexOf(needle);
  if (first < 0) throw new Error(`Patch target not found: ${label}`);
  if (content.indexOf(needle, first + needle.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return content.slice(0, first) + replacement + content.slice(first + needle.length);
};
const replaceBetween = (content, startNeedle, endNeedle, replacement, label) => {
  const start = content.indexOf(startNeedle);
  if (start < 0) throw new Error(`Patch start not found: ${label}`);
  const end = content.indexOf(endNeedle, start);
  if (end < 0) throw new Error(`Patch end not found: ${label}`);
  if (content.indexOf(startNeedle, start + startNeedle.length) >= 0) throw new Error(`Patch start is not unique: ${label}`);
  return content.slice(0, start) + replacement + content.slice(end);
};

// workflow-engine.js: keep executionHandoff as the single authority, but distinguish
// external-conversation access from optional browser custody.
{
  const path = 'workflow-engine.js';
  let source = read(path);
  const start = 'function executionHandoff(project,{stage=Number(project.activeStage||0),operation=null,testIds=null,runIds=null}={}){';
  const end = 'function evidenceChainExplanation(project,chain){';
  const replacement = `function suppliedMaterialReferences(project){
  const raw=String(project?.job?.SUPPLIED_MATERIALS_INVENTORY||'').trim();
  if(!raw||/^(?:UNKNOWN|NONE|NOT APPLICABLE|NULL|\\[\\]|\\{\\}|NONE SUPPLIED|NO MATERIALS?(?: SUPPLIED)?)$/i.test(raw))return [];
  const references=[],seen=new Set();
  const transferMode=(type,label)=>{
    const declared=upper(type),value=String(label||'').trim();
    if(/MESSAGE|INLINE|TEXT|NOTE|CHAT/.test(declared))return 'INLINE_JOB_INPUT';
    if(/URL|URI|LINK|WEB|REFERENCE/.test(declared)||/^https?:\\/\\//i.test(value))return 'AUTHORIZED_REFERENCE';
    if(/FILE|ATTACH|DOCUMENT|ARCHIVE|FOLDER|DIRECTORY|IMAGE|DRAWING|MODEL|SPREADSHEET|REPOSITORY|PACKAGE/.test(declared)||/\\.[A-Za-z0-9]{1,12}(?:$|[?#])/.test(value))return 'ORIGINAL_ATTACHMENT';
    return 'ORIGINAL_MATERIAL';
  };
  const add=(label,type='SUPPLIED_PROJECT_INPUT')=>{
    const clean=String(label||'').trim();
    if(!clean||/^(?:UNKNOWN|NONE|NOT APPLICABLE)$/i.test(clean))return;
    const key=clean.toLowerCase();
    if(seen.has(key))return;
    seen.add(key);
    references.push({label:clean,type:String(type||'SUPPLIED_PROJECT_INPUT').trim()||'SUPPLIED_PROJECT_INPUT',transferMode:transferMode(type,clean)});
  };
  const walk=(value,depth=0)=>{
    if(depth>4||value===null||value===undefined)return;
    if(Array.isArray(value)){for(const item of value)walk(item,depth+1);return;}
    if(typeof value==='string'){add(value);return;}
    if(typeof value!=='object')return;
    const label=value.exactNameOrReference??value.filename??value.fileName??value.name??value.title??value.reference??value.path??value.url;
    const type=value.type??value.materialType??value.kind??value.role??'SUPPLIED_PROJECT_INPUT';
    if(label!==undefined&&label!==null&&String(label).trim()){add(label,type);return;}
    for(const key of ['files','materials','items','attachments','references','suppliedMaterials','inventory'])if(Object.prototype.hasOwnProperty.call(value,key))walk(value[key],depth+1);
  };
  try{walk(JSON.parse(raw));}
  catch{
    const parts=raw.split(/\\r?\\n|;/).map(value=>value.replace(/^\\s*(?:[-*•]|\\d+[.)])\\s*/,'').trim()).filter(Boolean);
    for(const part of parts.length?parts:[raw])add(part);
  }
  return references;
}
function executionHandoff(project,{stage=Number(project.activeStage||0),operation=null,testIds=null,runIds=null}={}){
  const op=String(operation||'').toUpperCase(),testStages=stage===12||[22,23,24].includes(stage)||(stage===17&&['VERIFY','REGRESSION'].includes(op))||(stage===19&&['VERIFY','REGRESSION_VERIFY'].includes(op)),ids=testIds?new Set(testIds.map(String)):null,items=testStages?testExecutionPlan(project).items.filter(i=>!ids||ids.has(i.testId)):[],send=new Map(),withhold=new Map(),expectBack=new Map(),artifacts=recordsForCurrentScope(project,'artifacts'),artifactsById=new Map(artifacts.map(a=>[recordId(a,'artifacts'),a])),conversationMaterials=[],optionalApplicationCopies=new Map();
  const exactArtifact=a=>{if(!a||upper(recordValue(a,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED')return null;const id=recordId(a,'artifacts');return {artifactId:id,filename:String(recordValue(a,'FILENAME')||id),byteSize:Number(recordValue(a,'BYTE_SIZE')||0),sha256:String(recordValue(a,'SHA256')||'UNKNOWN'),role:String(recordValue(a,'ROLE')||'AUTHORIZED_INPUT')};};
  const addArtifact=a=>{const exact=exactArtifact(a);if(!exact)return false;send.set(exact.artifactId,exact);return true;};
  const addReferenced=value=>{for(const id of new Set((JSON.stringify(value||'').match(/ARTIFACT-[A-Za-z0-9-]+/g)||[])))addArtifact(artifactsById.get(id));};
  if(stage===4){
    const currentInput=String(currentScope(project).inputVersion||''),activeArtifacts=records(project,'artifacts').filter(a=>!a.scope?.inputVersion||String(a.scope.inputVersion)===currentInput);
    const basename=value=>String(value||'').trim().split(/[\\\\/]/).pop().toLowerCase();
    for(const reference of suppliedMaterialReferences(project)){
      if(reference.transferMode==='INLINE_JOB_INPUT')continue;
      const key=basename(reference.label),matches=activeArtifacts.filter(a=>basename(recordValue(a,'FILENAME'))===key),verified=matches.map(exactArtifact).filter(Boolean),copy=verified.length===1?verified[0]:null;
      conversationMaterials.push({
        label:reference.label,
        type:reference.type,
        transferMode:reference.transferMode,
        externalAccessStatus:'NOT_OBSERVABLE_BY_APPLICATION',
        operatorAction:reference.transferMode==='AUTHORIZED_REFERENCE'?'Use the authorized reference in the external agent context; if it cannot be accessed there, provide the original material directly in that conversation.':'If the original material is already attached and readable in the external agent conversation, do nothing. Otherwise attach the original directly to that conversation.',
        applicationUploadRequired:false,
        optionalApplicationArtifactId:copy?.artifactId||null
      });
      if(copy)optionalApplicationCopies.set(copy.artifactId,copy);
    }
  }
  for(const item of items){for(const a of item.handoff.send)addArtifact(artifactsById.get(a.artifactId));for(const x of item.handoff.withhold)withhold.set(x.artifactIdOrCategory,x);for(const x of item.handoff.expectBack)expectBack.set(x.kind+'|'+x.filenameOrPattern,x);}
  const current=currentScope(project),runExecution=stage===11||(stage===17&&op==='EXECUTE_RUN')||(stage===19&&op==='EXECUTE_RUN');
  if(runExecution){const candidate=recordsForCurrentScope(project,'candidateFreezes').find(c=>recordId(c,'candidateFreezes')===String(current.candidateId||''))||recordsForCurrentScope(project,'candidateFreezes').at(-1);addReferenced(recordValue(candidate,'COMPONENT_MANIFEST'));addReferenced(recordValue(candidate,'IMMUTABLE_LOCATIONS'));}
  if(stage===21){const baseline=recordsForCurrentScope(project,'baselines').find(b=>recordId(b,'baselines')===String(current.baselineId||''))||recordsForCurrentScope(project,'baselines').at(-1);addReferenced(recordValue(baseline,'IMMUTABLE_ARTIFACT_RECORDS'));addReferenced(recordValue(baseline,'APPROVED_VERSIONS'));}
  if([22,23,24,25].includes(stage))for(const a of artifacts)if(String(a.scope?.productId||'')===String(current.productId||''))addArtifact(a);
  if(stage===12){const wanted=runIds?new Set(runIds.map(String)):null;for(const run of recordsForCurrentScope(project,'runs'))if(!wanted||wanted.has(recordId(run,'runs')))addReferenced(recordValue(run,'OUTPUT_ARTIFACT_IDENTITIES'));}
  const stageWithhold={11:['outputs from other runs','reviewer feedback','failure explanations','proposed corrections'],12:['other verifiers’ determinations','Stage 13 comparison findings','root-cause analysis','correction proposals'],23:['Stage 21 generator correctness claims','unneeded deterministic pass conclusions','adversarial findings'],24:['generator reasoning or self-evaluation','prior reviewer conclusions that tell the adversarial reviewer what to find']};for(const label of stageWithhold[stage]||[])withhold.set(label,{artifactIdOrCategory:label,reason:'Withheld to preserve information isolation and reduce verification bias.'});
  const externalWork=[4,11,12,17,19,21,23,24,25].includes(stage);if(externalWork)expectBack.set('STRUCTURED_RESPONSE|final strict JSON response',{kind:'STRUCTURED_RESPONSE',filenameOrPattern:'final strict JSON response',required:true});
  return {send:[...send.values()],withhold:[...withhold.values()],expectBack:[...expectBack.values()],conversationMaterials,optionalApplicationCopies:[...optionalApplicationCopies.values()]};
}
`;
  source = replaceBetween(source, start, end, replacement, 'workflow execution handoff');
  const oldAction = "function operationalNextAction(project,currentStage){const stage=Number(currentStage||1),requests=unresolvedHumanRequests(project,stage);if(requests.length)return 'Answer the current human-only question(s). Saving the answer will invalidate the old instruction and generate a replacement for this same stage.';if(stage===16){const correction=stage16CorrectionPlan(project);return correction.heading+'. '+correction.explanation;}const plan=testExecutionPlan(project)";
  const newAction = "function operationalNextAction(project,currentStage){const stage=Number(currentStage||1),requests=unresolvedHumanRequests(project,stage);if(requests.length)return 'Answer the current human-only question(s). Saving the answer will invalidate the old instruction and generate a replacement for this same stage.';if(stage===16){const correction=stage16CorrectionPlan(project);return correction.heading+'. '+correction.explanation;}if(stage===4){const handoff=executionHandoff(project,{stage:4,operation:'COMPLETE'}),materials=handoff.conversationMaterials.map(item=>item.label);if(materials.length)return 'Continue in the external agent conversation that already has '+materials.join(', ')+'. If any listed material is not actually available there, attach the original directly to that conversation. Do not upload it into this application merely to generate Stage 04.';}const plan=testExecutionPlan(project)";
  source = replaceOnce(source, oldAction, newAction, 'Stage 04 operational next action');
  write(path, source);
}

// prompt-engine.js: tell the executing agent to use the original material in its
// own conversation, never to require a duplicate browser upload.
{
  const path = 'prompt-engine.js';
  let source = read(path);
  source = replaceOnce(source, "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/21';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/23';", 'prompt engine version');
  const oldProcedure = "4:'Compile atomic requirement proposals for this current job from authorized User Job Input plus legitimately applicable Stage 03 external-source research, preserving provenance for each obligation. Each proposed requirement should express one independently testable obligation where possible and record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, and notes. The application assigns REQ_ID and controlled requirement-set identity after validated ingestion. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.',";
  const newProcedure = "4:'Compile atomic requirement proposals for this current job from authorized User Job Input, supplied project materials that are actually readable in this executing context, and legitimately applicable Stage 03 external-source research, preserving provenance for each obligation. A supplied project material is human-authority input, not automatically independent external authority. If a listed file, package, link, or other non-inline material is already attached or readable in this external conversation, use it directly; no duplicate upload into the application is required. If it is not actually available here, ask the human conversationally to attach or provide the original material in this external conversation before final JSON. Do not ask the human to retype or summarize material merely because you cannot access it, and never infer substantive contents from a filename, path, link label, claimed hash, or metadata. If a required material remains inaccessible, return BLOCKED with the exact MISSING_ARTIFACT or MISSING_INPUT reason rather than fabricating a complete requirement set. Each proposed requirement should express one independently testable obligation where possible and record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, and notes. The application assigns REQ_ID and controlled requirement-set identity after validated ingestion. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.',";
  source = replaceOnce(source, oldProcedure, newProcedure, 'Stage 04 prompt procedure');

  // Patch the prompt handoff IIFE by stable boundaries.
  const markerStart = "${(()=>{const plan=verificationBatchPlan(stage,state,operation,scope),ids=plan?.triples?.map(x=>x.testId),runIds=plan?.triples?.map(x=>x.runId),handoff=workflow.executionHandoff(state,{stage,operation,testIds:ids,runIds});";
  const markerEnd = "})()}STAGE-SPECIFIC TASK";
  const iifeStart = source.indexOf(markerStart);
  if (iifeStart < 0) throw new Error('Prompt handoff IIFE start not found');
  const iifeEnd = source.indexOf(markerEnd, iifeStart);
  if (iifeEnd < 0) throw new Error('Prompt handoff IIFE end not found');
  const newIife = "${(()=>{const plan=verificationBatchPlan(stage,state,operation,scope),ids=plan?.triples?.map(x=>x.testId),runIds=plan?.triples?.map(x=>x.runId),handoff=workflow.executionHandoff(state,{stage,operation,testIds:ids,runIds}),materials=Array.isArray(handoff.conversationMaterials)?handoff.conversationMaterials:[];if(!handoff.send.length&&!handoff.withhold.length&&!handoff.expectBack.length&&!materials.length)return '';const lines=['EXECUTION / ARTIFACT HANDOFF — APPLICATION DERIVED'];if(materials.length){lines.push('SUPPLIED MATERIALS THE AGENT MUST ACTUALLY HAVE');for(const item of materials)lines.push('- '+item.label+' — '+item.type+' — application cannot observe external access');lines.push('No second upload into the application is required. If a listed material is already attached and readable in this external conversation, use it here. Otherwise ask the human conversationally to attach or provide the original material directly in this conversation before final JSON. Do not ask the human to retype or summarize its contents. Do not infer contents from a filename, path, link label, claimed hash, or metadata. If required material remains inaccessible, return BLOCKED with the exact missing-item reason.');}if(handoff.send.length){lines.push('FILES YOU MUST RECEIVE');for(const x of handoff.send)lines.push('- '+x.artifactId+' — '+x.filename+' — SHA-256 '+x.sha256);}if(handoff.withhold.length){lines.push('FILES / CONTEXT YOU MUST NOT RECEIVE');for(const x of handoff.withhold)lines.push('- '+x.artifactIdOrCategory+' — '+x.reason);}if(handoff.expectBack.length){lines.push('FILES / EVIDENCE YOU MUST RETURN');for(const x of handoff.expectBack)lines.push('- '+(x.filenameOrPattern||x.kind)+(x.required?' — REQUIRED':''));}if(handoff.send.length)lines.push('Browser-local custody does not mean these bytes were transferred automatically. The executing environment must actually receive every required file.');return lines.join('\\n')+'\\n\\n';})()}STAGE-SPECIFIC TASK";
  source = source.slice(0, iifeStart) + newIife + source.slice(iifeEnd + markerEnd.length);

  const oldManifest = "const opContract=schema.operationContract(stage,operation);const scope=assertRequiredPromptScope(stage,operation,scopeFor(stage,state,options.scope||{})),feedback=recoveryFeedback(state,stage,operation,scope),batchPlan=verificationBatchPlan(stage,state,operation,scope),contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,readCollections:";
  const newManifest = "const opContract=schema.operationContract(stage,operation);const scope=assertRequiredPromptScope(stage,operation,scopeFor(stage,state,options.scope||{})),feedback=recoveryFeedback(state,stage,operation,scope),batchPlan=verificationBatchPlan(stage,state,operation,scope),handoff=workflow.executionHandoff(state,{stage,operation,testIds:batchPlan?.triples?.map(item=>item.testId),runIds:batchPlan?.triples?.map(item=>item.runId)}),promptHandoff={send:handoff.send,withhold:handoff.withhold,expectBack:handoff.expectBack,conversationMaterials:handoff.conversationMaterials},contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,readCollections:";
  source = replaceOnce(source, oldManifest, newManifest, 'prompt context handoff binding');
  write(path, source);
}

// app-core.js: put the no-duplicate-upload instruction directly where the user
// needs it and demote optional browser custody to a collapsed secondary control.
{
  const path = 'app-core.js';
  let source = read(path);
  const artifactStart = 'function artifactControlMarkup(n,locked){';
  const artifactEnd = 'function runBatchMarkup(n){';
  const replacement = `function stageFourMaterialHandoffMarkup(n){
  if(n!==4)return '';
  const handoff=engine.executionHandoff(current,{stage:4,operation:selectedOperation(4)}),materials=safe(handoff.conversationMaterials),copies=safe(handoff.optionalApplicationCopies);
  if(!materials.length)return '';
  const rows=materials.map(item=>({material:item.label,type:item.type,where:'External agent conversation',action:item.operatorAction,uploadToThisApplication:'NOT REQUIRED',applicationVerifiedCopy:item.optionalApplicationArtifactId||'NONE'}));
  return \`<div class="panel" id="stage04-material-handoff" tabindex="-1"><h2 class="section-title">Use the original material in the agent conversation</h2><div class="notice success"><strong>No upload to this application is required.</strong><br>If the material is already attached and readable in that conversation, do nothing. Otherwise attach the original directly to that conversation before the agent returns final JSON. The application does not claim that external bytes are present, and the agent must not infer contents from a filename or metadata.</div>\${details('Supplied materials for Stage 04',rows,true)}\${copies.length?\`<details class="record-card"><summary>Optional application-verified copies<span>\${copies.length}</span></summary><div class="record-body"><p class="section-intro">These copies are available only because their bytes were already stored and verified here. Using them is optional; browser custody never proves the external conversation received them.</p><div class="button-row">\${copies.map(item=>\`<button type="button" data-download-artifact="\${esc(item.artifactId)}">Download \${esc(item.filename)}</button>\`).join('')}</div></div></details>\`:''}</div>\`;
}
function artifactControlMarkup(n,locked){
  if(n===19)return \`<div class="panel"><h2 class="section-title">Unchanged candidate control</h2><p class="section-intro">Stage 19 reuses the exact current Stage 17 frozen candidate identity and hashes. Do not select replacement files or create a new candidate.</p><div class="button-row"><button id="begin-unchanged-confirmation"\${locked?' disabled':''}>Begin unchanged confirmation using Stage 17 candidate</button></div></div>\`;
  const applicable=[10,17,20,21,25].includes(n),files=safe(current.stages[n].authorizedFiles),productReady=n!==21||Boolean(currentStageProduct()),fileLocked=locked||!productReady;
  const controls=\`<div class="grid-2"><div class="field"><label>Select exact files</label><input id="stage-files" type="file" multiple\${fileLocked?' disabled':''}></div><div class="field"><label>Select structured package folder</label><input id="stage-directory" type="file" webkitdirectory directory multiple\${fileLocked?' disabled':''}><span class="help">Use folder selection when directory structure is meaningful; canonical filenames preserve paths relative to the selected root.</span></div></div>\${files.length?details('Verified artifact bytes',files,true):'<div class="empty-state">No verified stage artifact bytes.</div>'}<div class="button-row">\${[10,17].includes(n)?\`<button id="freeze-candidate"\${locked?' disabled':''}>\${n===17?'Freeze corrected candidate':'Freeze selected candidate'}</button>\`:''}\${n===20?\`<button id="freeze-baseline"\${locked?' disabled':''}>Freeze selected baseline</button>\`:''}\${n===21?\`<button id="reserve-product-execution"\${locked?' disabled':''}>Reserve product execution</button>\`:''}</div>\`;
  if(n===4)return \`<details class="record-card" id="stage04-optional-custody"><summary>Optional application file custody<span>Optional</span></summary><div class="record-body"><p class="section-intro"><strong>Do not put the original Stage 04 input here merely to make the stage work.</strong> Use this control only when the agent returns an actual file that must be ingested, or when you deliberately want an application-verified archival copy.</p>\${controls}</div></details>\`;
  return \`<div class="panel"><h2 class="section-title">\${applicable?'Artifact control':'Authorized files for this stage'}</h2><p class="section-intro">Actual selected bytes are stored in IndexedDB, hashed by the application, read back, and rehashed before becoming canonical artifact identities. If an agent response declares attachments, attach the exact returned files here before Parse / validate; a filename, hash claim, or code block is not file possession.</p>\${n===21&&!productReady?'<div class="notice warn">Reserve the Stage 21 product execution before selecting finished-product files. The reserved PRODUCT_ID controls artifact scope, inventory, and lineage.</div>':''}\${controls}</div>\`;
}
`;
  source = replaceBetween(source, artifactStart, artifactEnd, replacement, 'Stage 04 material handoff UI');
  source = replaceOnce(source, "function stagePurposeMarkup(n){const text={6:", "function stagePurposeMarkup(n){const text={4:'The agent compiles the requirement specification from current human input, actually accessible supplied materials, and accepted external-source research. Keep the work in the external conversation that has the original material; no duplicate upload into this application is required.',6:", 'Stage 04 purpose text');
  const workflowNeedle = "${interactionModeMarkup(n)}${n===4?artifactControlMarkup(n,locked):''}<div class=\"panel\" id=\"prompt-heading\"";
  const workflowReplacement = "${interactionModeMarkup(n)}${stageFourMaterialHandoffMarkup(n)}${n===4?artifactControlMarkup(n,locked):''}<div class=\"panel\" id=\"prompt-heading\"";
  source = replaceOnce(source, workflowNeedle, workflowReplacement, 'Stage 04 handoff panel placement');
  write(path, source);
}

// Shared runtime token: changed runtime files must load as one coherent graph.
{
  const path = 'index.html';
  let source = read(path);
  const tokens = [...source.matchAll(/runtime-[A-Za-z0-9-]+/g)].map(match=>match[0]);
  if (!tokens.length) throw new Error('No runtime token found in index.html');
  const unique = [...new Set(tokens)];
  if (unique.length !== 1) throw new Error(`Expected one current runtime token, found ${unique.join(', ')}`);
  source = source.split(unique[0]).join('runtime-4f8b7c2d1a6e9f30');
  write(path, source);
}

// Deterministic engine regression coverage.
{
  const path = 'verify-complete.mjs';
  let source = read(path);
  const marker = '// stage04-conversation-material-handoff-regression-v2';
  if (source.includes(marker)) throw new Error('Stage 04 complete regression already exists');
  source += `

// stage04-conversation-material-handoff-regression-v2
{
  const p=project('JOB-STAGE04-CONVERSATION-MATERIAL');
  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]);
  let handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});
  assert(handoff.conversationMaterials.length===1&&handoff.conversationMaterials[0].label==='design-input.pdf','Stage 04 did not derive the external-conversation material reference.');
  assert(handoff.conversationMaterials[0].applicationUploadRequired===false,'Stage 04 incorrectly requires duplicate upload into the application.');
  assert(handoff.optionalApplicationCopies.length===0,'Stage 04 invented application custody for an external-conversation material.');
  assert(handoff.expectBack.some(item=>item.kind==='STRUCTURED_RESPONSE'&&item.required),'Stage 04 handoff omitted the final structured response.');
  assert(engine.operationalNextAction(p,4).includes('Do not upload it into this application'),'Stage 04 next action does not explicitly reject duplicate app upload.');
  p.projectData.artifacts.push({id:'ARTIFACT-STAGE04-OPTIONAL',stage:1,active:true,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION},fields:{ARTIFACT_ID:'ARTIFACT-STAGE04-OPTIONAL',FILENAME:'design-input.pdf',BYTE_SIZE:4,SHA256:'a'.repeat(64),ROLE:'SUPPLIED_PROJECT_INPUT',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}});
  handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});
  assert(handoff.conversationMaterials.length===1&&handoff.optionalApplicationCopies.length===1,'An already verified optional application copy was not exposed without becoming mandatory.');
  assert(handoff.optionalApplicationCopies[0].artifactId==='ARTIFACT-STAGE04-OPTIONAL','Stage 04 optional copy identity is wrong.');
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(appSource.includes('No upload to this application is required.'),'Stage 04 UI does not make the no-duplicate-upload rule explicit.');
  assert(!appSource.includes('Required input file is missing. Add and verify'),'The reverted Stage 04 browser-upload hard block returned.');
}
console.log(JSON.stringify({stage04ConversationMaterialHandoff:true}));
`;
  write(path, source);
}

// Prompt identity, honesty, and same-conversation behavior regression coverage.
{
  const path = 'verify-prompt-semantics.mjs';
  let source = read(path);
  const marker = '// stage04-conversation-material-prompt-regression-v2';
  if (source.includes(marker)) throw new Error('Stage 04 prompt regression already exists');
  source += `

// stage04-conversation-material-prompt-regression-v2
{
  const p=baseProject();
  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]);
  const withoutAppCopy=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
  for(const token of ['SUPPLIED MATERIALS THE AGENT MUST ACTUALLY HAVE','design-input.pdf','No second upload into the application is required','already attached and readable in this external conversation','ask the human conversationally to attach or provide the original material directly in this conversation','Do not ask the human to retype or summarize its contents','Do not infer contents from a filename'])if(!withoutAppCopy.prompt.includes(token))throw new Error('Stage 04 same-conversation material prompt missing: '+token);
  if(!withoutAppCopy.contextManifest.executionHandoff?.conversationMaterials?.length)throw new Error('Stage 04 material handoff is not bound to prompt context identity.');
  for(const prohibited of ['must add and application-verify these exact bytes','The application will not allow Save or Save and copy','Required input file is missing'])if(withoutAppCopy.prompt.includes(prohibited))throw new Error('Stage 04 prompt restored the rejected browser-upload requirement: '+prohibited);
  p.projectData.artifacts.push({id:'ARTIFACT-STAGE04-OPTIONAL',stage:1,active:true,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION},fields:{ARTIFACT_ID:'ARTIFACT-STAGE04-OPTIONAL',FILENAME:'design-input.pdf',BYTE_SIZE:4,SHA256:'b'.repeat(64),ROLE:'SUPPLIED_PROJECT_INPUT',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}});
  const withOptionalAppCopy=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
  if(withOptionalAppCopy.bodySha256!==withoutAppCopy.bodySha256||withOptionalAppCopy.contextSignature!==withoutAppCopy.contextSignature)throw new Error('Optional browser custody incorrectly controls or invalidates the Stage 04 external-conversation prompt.');
  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:'revised-design-input.pdf'}]);
  const revised=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
  if(revised.bodySha256===withoutAppCopy.bodySha256||revised.contextSignature===withoutAppCopy.contextSignature)throw new Error('A changed Stage 04 material reference did not change prompt identity.');
}
console.log(JSON.stringify({stage04ConversationMaterialPrompt:true}));
`;
  write(path, source);
}

// Browser acceptance: the normal screen must make the same-conversation route
// unmistakable and keep optional app custody collapsed at phone width.
{
  const path = 'verify-browser.mjs';
  let source = read(path);
  const anchor = " await openStage(cdp,1);await evalValue(cdp,`document.querySelector('.app-help details').open=true`);text=(await snapshot(cdp)).text;";
  requireContains(source, anchor, 'browser insertion anchor');
  const insert = ` await click(cdp,'[data-view="Project"]');await fill(cdp,'[data-job="SUPPLIED_MATERIALS_INVENTORY"]',JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]));await click(cdp,'#save-job');await waitExpr(cdp,\`(async()=>{const p=await globalThis.closedLoopProjectStore.readAll();return p.some(x=>x.job?.JOB_ID==='\${newest.job.JOB_ID}'&&String(x.job?.SUPPLIED_MATERIALS_INVENTORY||'').includes('design-input.pdf'));})()\`,12000);await openStage(cdp,4);await setWidth(cdp,320);const stage04Snapshot=await snapshot(cdp);for(const token of ['Use the original material in the agent conversation','No upload to this application is required.','If the material is already attached and readable in that conversation, do nothing.','Otherwise attach the original directly to that conversation','design-input.pdf','Optional application file custody','SUPPLIED MATERIALS THE AGENT MUST ACTUALLY HAVE'])assert(stage04Snapshot.text.includes(token),\`Stage 04 same-conversation UX missing \${token}.\`);const stage04Layout=await evalValue(cdp,\`(()=>{const optional=document.querySelector('#stage04-optional-custody'),file=document.querySelector('#stage-files');return {optionalExists:Boolean(optional),optionalOpen:Boolean(optional?.open),fileVisible:Boolean(file?.getClientRects().length),overflow:document.documentElement.scrollWidth>innerWidth+1};})()\`);assert(stage04Layout?.optionalExists&&!stage04Layout.optionalOpen&&!stage04Layout.fileVisible&&!stage04Layout.overflow,\`Stage 04 optional custody is visually mandatory or overflows at 320px: \${JSON.stringify(stage04Layout)}\`);await setWidth(cdp,393);
`;
  source = replaceOnce(source, anchor, insert + anchor, 'browser Stage 04 same-conversation acceptance');
  write(path, source);
}

// Final source assertions guard against accidental reintroduction of the exact
// rejected behavior.
for (const [path, prohibited] of [
  ['workflow-engine.js', 'Required supplied material bytes are not stored and verified by the application.'],
  ['prompt-engine.js', 'The operator must add and application-verify these exact bytes before this instruction may be executed.'],
  ['app-core.js', 'The application will not allow Save or Save and copy while these required bytes are unavailable.']
]) {
  const source = read(path);
  if (source.includes(prohibited)) throw new Error(`${path} still contains rejected Stage 04 app-upload behavior`);
}

console.log('stage04-context-handoff-repair: PATCHED');
