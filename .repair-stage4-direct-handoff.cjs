const fs=require('fs');

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replaceOnce(text,search,replacement,label){
  const count=text.split(search).length-1;
  if(count!==1)throw new Error(`${label}: expected one exact match, found ${count}.`);
  return text.replace(search,replacement);
}
function replaceRegex(text,regex,replacement,label){
  const matches=[...text.matchAll(new RegExp(regex.source,regex.flags.includes('g')?regex.flags:regex.flags+'g'))];
  if(matches.length!==1)throw new Error(`${label}: expected one regex match, found ${matches.length}.`);
  return text.replace(regex,replacement);
}

// workflow-engine.js — extend the existing handoff authority without making app custody a Stage 04 prerequisite.
{
  const path='workflow-engine.js';
  let text=read(path);
  const handoffPattern=/function executionHandoff\(project,\{stage=Number\(project\.activeStage\|\|0\),operation=null,testIds=null,runIds=null\}=\{\}\)\{[\s\S]*?\n\}\nfunction evidenceChainExplanation/;
  const handoffReplacement=`function executionHandoff(project,{stage=Number(project.activeStage||0),operation=null,testIds=null,runIds=null}={}){
  const op=String(operation||'').toUpperCase(),testStages=stage===12||[22,23,24].includes(stage)||(stage===17&&['VERIFY','REGRESSION'].includes(op))||(stage===19&&['VERIFY','REGRESSION_VERIFY'].includes(op)),ids=testIds?new Set(testIds.map(String)):null,items=testStages?testExecutionPlan(project).items.filter(i=>!ids||ids.has(i.testId)):[],send=new Map(),withhold=new Map(),expectBack=new Map(),artifacts=recordsForCurrentScope(project,'artifacts'),allArtifacts=records(project,'artifacts').filter(isActiveRecord),artifactsById=new Map(artifacts.map(a=>[recordId(a,'artifacts'),a]));
  const addArtifact=a=>{if(!a||upper(recordValue(a,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED')return null;const id=recordId(a,'artifacts'),entry={artifactId:id,filename:String(recordValue(a,'FILENAME')||id),byteSize:Number(recordValue(a,'BYTE_SIZE')||0),sha256:String(recordValue(a,'SHA256')||'UNKNOWN'),role:String(recordValue(a,'ROLE')||'AUTHORIZED_INPUT'),applicationVerified:true,transferSource:'APPLICATION_CUSTODY',identityNote:'Exact bytes are stored and verified by the application.'};send.set(id,entry);return entry;};
  const addReferenced=value=>{for(const id of new Set((JSON.stringify(value||'').match(/ARTIFACT-[A-Za-z0-9-]+/g)||[])))addArtifact(artifactsById.get(id));};
  const materialKey=value=>String(value||'').split(/[\\\\/]/).pop().trim().toLowerCase().replace(/\\.(?:zip|pdf|docx?|xlsx?|csv|json|png|jpe?g|svg|txt|md|gz|tar|7z)$/i,'').replace(/[^a-z0-9]+/g,' ').trim();
  const addOperatorFile=label=>{const filename=String(label||'').trim();if(!filename)return;const key='OPERATOR_FILE:'+materialKey(filename);if([...send.values()].some(item=>materialKey(item.filename)===materialKey(filename)))return;send.set(key,{artifactId:null,filename,byteSize:null,sha256:null,role:'SUPPLIED_PROJECT_MATERIAL',applicationVerified:false,transferSource:'OPERATOR_ORIGINAL_FILE',identityNote:'The application does not hold a verified byte identity for this supplied file.'});};
  if(stage===4){
    const labels=[],nonFileType=/^(MESSAGE|TEXT|PROMPT|USER_MESSAGE|CHAT)$/i,fileType=/FILE|ARTIFACT|ATTACHMENT|ZIP|ARCHIVE|DIRECTORY|FOLDER|DOCUMENT|DISCLOSURE|REPOSITORY|PACKAGE|WORKBOOK|DRAWING|MODEL|DATASET|SPREADSHEET/i;
    const addLabel=(value,type='')=>{const label=String(value||'').trim(),kind=String(type||'').trim();if(!label||nonFileType.test(kind))return;const looksFile=fileType.test(kind)||/\\.(?:zip|pdf|docx?|xlsx?|csv|json|png|jpe?g|svg|txt|md|gz|tar|7z)$/i.test(label)||/[\\\\/]/.test(label)||/[A-Za-z0-9]+_[A-Za-z0-9_ -]+/.test(label);if(looksFile)labels.push(label);};
    for(const rawValue of [project?.job?.SUPPLIED_MATERIALS_INVENTORY,project?.stages?.[1]?.agentData?.INPUT_SET_CONTENTS]){
      const raw=typeof rawValue==='string'?rawValue.trim():rawValue;if(!raw||/^(UNKNOWN|NONE|NOT APPLICABLE)$/i.test(String(raw)))continue;
      if(typeof raw==='object'){const entries=Array.isArray(raw)?raw:[raw];for(const item of entries){if(item&&typeof item==='object')addLabel(item.exactNameOrReference||item.filename||item.fileName||item.name||item.title||item.reference||item.description,item.type||item.materialType||item.kind);else addLabel(item);}continue;}
      try{const parsed=JSON.parse(raw),entries=Array.isArray(parsed)?parsed:[parsed];for(const item of entries){if(item&&typeof item==='object')addLabel(item.exactNameOrReference||item.filename||item.fileName||item.name||item.title||item.reference||item.description,item.type||item.materialType||item.kind);else addLabel(item);}}
      catch{for(const part of raw.split(/[\\n;]+/))addLabel(part);}
    }
    for(const label of [...new Set(labels)]){
      const key=materialKey(label),matches=allArtifacts.filter(a=>materialKey(recordValue(a,'FILENAME'))===key),verified=matches.filter(a=>upper(recordValue(a,'AVAILABILITY'))==='BYTES_PERSISTED_AND_VERIFIED'),exact=verified.filter(a=>upper(recordValue(a,'FILENAME'))===upper(label)),match=exact.length===1?exact[0]:verified.length===1?verified[0]:null;
      if(match)addArtifact(match);else addOperatorFile(label);
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
  return {send:[...send.values()],withhold:[...withhold.values()],expectBack:[...expectBack.values()]};
}
function evidenceChainExplanation`;
  text=replaceRegex(text,handoffPattern,handoffReplacement,'workflow-engine executionHandoff');

  const nextPattern=/function operationalNextAction\(project,currentStage\)\{[\s\S]*?\n\}\n\nfunction applicationTestCapabilities/;
  const nextReplacement=`function operationalNextAction(project,currentStage){const stage=Number(currentStage||1),requests=unresolvedHumanRequests(project,stage);if(requests.length)return 'Answer the current human-only question(s). Saving the answer will invalidate the old instruction and generate a replacement for this same stage.';if(stage===16){const correction=stage16CorrectionPlan(project);return correction.heading+'. '+correction.explanation;}if(stage===4){const handoff=executionHandoff(project,{stage:4,operation:'COMPLETE'});if(handoff.send.length)return 'Attach '+handoff.send.map(x=>(x.artifactId?x.artifactId+' ('+x.filename+')':x.filename)).join(', ')+' directly to the Stage 04 external conversation, then send the current instruction. You do not need to upload the file into this application first, and the application does not transfer it automatically. Do not continue until the external agent has the actual file.';}if([23,24].includes(stage)){const reviewer=records(project,'freshContexts').filter(r=>isActiveRecord(r)&&Number(r.stage)===stage).at(-1);if(!reviewer)return 'Open a fresh independent reviewer context and register its identifier in this stage. The application will bind that identity into the controlling prompt before you send any product or review material.';}const plan=testExecutionPlan(project),relevant=[12,22,23,24].includes(stage)?plan.items:[];const blocked=relevant.find(i=>!i.executableNow);if(blocked)return 'Blocked: '+blocked.testId+' requires '+(blocked.requiredCapability||'a valid execution capability')+'. '+(blocked.blockingReason||'Required execution evidence is not currently obtainable.');const item=relevant.find(i=>i.operatorAction!=='NO_ACTION');if(item){const files=item.requiredArtifactNames.length?' Send '+item.requiredArtifactIds.map((id,n)=>id+' ('+(item.requiredArtifactNames[n]||'file')+')').join(', ')+'.':'';const withheld=item.handoff.withhold.length?' Do not send '+item.handoff.withhold.map(x=>x.artifactIdOrCategory).join(', ')+'.':'';const back=item.handoff.expectBack.length?' Return '+item.handoff.expectBack.map(x=>x.filenameOrPattern||x.kind).join(', ')+'.':'';if(item.operatorAction==='SEND_TO_INDEPENDENT_REVIEWER')return 'Open a fresh independent reviewer context and use the current verifier instruction.'+files+withheld+back;if(item.operatorAction==='SEND_TO_TOOL_AGENT')return 'Run the current instruction in an environment with '+item.requiredCapability+'.'+files+withheld+back;if(item.operatorAction==='HUMAN_INSPECTION')return 'Human inspection required: perform the current inspection checklist and preserve the requested observation evidence.';if(item.operatorAction==='USE_EXTERNAL_SYSTEM')return 'Use the required external system ('+item.requiredCapability+') and return its exact result/evidence.';}
  if(relevant.length&&relevant.every(i=>i.operatorAction==='NO_ACTION'))return 'No external action required. The application can perform the current deterministic verification route.';return 'Use the current Stage '+String(stage).padStart(2,'0')+' instruction. Return only its final structured JSON (and any required returned files) when the external work or conversation is complete.';}

function applicationTestCapabilities`;
  text=replaceRegex(text,nextPattern,nextReplacement,'workflow-engine operationalNextAction');
  write(path,text);
}

