import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const write=(file,value)=>fs.writeFileSync(file,value);
const countExact=(source,token)=>source.split(token).length-1;
function replaceExact(source,oldText,newText,label){const count=countExact(source,oldText);if(count!==1)throw new Error(`${label}: expected exactly one match, found ${count}`);return source.replace(oldText,newText);}
function replaceRegex(source,expression,replacement,label){const flags=expression.flags.includes('g')?expression.flags:expression.flags+'g';const matches=source.match(new RegExp(expression.source,flags))||[];if(matches.length!==1)throw new Error(`${label}: expected exactly one match, found ${matches.length}`);return source.replace(expression,()=>replacement);}
function quoteSingle(text){return `'${String(text).replaceAll('\\','\\\\').replaceAll("'","\\'").replaceAll('\n','\\n')}'`;}
function assertAbsent(file,source,phrases){for(const phrase of phrases)if(source.includes(phrase))throw new Error(`${file} still contains prohibited runtime text: ${phrase}`);}

{
  const file='prompt-engine.js';
  let source=read(file);
  source=replaceExact(source,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/25';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/26';",'prompt engine version');
  source=replaceExact(source,
`function humanInputBlock(job){
 const definitions=schema.JOB_FIELDS||{};
 const names=Object.entries(definitions).filter(([,definition])=>definition?.producer==='HUMAN').map(([name])=>name);
 return names.length?names.map(name=>\`${'${name}'}:\\n${'${show(job?.[name])}'}\`).join('\\n\\n'):'NONE';
}`,
`function humanInputBlock(job,{stage=null}={}){
 const definitions=schema.JOB_FIELDS||{};
 const names=Object.entries(definitions).filter(([,definition])=>definition?.producer==='HUMAN').map(([name])=>name);
 return names.length?names.map(name=>{const value=Number(stage)>1&&name==='SUPPLIED_MATERIALS_INVENTORY'?'CAPTURED AND ACCOUNTED AT STAGE 01; THE ORIGINAL MATERIAL IS NOT AN AUTHORIZED LATER-STAGE INPUT.':job?.[name];return \`${'${name}'}:\\n${'${show(value)}'}\`;}).join('\\n\\n'):'NONE';
}`,'stage-aware human input projection');
  source=replaceExact(source,'${humanInputBlock(j)}','${humanInputBlock(j,{stage})}','stage-aware human input use');
  source=replaceExact(source,
'If their actual contents are available in the current executing context, read only the minimum portions needed to identify the requested objective or deliverable or to resolve a genuinely Stage-01-blocking ambiguity; do not ask the human to re-enter facts that are already present in those materials.',
'If their actual contents are available in the current executing context, inspect them completely enough to extract every human-supplied fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue relevant to defining the requested outcome; do not ask the human to re-enter facts that are already present in those materials.',
'Stage 01 complete extraction');
  source=replaceExact(source,
'This limited intake inspection is Stage 01 job-definition work; Stage 02 does not own supplied-project-material inventory. Capture every material human-authority statement that is actually available and relevant to the job definition in the accepted Stage 01 job definition so later stages can consume it canonically. Later stages must not ask the human to attach, resend, retype, or summarize the same intent material merely because they run in a different conversation.',
'This complete meaning-preserving intake inspection is Stage 01 job-definition work; Stage 02 does not own supplied-project-material inventory. Capture every materially relevant human-authority statement in the accepted Stage 01 job definition. The original supplied material must not be requested, consumed, attached, sent, reselected, reopened, or reused by any later stage; later stages consume only the accepted canonical Stage 01 intake and application-derived manifests.',
'Stage 01 one-time intake boundary');
  source=replaceExact(source,
'Supplied project materials remain project input and are inspected later only when the stage performing substantive work actually needs them.',
'Supplied project materials remain human-authority project input, but their relevant meaning is captured at Stage 01 and later stages consume that canonical capture rather than reopening or reusing the original material.',
'Stage 01 canonical capture');
  source=replaceExact(source,
'Stage 01 does not require every fact needed to execute later stages.',
'Stage 01 must capture every materially relevant human-authority statement currently supplied; facts that genuinely require later research may remain identified as later-resolvable.',
'Stage 01 completeness statement');

  const stage3='Research only the current accepted Stage 02 independent external source set, source-by-source and pass-by-pass. Account for every current accepted Stage 02 source and every materially relevant portion; no source or applicable finding may disappear. Examine exact portions and separately capture facts, mandatory obligations, recommendations, optional practices, examples, explanatory material, prohibitions, exceptions, dependencies, applicability facts, restrictions, invalidating material, conflicts, superseded guidance, source evidence, candidate requirement proposals, and unresolved questions. For each source, explicitly establish complete current research coverage or an evidence-supported no-applicable-obligation disposition. Use response-local references rather than assigning canonical requirement identities. Do not treat the target product, this operating application, repository source code, prior implementations, project-generated artifacts, or current UI behavior as independent requirement authority. Repeat discovery passes until saturation is actually supported by the evidence.';
  source=replaceRegex(source,/3:'Research only the current accepted Stage 02[\s\S]*?',\n4:/,`3:${quoteSingle(stage3)},\n4:`,'Stage 03 complete source accounting');

  const stage4='Compile atomic requirement proposals for this current job only from the complete current canonical input union selected and supplied by the application: current User Job Input, the accepted Stage 01 canonical intake, human-origin obligations already captured from supplied material, accepted Stage 03 source research, candidate external-source obligations, and applicable provenance. The original human-supplied intent file or other intake material must not be requested, consumed, attached, sent, reselected, reopened, or reused at Stage 04 or any later stage. Do not ask the human to provide it again. The application must create and provide the obligation universe before this stage; do not rediscover an unspecified input universe. For every application-enumerated obligation, provide one or more atomic requirement proposals or an explicit retained-nonnormative-context, inapplicable-with-reason, or blocked-with-reason disposition. No obligation may disappear, and every original obligation identity must remain independently traceable. A supplied project statement is human-authority input, not automatically independent external authority. Each proposed requirement should express one independently testable obligation where possible and record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, and notes. If required canonical prior-stage information is missing, return BLOCKED with MISSING_APPLICATION_CONTEXT or INADEQUATE_PRIOR_OUTPUT and identify the responsible earlier stage; never turn an earlier-stage capture defect into another request for the original material. The application assigns REQ_ID, versions, hashes, counts, scope, and accounting closure after validated ingestion. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.';
  source=replaceRegex(source,/4:'Compile atomic requirement proposals[\s\S]*?',\n5:/,`4:${quoteSingle(stage4)},\n5:`,'Stage 04 canonical-only obligation accounting');

  source=replaceExact(source,
'INPUT_SET_CONTENTS should identify the top-level supplied human inputs and attached materials available to this job. Do not turn it into a Stage 02 archive/file inventory. UNKNOWN_INFORMATION should carry nonblocking later-needed facts. ASSUMPTIONS must contain only assumptions, not unknowns or application-derived identity facts.',
'INPUT_SET_CONTENTS must preserve every materially relevant human-supplied statement extracted from the controlled input. It is the canonical later-stage intake representation; later stages must not reopen, request, or reuse the original material. Do not turn it into a Stage 02 archive/file inventory. UNKNOWN_INFORMATION should carry nonblocking later-needed facts. ASSUMPTIONS must contain only assumptions, not unknowns or application-derived identity facts.',
'Stage 01 canonical input-set guidance');
  source=replaceExact(source,
'Before Stage 01 submission verify: objective/deliverable defined; supplied materials identified without doing Stage 02 inventory work; every foreseeable human-only item was already supplied, answered conversationally, or explicitly marked unknown/deferred by the human; no later-stage research or drafting was performed; then choose the final response type.',
'Before Stage 01 submission verify: objective/deliverable defined; every materially relevant supplied human-authority statement was captured without doing Stage 02 authority research or archive inventory; every foreseeable human-only item was already supplied, answered conversationally, or explicitly marked unknown/deferred by the human; no later-stage research or drafting was performed; then choose the final response type.',
'Stage 01 completion checklist');

  source=replaceExact(source,
"${stage===2?`STAGE 02 SOURCE DISCOVERY GUIDANCE",
"${stage>1?`ORIGINAL INTAKE NON-REUSE RULE\nThe original human-supplied intent and intake materials were consumed at Stage 01 and are not current-stage transfer inputs. Do not request, consume, attach, send, reselect, reopen, or reuse them. Use only the accepted canonical Stage 01 intake. This does not prohibit transfer of new workflow-generated product, test, or evidence artifacts when the current stage explicitly requires those bytes.\n\n`:''}${stage===2?`STAGE 02 SOURCE DISCOVERY GUIDANCE",
'later-stage original-intake non-reuse rule');
  source=replaceExact(source,
"${stage===3?'- Stage 03 may research only the accepted Stage 02 independent external source set.\\n':''}",
"${stage===3?'- Stage 03 may research only the accepted Stage 02 independent external source set and must account for every current source and every materially relevant portion.\\n':''}",
'Stage 03 mandatory coverage rule');
  source=replaceExact(source,
"${stage===4?'- Stage 04 consumes the application-selected canonical input union. Do not ask the human to attach or resend the original intent file. Missing canonical prior-stage content is an earlier-stage defect, not a new file-transfer request.\\n':''}",
"${stage===4?'- Stage 04 consumes only the application-selected canonical input union. The original intent or intake material must not be requested, consumed, attached, sent, reselected, reopened, or reused. Missing canonical prior-stage content is an earlier-stage defect, not a new file-transfer request. Every application-enumerated obligation must receive a valid disposition.\\n':''}",
'Stage 04 mandatory non-reuse and closure rule');

  assertAbsent(file,source,[
    'read only the minimum portions needed to identify the requested objective',
    'This limited intake inspection is Stage 01 job-definition work',
    'Supplied project materials remain project input and are inspected later',
    'Stage 01 does not require every fact needed to execute later stages'
  ]);
  write(file,source);
}

{
  const file='app-core.js';
  let source=read(file);
  source=replaceExact(source,
"4:'The agent compiles the requirement specification from current User Job Input, the accepted Stage 01 job definition, and accepted Stage 03 findings already carried in the current instruction. Do not attach or resend the original intent file. If canonical prior-stage information is incomplete, return to the responsible earlier stage instead of asking the user for the same material again.'",
"4:'Stage 04 uses only the accepted canonical Stage 01 intake and current Stage 03 research. No original intake file is required, requested, or used. If canonical prior-stage information is incomplete, return to the responsible earlier stage instead of asking the user for the same material again.'",
'Stage 04 visible purpose');
  const interaction=/if\(requests\.length\|\|n===1&&!current\.stages\[1\]\.responseDraft\)return `([^`]*)`;return `([^`]*)`;\}/;
  const match=source.match(interaction);if(!match)throw new Error('Stage interaction tail was not found.');
  source=source.replace(interaction,()=>`if(requests.length||n===1&&!current.stages[1].responseDraft)return \`${match[1]}\`;if(n===4)return \`<div class="notice"><strong>The agent should now return one final JSON response.</strong><br>The current Stage 04 instruction contains the accepted canonical intake and current research context. No original intake file is required, requested, or used. Paste only the final JSON below.</div>\`;return \`${match[2]}\`;}`);
  assertAbsent(file,source,[
    'Send the Stage 04 instruction with the required material.',
    'Attach or provide with the instruction:',
    'The prompt does not include those materials.',
    'Keep the work in the external conversation that has the original material'
  ]);
  write(file,source);
}

{
  const file='index.html';
  let source=read(file),old='runtime-866c62b3484bca56',next='runtime-stage-input-once-20260830b';
  const count=countExact(source,old);if(count!==8)throw new Error(`runtime cache token: expected 8 matches, found ${count}`);
  source=source.replaceAll(old,next);write(file,source);
}

{
  const file='verify-mobile-stage-action.mjs';
  let source=read(file);
  const replacement=`await openStage(cdp,4);\n  for(const width of [320,393]){\n    await setWidth(cdp,width);\n    const state=await evaluate(cdp,\`(()=>{const filename=${'${JSON.stringify(filename)}'},strip=document.querySelector('.stage-hero>.stage-action-strip'),spans=[...strip?.querySelectorAll(':scope>span')||[]],copy=document.querySelector('#copy-prompt'),hero=document.querySelector('.stage-hero'),prompt=document.querySelector('#generated-prompt'),bodyText=document.body.innerText;const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth};};const offenders=[...document.querySelectorAll('body *')].map(node=>({node,rect:node.getBoundingClientRect()})).filter(({node,rect})=>rect.right>innerWidth+1||rect.left<-1||node.scrollWidth>node.clientWidth+1).slice(0,30).map(({node,rect})=>({tag:node.tagName,id:node.id||'',class:String(node.className||'').slice(0,120),left:rect.left,right:rect.right,width:rect.width,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,text:(node.textContent||'').trim().slice(0,120)}));return {innerWidth,innerHeight,documentScroll:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth,strip:strip&&rect(strip),spans:spans.map(rect),labels:spans.map(node=>getComputedStyle(node,'::before').content),copy:copy&&rect(copy),hero:hero&&rect(hero),prompt:prompt&&rect(prompt),copyDistance:copy&&hero?copy.getBoundingClientRect().bottom-hero.getBoundingClientRect().top:null,filenamePresent:bodyText.includes(filename),canonicalNotice:bodyText.includes('No original intake file is required, requested, or used.'),obsoleteInstruction:/Send the Stage 04 instruction with|The prompt does not include those materials|Attach or provide with the instruction/.test(bodyText),offenders};})()\`);\n    assert(!state.filenamePresent,\`Stage 04 exposed or reused the original intake filename at ${'${width}'}px.\`);\n    assert(state.canonicalNotice,\`Stage 04 one-time-intake notice is missing at ${'${width}'}px.\`);\n    assert(!state.obsoleteInstruction,\`Stage 04 still displays the obsolete reattachment instruction at ${'${width}'}px.\`);\n    assert(state.documentScroll<=width+1&&state.bodyScroll<=width+1,\`Document horizontally overflows at ${'${width}'}px: ${'${JSON.stringify(state)}'}\`);\n    assert(state.strip&&state.spans.length===2&&state.spans.every(rect=>rect.left>=-1&&rect.right<=width+1&&rect.scrollWidth<=rect.clientWidth+1),\`Current state or next action is clipped at ${'${width}'}px: ${'${JSON.stringify(state)}'}\`);\n    assert(state.labels[0].includes('Current state:')&&state.labels[1].includes('Next:'),\`State/action labels are not explicit at ${'${width}'}px: ${'${JSON.stringify(state.labels)}'}\`);\n    assert(state.copy&&state.copy.left>=-1&&state.copy.right<=width+1&&state.copy.height>=44,\`Primary copy action is unusable at ${'${width}'}px: ${'${JSON.stringify(state.copy)}'}\`);\n    assert(state.prompt&&state.prompt.height<=100,\`Collapsed mobile prompt still buries the primary action at ${'${width}'}px: ${'${JSON.stringify(state.prompt)}'}\`);\n    assert(state.copyDistance!==null&&state.copyDistance<=1100,\`Primary copy action is too far below the current action at ${'${width}'}px: ${'${state.copyDistance}'}\`);\n  }\n  console.log(JSON.stringify({mobileStageActionRegression:true,widths:[320,393],originalIntakeFilenameExposed:false,originalIntakeFileReused:false,canonicalIntakeNotice:true,stateAndActionExplicit:true,primaryActionReachable:true,horizontalOverflow:false}));`;
  source=replaceRegex(source,/await openStage\(cdp,4\);[\s\S]*?console\.log\(JSON\.stringify\(\{mobileStageActionRegression:true[\s\S]*?\}\)\);/,replacement,'mobile Stage 04 one-time-intake regression');
  write(file,source);
}