// prompt-engine.js — render the same derived Stage 04 handoff and bind it into prompt identity.
{
  const path='prompt-engine.js';
  let text=read(path);
  text=replaceOnce(text,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/22';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/23';",'prompt engine version');
  const handoffPattern=/\$\{\(\(\)=>\{const plan=verificationBatchPlan\(stage,state,operation,scope\),ids=plan\?\.[\s\S]*?\}\)\(\)\}STAGE-SPECIFIC TASK/;
  const handoffReplacement=`\${(()=>{const plan=verificationBatchPlan(stage,state,operation,scope),ids=plan?.triples?.map(x=>x.testId),runIds=plan?.triples?.map(x=>x.runId),handoff=workflow.executionHandoff(state,{stage,operation,testIds:ids,runIds});if(!handoff.send.length&&!handoff.withhold.length&&!handoff.expectBack.length)return '';const lines=['EXECUTION / ARTIFACT HANDOFF — APPLICATION DERIVED'];if(handoff.send.length){lines.push('FILES YOU MUST RECEIVE');for(const x of handoff.send)lines.push(x.applicationVerified&&x.artifactId?'- '+x.artifactId+' — '+x.filename+' — '+x.byteSize+' bytes — SHA-256 '+x.sha256:'- OPERATOR-SUPPLIED FILE — '+x.filename+' — exact byte identity is not held by the application');}if(stage===4&&handoff.send.length){lines.push('The operator must attach every file listed above directly to this external conversation before Stage 04 work begins.');lines.push('The application does not upload or transfer these files automatically. The operator does not need to upload the original file into the application first.');lines.push('If any listed file is not actually present in your executing context, return BLOCKED with MISSING_ARTIFACT and name the missing file. Do not infer its contents from a filename, metadata, inventory description, or prior summary, and do not produce a complete Stage 04 requirement set without inspecting the actual supplied file.');}if(handoff.withhold.length){lines.push('FILES / CONTEXT YOU MUST NOT RECEIVE');for(const x of handoff.withhold)lines.push('- '+x.artifactIdOrCategory+' — '+x.reason);}if(handoff.expectBack.length){lines.push('FILES / EVIDENCE YOU MUST RETURN');for(const x of handoff.expectBack)lines.push('- '+(x.filenameOrPattern||x.kind)+(x.required?' — REQUIRED':''));}lines.push('A filename or application record is not file possession. The executing environment must actually receive every required file.');return lines.join('\\n')+'\\n\\n';})()}STAGE-SPECIFIC TASK`;
  text=replaceRegex(text,handoffPattern,handoffReplacement,'prompt-engine handoff block');
  text=replaceOnce(
    text,
    "batchPlan=verificationBatchPlan(stage,state,operation,scope),contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,readCollections:",
    "batchPlan=verificationBatchPlan(stage,state,operation,scope),executionHandoff=workflow.executionHandoff(state,{stage,operation,testIds:batchPlan?.triples?.map(x=>x.testId),runIds:batchPlan?.triples?.map(x=>x.runId)}),contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,executionHandoff,readCollections:",
    'prompt context handoff binding'
  );
  write(path,text);
}

// app-core.js — show a direct-to-agent handoff before the prompt; keep the existing app file control below the response.
{
  const path='app-core.js';
  let text=read(path);
  const interactionPattern=/function interactionModeMarkup\(n\)\{[\s\S]*?\nfunction stabilityMarkup/;
  const interactionReplacement=`function interactionModeMarkup(n){const pending=pendingProposal(),latestValidation=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n).at(-1),accepted=acceptedLaneChanges(n).at(-1),requests=safe(current.projectData.humanInputRequests).filter(x=>Number(x.stage)===n&&String(x.status||'OPEN').toUpperCase()==='OPEN'),abandoned=safe(current.projectData.responseDispositions).filter(x=>Number(x.stage)===n&&x.type==='ABANDONED_RESPONSE').at(-1);if(accepted)return \`<div class="notice success"><strong>The application accepted this response.</strong><br>Canonical state changed: YES · Accepted change: \${esc(accepted.changeId||'RECORDED')} · Do not reuse the old prompt.</div>\`;if(pending)return \`<div class="notice"><strong>Review the proposal in this application.</strong><br>The final JSON was validated, but canonical state changed: NO until you accept the complete proposal.</div>\`;if(latestValidation&&!latestValidation.valid)return \`<div class="notice danger"><strong>Return a corrected final JSON.</strong><br>Canonical state changed: NO. The rejected/stale response does not control current state. Save and use the replacement current instruction.</div>\`;if(abandoned)return \`<div class="notice"><strong>The pending attempt was discarded.</strong><br>Canonical accepted work changed: NO · Audit state changed: YES · New prompt required: YES. Use only the newly generated authoritative prompt; the abandoned response cannot be accepted later.</div>\`;if(requests.length||n===1&&!current.stages[1].responseDraft)return \`<div class="notice"><strong>Continue talking to the agent.</strong><br>Do not paste the conversation into the application. When the agent has enough information, it should return one final strict JSON response.</div>\`;if(n===4&&!current.stages[4].responseDraft){const handoff=engine.executionHandoff(current,{stage:4,operation:selectedOperation(4)});if(handoff.send.length)return \`<div class="notice"><strong>Attach the required file\${handoff.send.length===1?'':'s'}, then send this instruction.</strong><br>Attach \${esc(handoff.send.map(x=>x.filename).join(', '))} directly to the external agent conversation. The application does not transfer the file automatically. Do not paste anything into this application yet.</div>\`;}return \`<div class="notice"><strong>The agent should now return one final JSON response.</strong><br>Paste only that final JSON below. If the response declares returned files, attach those exact files before parsing.</div>\`;}
function stabilityMarkup`;
  text=replaceRegex(text,interactionPattern,interactionReplacement,'app interaction mode');

  const insertion=`function outgoingHandoffMarkup(n){
  if(n!==4)return '';
  const handoff=engine.executionHandoff(current,{stage:4,operation:selectedOperation(4)}),files=safe(handoff.send);if(!files.length)return '';
  const verified=files.filter(x=>x.applicationVerified&&x.artifactId),unverified=files.filter(x=>!x.applicationVerified),cards=files.map(x=>x.applicationVerified&&x.artifactId?\`<div class="notice outgoing-handoff-file"><strong>Application-verified file</strong><br>\${esc(x.artifactId)} — \${esc(x.filename)}<br>\${Number(x.byteSize||0).toLocaleString()} bytes · SHA-256 \${esc(x.sha256||'UNKNOWN')}</div>\`:\`<div class="notice outgoing-handoff-file"><strong>Original supplied file</strong><br>\${esc(x.filename)}<br>Use the original file from your device. Its exact byte identity is not stored or verified by this application.</div>\`).join('');
  const downloads=verified.map(x=>\`<button type="button" data-download-artifact="\${esc(x.artifactId)}">Download \${esc(x.filename)}</button>\`).join('');
  return \`<div class="panel" id="outgoing-handoff" tabindex="-1"><h2 class="section-title">Send with this instruction</h2><div class="notice"><strong>Attach before sending</strong><br>Attach \${files.length===1?'the file shown below':'every file shown below'} directly to the external agent conversation before sending the Stage 04 instruction. The application does not upload or transfer files automatically. Do not continue until \${files.length===1?'it is':'they are'} attached.</div><div class="record-stack">\${cards}</div>\${unverified.length?'<div class="notice success"><strong>No app upload required.</strong><br>Use the original file from your device. The agent must stop and report the missing file if it did not actually receive it; it must not infer contents from the filename or a prior summary.</div>':''}\${downloads?\`<div class="button-row">\${downloads}</div>\`:''}</div>\`;
}

`;
  text=replaceOnce(text,'function reviewerContextMarkup(n,locked){',insertion+'function reviewerContextMarkup(n,locked){','app outgoing handoff insertion');
  text=replaceOnce(
    text,
    "  const later={\n    10:'Include the exact candidate component files selected for the freeze if this operation must inspect their bytes.',",
    "  const later={\n    4:'Attach every file shown in “Send with this instruction” directly to the Stage 04 external conversation before sending the instruction. The application does not transfer those files automatically, and no app upload is required first.',\n    10:'Include the exact candidate component files selected for the freeze if this operation must inspect their bytes.',",
    'Stage 04 artifact help'
  );
  text=replaceOnce(text,'${interactionModeMarkup(n)}<div class="panel" id="prompt-heading"','${interactionModeMarkup(n)}${outgoingHandoffMarkup(n)}<div class="panel" id="prompt-heading"','Stage 04 handoff render order');
  write(path,text);
}

// index.html — one wrapping rule plus one shared runtime token.
{
  const path='index.html';
  let text=read(path);
  if(!text.includes('.outgoing-handoff-file{'))text=replaceOnce(text,'</style>','.outgoing-handoff-file{overflow-wrap:anywhere;word-break:break-word}\n</style>','Stage 04 handoff wrapping');
  text=text.replace(/(<script\\s+defer\\s+src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\\.js\\?v=)[^"]+(">)/g,'$1'+'20260829-stage4-direct-handoff'+'$2');
  const tokens=[...text.matchAll(/<script\\s+defer\\s+src="[^"]+\\?v=([^"]+)"/g)].map(m=>m[1]);
  if(tokens.length!==8||new Set(tokens).size!==1||tokens[0]!=='20260829-stage4-direct-handoff')throw new Error('Shared runtime cache token update failed.');
  write(path,text);
}

// Deterministic Stage 04 handoff tests.
{
  const path='verify-complete.mjs';
  let text=read(path);
  const block=`

// Stage 04 direct outgoing handoff: the operator is told what to attach without being forced to upload it into the application first.
{
  const filename='MAINFRAME_INVENTION_DISCLOSURE_COUNSEL_READY_LOGIC_CLEAN 2',p=project('JOB-STAGE4-DIRECT-HANDOFF');
  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:filename}]);
  let handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'}),item=handoff.send.find(x=>x.filename===filename);
  assert(item&&item.applicationVerified===false&&item.artifactId===null&&item.transferSource==='OPERATOR_ORIGINAL_FILE','Stage 04 did not derive the original operator-held supplied file.');
  assert(handoff.expectBack.some(x=>x.kind==='STRUCTURED_RESPONSE'),'Stage 04 handoff omitted the final structured response.');
  const action=engine.operationalNextAction(p,4);
  assert(action.includes(filename)&&/do not need to upload the file into this application first/i.test(action)&&/does not transfer it automatically/i.test(action),'Stage 04 next action still makes the operator guess or implies app upload is required.');
  const artifact=record('artifacts',1,{FILENAME:filename,TYPE:'application/octet-stream',VERSION:'v1',BYTE_SIZE:321,SHA256:'c'.repeat(64),ROLE:'SUPPLIED_PROJECT_MATERIAL',STORAGE_REFERENCE:'indexeddb:ARTIFACT-STAGE4-DIRECT',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ARTIFACT-STAGE4-DIRECT');
  p.projectData.artifacts.push(artifact);
  handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});item=handoff.send.find(x=>x.filename===filename);
  assert(item&&item.applicationVerified===true&&item.artifactId==='ARTIFACT-STAGE4-DIRECT'&&item.byteSize===321&&item.sha256==='c'.repeat(64),'Stage 04 did not upgrade the handoff to the exact application-verified identity when available.');
}
console.log(JSON.stringify({stage4DirectOutgoingHandoff:true},null,2));
`;
  if(text.includes('stage4DirectOutgoingHandoff'))throw new Error('Stage 04 complete test already exists.');
  text+=block;
  write(path,text);
}
{
  const path='verify-prompt-semantics.mjs';
  let text=read(path);
  const block=`

// Stage 04 prompt carries the exact direct-to-agent handoff without making application custody a prerequisite.
{
  const filename='MAINFRAME_INVENTION_DISCLOSURE_COUNSEL_READY_LOGIC_CLEAN 2',p=baseProject();
  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:filename}]);
  const record=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'}),prompt=record.prompt;
  for(const token of ['FILES YOU MUST RECEIVE','OPERATOR-SUPPLIED FILE',filename,'directly to this external conversation','does not upload or transfer these files automatically','does not need to upload the original file into the application first','return BLOCKED with MISSING_ARTIFACT','do not produce a complete Stage 04 requirement set without inspecting the actual supplied file'])if(!prompt.includes(token))throw new Error('Stage 04 direct handoff prompt is missing: '+token);
  for(const forbidden of ['REQUIRED INPUT FILES NOT READY','add and application-verify these exact bytes before this instruction may be executed'])if(prompt.includes(forbidden))throw new Error('Stage 04 prompt incorrectly requires prior application file custody: '+forbidden);
  if(!record.contextManifest.executionHandoff?.send?.some(x=>x.filename===filename&&x.applicationVerified===false))throw new Error('Stage 04 handoff is not bound into the prompt context manifest.');
  const changed=baseProject();changed.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:filename+' REV B'}]);const replacement=prompts.buildPromptRecord(4,changed,{operation:'COMPLETE'});
  if(replacement.contextSignature===record.contextSignature)throw new Error('Changing the Stage 04 outgoing file did not change prompt context identity.');
}
`;
  if(text.includes('Stage 04 prompt carries the exact direct-to-agent handoff'))throw new Error('Stage 04 prompt test already exists.');
  text+=block;
  write(path,text);
}

// Mobile browser proof: notice is before the prompt, file upload remains later and optional for outgoing transfer, and long names wrap.
{
  const path='verify-browser.mjs';
  let text=read(path);
  const marker=" // Malformed import does not destroy projects.";
  const block=` // Stage 04 tells the operator to attach the original supplied file directly to the external conversation; it does not force a pre-prompt app upload.
 const stage4Filename='MAINFRAME_INVENTION_DISCLOSURE_COUNSEL_READY_LOGIC_CLEAN_2_WITH_A_VERY_LONG_OPERATOR_VISIBLE_NAME';
 await click(cdp,'#new-project');await waitExpr(cdp,\`Boolean(document.querySelector('[data-job="SUPPLIED_MATERIALS_INVENTORY"]'))\`);
 await fill(cdp,'[data-job="SUPPLIED_MATERIALS_INVENTORY"]',JSON.stringify([{type:'FILE',exactNameOrReference:stage4Filename}]));await click(cdp,'#save-job');await openStage(cdp,4);
 for(const width of [320,393]){await setWidth(cdp,width);const stage4=await snapshot(cdp);for(const token of ['Send with this instruction','Attach before sending',stage4Filename,'No app upload required.','directly to the external agent conversation','does not upload or transfer files automatically'])assert(stage4.text.includes(token),\`Stage 04 outgoing handoff missing \${token} at \${width}px.\`);assert(stage4.scrollWidth<=width+1&&stage4.bodyScrollWidth<=width+1,\`Stage 04 handoff overflows at \${width}px.\`);const order=await evalValue(cdp,\`(()=>{const handoff=document.querySelector('#outgoing-handoff'),prompt=document.querySelector('#prompt-heading'),file=document.querySelector('#stage-files');return {handoffBeforePrompt:Boolean(handoff&&prompt&&(handoff.compareDocumentPosition(prompt)&Node.DOCUMENT_POSITION_FOLLOWING)),promptBeforeFile:Boolean(prompt&&file&&(prompt.compareDocumentPosition(file)&Node.DOCUMENT_POSITION_FOLLOWING)),stageFilesHeading:[...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='Stage files'),promptText:document.querySelector('#generated-prompt')?.innerText||'',saveDisabled:document.querySelector('#save-prompt')?.disabled};})()\`);assert(order.handoffBeforePrompt&&order.promptBeforeFile&&!order.stageFilesHeading,\`Stage 04 reordered the app file control ahead of the prompt: \${JSON.stringify(order)}\`);for(const token of ['FILES YOU MUST RECEIVE','OPERATOR-SUPPLIED FILE',stage4Filename,'does not need to upload the original file into the application first'])assert(order.promptText.includes(token),\`Stage 04 generated prompt missing \${token} at \${width}px.\`);}
 await setWidth(cdp,393);
`;
  text=replaceOnce(text,marker,block+marker,'browser Stage 04 handoff test insertion');
  text=replaceOnce(text,'malformedImportNonDestructive:true,runtimeErrors:0','malformedImportNonDestructive:true,stage4DirectOutgoingHandoff:true,runtimeErrors:0','browser result report');
  write(path,text);
}

console.log('stage4-direct-handoff repair applied');