{
  const file='verify-stage-input-once.mjs';
  const content=`import fs from 'node:fs';\nimport vm from 'node:vm';\n\nglobalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};\nglobalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);\nfor(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});\nconst core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;\nconst assert=(value,message)=>{if(!value)throw new Error(message);};\nconst p=core.createBlankState('JOB-STAGE-INPUT-ONCE');\nObject.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested product from all supplied information.',SUPPLIED_MATERIALS_INVENTORY:JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]),EXPLICIT_USER_REQUIREMENTS:'Human requirement sentinel',INPUT_SET_CONTENTS:'Canonical intake content sentinel',EXACT_DELIVERABLE_REQUESTED:'Canonical deliverable sentinel',ASSUMPTIONS:'Canonical assumptions sentinel',UNKNOWN_INFORMATION:'Canonical unresolved sentinel',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'});\np.revision=7;p.activeStage=4;engine.ensureShape(p);\np.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Canonical deliverable sentinel',ASSUMPTIONS:'Canonical assumptions sentinel',UNKNOWN_INFORMATION:'Canonical unresolved sentinel',INPUT_SET_CONTENTS:'Canonical intake content sentinel'};\np.stages[1].acceptedData={...p.stages[1].agentData};\nconst scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'};\nconst record=(id,stage,fields)=>({id,stage,active:true,scope,fields:{...fields},...fields});\np.projectData.sources.push(record('SOURCE-ONCE',2,{SOURCE_ID:'SOURCE-ONCE',TITLE:'Source'}));\np.projectData.research.push(record('RESEARCH-ONCE',3,{RESEARCH_ID:'RESEARCH-ONCE',SOURCE_ID:'SOURCE-ONCE',MANDATORY_STATEMENTS:'External research statement sentinel',FINDING_CLASSIFICATION:'MANDATORY',SOURCE_EVIDENCE:'evidence'}));\np.projectData.candidateRequirements.push(record('CANDIDATE-ONCE',3,{CANDIDATE_REQ_ID:'CANDIDATE-ONCE',SOURCE_ID:'SOURCE-ONCE',CANDIDATE_OBLIGATION:'External obligation sentinel',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',EVIDENCE:'evidence',STATUS:'ACTIVE'}));\nconst prompt=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});\nfor(const required of ['Canonical intake content sentinel','Human requirement sentinel','External research statement sentinel','External obligation sentinel','ORIGINAL INTAKE NON-REUSE RULE'])assert(prompt.prompt.includes(required),'Stage 04 omitted canonical data: '+required);\nfor(const prohibited of ['design-input.pdf','MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION','These materials are not embedded in the prompt','Attach or provide them in the agent conversation','ask the human to attach or provide the original'])assert(!prompt.prompt.includes(prohibited),'Stage 04 reused original intake material: '+prohibited);\nconst manifestHandoff=prompt.contextManifest?.executionHandoff||{};assert(!Array.isArray(manifestHandoff.conversationMaterials)||manifestHandoff.conversationMaterials.length===0,'Prompt identity still binds original intake material as a Stage 04 handoff.');\nconst handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});\nassert(!Array.isArray(handoff.conversationMaterials)||handoff.conversationMaterials.length===0,'Stage 04 created an original-material conversation handoff.');\nassert(!Array.isArray(handoff.send)||handoff.send.length===0,'Stage 04 created a byte handoff for the original intake file.');\nconst next=JSON.stringify(engine.operationalNextAction(p,4));\nassert(!next.includes('design-input.pdf')&&!/attach(?: or provide)? (?:the )?original|provide (?:the )?original|send the Stage 04 instruction with/i.test(next),'Stage 04 next action requests original-file reuse.');\nassert(prompts.procedures[1].includes('extract every human-supplied fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue'),'Stage 01 is not configured for complete supplied-information extraction.');\nassert(prompts.procedures[3].includes('Account for every current accepted Stage 02 source and every materially relevant portion'),'Stage 03 is not configured for complete source coverage.');\nassert(prompts.procedures[4].includes('must not be requested, consumed, attached, sent, reselected, reopened, or reused'),'Stage 04 does not prohibit original-file reuse.');\nconst app=fs.readFileSync('app-core.js','utf8');\nfor(const prohibited of ['Send the Stage 04 instruction with the required material.','Attach or provide with the instruction:','The prompt does not include those materials.','Keep the work in the external conversation that has the original material'])assert(!app.includes(prohibited),'Visible Stage 04 UI still requests original-file reuse: '+prohibited);\nassert(app.includes('No original intake file is required, requested, or used.'),'Visible Stage 04 UI omits the one-time-intake rule.');\nconsole.log('verify-stage-input-once: PASS');\n`;
  write(file,content);
}

{
  const file='verify-complete.mjs';
  let source=read(file);
  const marker="\nconst {execFileSync:runFocusedRegression}=await import('node:child_process');\nrunFocusedRegression(process.execPath,['verify-stage-input-once.mjs'],{stdio:'inherit'});\n";
  if(!source.includes("runFocusedRegression(process.execPath,['verify-stage-input-once.mjs']"))source+=marker;
  write(file,source);
}

for(const file of ['prompt-engine.js','app-core.js'])assertAbsent(file,read(file),[
  'Send the Stage 04 instruction with the required material.',
  'Attach or provide with the instruction:',
  'The prompt does not include those materials.'
]);
console.log(JSON.stringify({stage01CompleteExtraction:true,stage03CompleteCoverage:true,stage04CanonicalIntakeOnly:true,originalIntakeFileReuse:false},null,2));
