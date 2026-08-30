import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, value) => fs.writeFileSync(file, value);
const countExact = (source, token) => source.split(token).length - 1;

function replaceExact(source, oldText, newText, label) {
  const count = countExact(source, oldText);
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(oldText, newText);
}

function replaceRegex(source, expression, replacement, label) {
  const flags = expression.flags.includes('g') ? expression.flags : expression.flags + 'g';
  const matches = source.match(new RegExp(expression.source, flags)) || [];
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one match, found ${matches.length}`);
  return source.replace(expression, () => replacement);
}

function replaceOptionalRegex(source, expression, replacement) {
  return source.replace(expression, () => replacement);
}

function assertNoRuntimePhrase(file, source, phrase) {
  const index = source.indexOf(phrase);
  if (index < 0) return;
  const start = Math.max(0, index - 180);
  const end = Math.min(source.length, index + phrase.length + 180);
  throw new Error(`${file} still contains prohibited Stage 04 file-reuse language: ${source.slice(start, end)}`);
}

// prompt-engine.js: capture supplied meaning once, make Stage 03 exhaustive, and make Stage 04 canonical-only.
{
  const file = 'prompt-engine.js';
  let source = read(file);
  source = replaceExact(source, "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/24';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/25';", 'prompt engine version');

  source = replaceExact(
    source,
    "function humanInputBlock(job){\n const definitions=schema.JOB_FIELDS||{};\n const names=Object.entries(definitions).filter(([,definition])=>definition?.producer==='HUMAN').map(([name])=>name);\n return names.length?names.map(name=>`${name}:\\n${show(job?.[name])}`).join('\\n\\n'):'NONE';\n}",
    "function humanInputBlock(job,{stage=null}={}){\n const definitions=schema.JOB_FIELDS||{};\n const names=Object.entries(definitions).filter(([,definition])=>definition?.producer==='HUMAN').map(([name])=>name);\n return names.length?names.map(name=>{const value=Number(stage)>1&&name==='SUPPLIED_MATERIALS_INVENTORY'?'CAPTURED AND ACCOUNTED AT STAGE 01; THE ORIGINAL MATERIAL IS NOT AN AUTHORIZED LATER-STAGE INPUT.':job?.[name];return `${name}:\\n${show(value)}`;}).join('\\n\\n'):'NONE';\n}",
    'stage-aware human input block'
  );
  source = replaceExact(source, '${humanInputBlock(j)}', '${humanInputBlock(j,{stage})}', 'stage-aware human input call');

  source = replaceExact(
    source,
    'If their actual contents are available in the current executing context, read only the minimum portions needed to identify the requested objective or deliverable or to resolve a genuinely Stage-01-blocking ambiguity; do not ask the human to re-enter facts that are already present in those materials.',
    'If their actual contents are available in the current executing context, inspect them completely enough to extract every human-supplied fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue relevant to defining the requested outcome; do not ask the human to re-enter facts that are already present in those materials.',
    'Stage 01 complete extraction rule'
  );
  source = replaceExact(
    source,
    'This limited intake inspection is Stage 01 job-definition work; Stage 02 does not own supplied-project-material inventory; later stages inspect supplied project materials only when they need those materials for their substantive work.',
    'This complete semantic intake inspection is Stage 01 job-definition work; Stage 02 does not own supplied-project-material inventory. The original supplied material must not be requested, attached, sent, reselected, reopened, or reused by any later stage; later stages consume only the accepted canonical Stage 01 intake and application-derived manifests.',
    'Stage 01 later-stage non-reuse rule'
  );
  source = replaceExact(
    source,
    'Supplied project materials remain project input and are inspected later only when the stage performing substantive work actually needs them.',
    'Supplied project materials remain human-authority project input, but their relevant meaning is captured at Stage 01 and later stages consume that canonical capture rather than reusing the original material.',
    'Stage 01 canonical capture rule'
  );

  const stage3 = 'Research only the current accepted Stage 02 independent external source set, source-by-source and pass-by-pass. Account for every current accepted Stage 02 source and every materially relevant portion; no source or applicable finding may disappear. Examine exact portions and separately capture facts, mandatory obligations, recommendations, optional practices, examples, explanatory material, prohibitions, exceptions, dependencies, applicability facts, restrictions, invalidating material, conflicts, superseded guidance, source evidence, candidate requirement proposals, and unresolved questions. For each source, explicitly establish complete current research coverage or an evidence-supported no-applicable-obligation disposition. Use response-local references rather than assigning canonical requirement identities. Do not treat the target product, this operating application, repository source code, prior implementations, project-generated artifacts, or current UI behavior as independent requirement authority. Repeat discovery passes until saturation is actually supported by the evidence.';
  source = replaceRegex(source, /3:'Research only the current accepted Stage 02[\s\S]*?',\n4:/, `3:${JSON.stringify(stage3)},\n4:`, 'Stage 03 exhaustive procedure');

  const stage4 = 'Compile atomic requirement proposals for this current job only from the canonical User Job Input, the accepted Stage 01 canonical intake, and legitimately applicable accepted Stage 03 external-source research supplied in this prompt. The original human-supplied intent file or other intake material must not be requested, consumed, attached, sent, reselected, reopened, or reused at Stage 04 or any later stage. Do not ask the human to provide it again. Treat the application-supplied canonical intake and accepted research as the complete Stage 04 input universe. Account for every supplied obligation: map it to one or more atomic requirements, retain it as nonnormative context, mark it inapplicable with reason, or block it with reason. No obligation may disappear. A supplied project statement is human-authority input, not automatically independent external authority. Each proposed requirement must express one independently testable obligation where possible and record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, and notes. The application assigns REQ_ID and controlled requirement-set identity after validated ingestion. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.';
  source = replaceRegex(source, /4:'Compile atomic requirement proposals[\s\S]*?',\n5:/, `4:${JSON.stringify(stage4)},\n5:`, 'Stage 04 canonical-only procedure');

  source = replaceExact(
    source,
    "function contextFor(stage,state,operation,scope={}){\n const parts=[];",
    "function contextFor(stage,state,operation,scope={}){\n const parts=[];\n if(stage===4){const acceptedStage01=state?.stages?.[1]?.agentData&&Object.keys(state.stages[1].agentData).length?state.stages[1].agentData:state?.stages?.[1]?.acceptedData||{};const canonicalIntake={EXACT_USER_OBJECTIVE_VERBATIM:state?.job?.EXACT_USER_OBJECTIVE_VERBATIM||'',EXACT_DELIVERABLE_REQUESTED:acceptedStage01.EXACT_DELIVERABLE_REQUESTED??state?.job?.EXACT_DELIVERABLE_REQUESTED??'',REQUIRED_OUTPUT_FORMAT:state?.job?.REQUIRED_OUTPUT_FORMAT||'',DEADLINE_OR_TEMPORAL_SCOPE:state?.job?.DEADLINE_OR_TEMPORAL_SCOPE||'',PROHIBITED_ACTIONS:state?.job?.PROHIBITED_ACTIONS||'',EXPLICIT_USER_REQUIREMENTS:state?.job?.EXPLICIT_USER_REQUIREMENTS||'',ASSUMPTIONS:acceptedStage01.ASSUMPTIONS??state?.job?.ASSUMPTIONS??'',UNKNOWN_INFORMATION:acceptedStage01.UNKNOWN_INFORMATION??state?.job?.UNKNOWN_INFORMATION??'',INPUT_SET_CONTENTS:acceptedStage01.INPUT_SET_CONTENTS??state?.job?.INPUT_SET_CONTENTS??''};parts.push('ACCEPTED STAGE 01 CANONICAL INTAKE — ORIGINAL MATERIAL IS NOT REUSED\\n'+show(canonicalIntake));}",
    'Stage 04 canonical intake context'
  );

  source = replaceExact(
    source,
    'INPUT_SET_CONTENTS should identify the top-level supplied human inputs and attached materials available to this job. Do not turn it into a Stage 02 archive/file inventory.',
    'INPUT_SET_CONTENTS must preserve every semantically relevant human-supplied statement extracted from the complete controlled input while avoiding a useless archive tree or byte-level file inventory. It is the canonical later-stage intake representation; later stages must not reopen or request the original material.',
    'Stage 01 canonical INPUT_SET_CONTENTS rule'
  );
  source = replaceExact(
    source,
    'Before Stage 01 submission verify: objective/deliverable defined; supplied materials identified without doing Stage 02 inventory work; every foreseeable human-only item was already supplied, answered conversationally, or explicitly marked unknown/deferred by the human; no later-stage research or drafting was performed; then choose the final response type.',
    'Before Stage 01 submission verify: objective/deliverable defined; every semantically relevant supplied statement is captured in the canonical intake without doing Stage 02 authority research; every foreseeable human-only item was already supplied, answered conversationally, or explicitly marked unknown/deferred by the human; no later-stage research or drafting was performed; then choose the final response type.',
    'Stage 01 completion check'
  );

  source = replaceExact(
    source,
    "${stage===2?`STAGE 02 SOURCE DISCOVERY GUIDANCE",
    "${stage>1?`ORIGINAL INTAKE NON-REUSE RULE\nThe original human-supplied intent/material files were consumed at Stage 01 and are not current-stage transfer inputs. Do not request, attach, send, reselect, reopen, or reuse them. Use the accepted canonical Stage 01 intake. This does not prohibit transfer of new workflow-generated product, test, or evidence artifacts when the current stage explicitly requires those bytes.\n\n`:''}${stage===2?`STAGE 02 SOURCE DISCOVERY GUIDANCE",
    'later-stage original intake non-reuse section'
  );

  const handoffBlock = "${(()=>{const plan=verificationBatchPlan(stage,state,operation,scope),ids=plan?.triples?.map(x=>x.testId),runIds=plan?.triples?.map(x=>x.runId),handoff=workflow.executionHandoff(state,{stage,operation,testIds:ids,runIds});if(!handoff.send.length&&!handoff.withhold.length&&!handoff.expectBack.length)return '';const lines=['EXECUTION / ARTIFACT HANDOFF — APPLICATION DERIVED'];if(handoff.send.length){lines.push('FILES YOU MUST RECEIVE');for(const x of handoff.send)lines.push('- '+x.artifactId+' — '+x.filename+' — SHA-256 '+x.sha256);}if(handoff.withhold.length){lines.push('FILES / CONTEXT YOU MUST NOT RECEIVE');for(const x of handoff.withhold)lines.push('- '+x.artifactIdOrCategory+' — '+x.reason);}if(handoff.expectBack.length){lines.push('FILES / EVIDENCE YOU MUST RETURN');for(const x of handoff.expectBack)lines.push('- '+(x.filenameOrPattern||x.kind)+(x.required?' — REQUIRED':''));}if(handoff.send.length)lines.push('Browser-local custody does not mean these bytes were transferred automatically. The executing environment must actually receive every required file.');return lines.join('\\n')+'\\n\\n';})()}";
  source = replaceRegex(source, /\$\{\(\(\)=>\{const plan=verificationBatchPlan[\s\S]*?\}\)\(\)\}STAGE-SPECIFIC TASK/, handoffBlock + 'STAGE-SPECIFIC TASK', 'remove Stage 04 original-material handoff from prompt');

  source = replaceExact(
    source,
    'const opContract=schema.operationContract(stage,operation);const scope=assertRequiredPromptScope(stage,operation,scopeFor(stage,state,options.scope||{})),feedback=recoveryFeedback(state,stage,operation,scope),batchPlan=verificationBatchPlan(stage,state,operation,scope),handoff=workflow.executionHandoff(state,{stage,operation,testIds:batchPlan?.triples?.map(item=>item.testId),runIds:batchPlan?.triples?.map(item=>item.runId)}),promptHandoff={send:handoff.send,withhold:handoff.withhold,expectBack:handoff.expectBack,conversationMaterials:handoff.conversationMaterials},contextManifest=',
    'const opContract=schema.operationContract(stage,operation);const scope=assertRequiredPromptScope(stage,operation,scopeFor(stage,state,options.scope||{})),feedback=recoveryFeedback(state,stage,operation,scope),batchPlan=verificationBatchPlan(stage,state,operation,scope),handoff=workflow.executionHandoff(state,{stage,operation,testIds:batchPlan?.triples?.map(item=>item.testId),runIds:batchPlan?.triples?.map(item=>item.runId)}),promptHandoff={send:handoff.send,withhold:handoff.withhold,expectBack:handoff.expectBack,conversationMaterials:[]},contextManifest=',
    'prompt identity excludes original-material handoff'
  );

  source = replaceExact(
    source,
    "${stage===2?'- Stage 02 may contain only genuinely independent external sources appropriate to the job: governing/controlling authority where it exists, otherwise reputable direct evidence. Target-product and repository artifacts are implementation evidence, not independent external authority.\\n':''}${stage===3?'- Stage 03 may research only the accepted Stage 02 independent external source set.\\n':''}- Before substantive work",
    "${stage===2?'- Stage 02 may contain only genuinely independent external sources appropriate to the job: governing/controlling authority where it exists, otherwise reputable direct evidence. Target-product and repository artifacts are implementation evidence, not independent external authority.\\n':''}${stage===3?'- Stage 03 may research only the accepted Stage 02 independent external source set and must account for every current source and every applicable finding.\\n':''}${stage===4?'- Stage 04 must use only the canonical Stage 01 intake and accepted Stage 03 research. It must not request, consume, attach, send, reselect, reopen, or reuse the original supplied material.\\n':''}- Before substantive work",
    'stage-specific Stage 03/04 mandatory response rules'
  );

  for (const phrase of [
    'MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION',
    'These materials are not embedded in the prompt',
    'operator must attach or provide it with this Stage 04 instruction',
    'ask the human to attach or provide the original before final JSON',
    'supplied project materials sent with this Stage 04 instruction'
  ]) assertNoRuntimePhrase(file, source, phrase);
  write(file, source);
}

// workflow-engine.js: Stage 04 has no original-file handoff and no filename-driven next action.
{
  const file = 'workflow-engine.js';
  let source = read(file);
  source = replaceRegex(
    source,
    /  if\(stage===4\)\{\n    const currentInput=[\s\S]*?\n  \}\n  for\(const item of items\)/,
    '  for(const item of items)',
    'remove Stage 04 conversation-material handoff'
  );
  source = replaceRegex(
    source,
    /if\(stage===4\)\{const handoff=executionHandoff[\s\S]*?\}\s*if\(\[23,24\]\.includes\(stage\)\)/,
    "if(stage===4)return 'Use the current Stage 04 instruction. The application supplies the accepted canonical Stage 01 intake and current Stage 03 research; no original intake file is required or used. When the agent finishes, paste its final JSON response here.';if([23,24].includes(stage))",
    'Stage 04 canonical next action'
  );
  for (const phrase of [
    'Attach or provide the original material with the Stage 04 instruction.',
    'Provide this reference with the Stage 04 instruction.',
    'Send the Stage 04 instruction with ',
    'The prompt does not include those materials.'
  ]) assertNoRuntimePhrase(file, source, phrase);
  write(file, source);
}

// app-core.js: remove the visible reattachment demand shown on the phone UI.
{
  const file = 'app-core.js';
  let source = read(file);
  const oldBranch = "if(n===4){const materials=safe(engine.executionHandoff(current,{stage:4,operation:selectedOperation(4)}).conversationMaterials).map(item=>String(item.label||'').trim()).filter(Boolean);if(materials.length)return `<div class=\"notice\"><strong>Send the Stage 04 instruction with the required material.</strong><br>Attach or provide with the instruction: ${esc(materials.join(', '))}. The prompt does not include those materials. When the agent finishes, paste only its final JSON response here.</div>`;}";
  const newBranch = "if(n===4)return `<div class=\"notice\"><strong>The agent should now return one final JSON response.</strong><br>The current Stage 04 instruction contains the accepted canonical intake and research context. No original intake file is required or used. Paste only the final JSON below.</div>`;";
  source = replaceExact(source, oldBranch, newBranch, 'Stage 04 interaction mode');
  source = replaceOptionalRegex(
    source,
    /The agent compiles the requirement specification[\s\S]{0,700}?no duplicate upload into this application is required\./,
    'The agent compiles the requirement specification from the accepted canonical Stage 01 intake and current Stage 03 research. The original intake material is not used again.'
  );
  source = replaceOptionalRegex(
    source,
    /Keep the work in the external conversation[\s\S]{0,350}?no duplicate upload into this application is required\./,
    'Use the accepted canonical intake already supplied by the application. The original intake material is not used again.'
  );
  for (const phrase of [
    'Send the Stage 04 instruction with the required material.',
    'Attach or provide with the instruction:',
    'The prompt does not include those materials.',
    'Keep the work in the external conversation that has the original material',
    'no duplicate upload into this application is required'
  ]) assertNoRuntimePhrase(file, source, phrase);
  write(file, source);
}

// Shared cache identity: force mobile browsers to load the corrected runtime bytes.
{
  const file = 'index.html';
  let source = read(file);
  source = replaceRegex(source, /runtime-bec66cf2784e2a2b/g, 'runtime-stage-input-once-20260830a', 'shared runtime build token');
  write(file, source);
}

// Invert the old unit regression that deliberately required Stage 04 reattachment.
{
  const file = 'verify-complete.mjs';
  let source = read(file);
  source = replaceExact(source,
    "assert(handoff.conversationMaterials.length===1&&handoff.conversationMaterials[0].label==='design-input.pdf','Stage 04 did not derive the material that must accompany its instruction.');",
    "assert(handoff.conversationMaterials.length===0,'Stage 04 attempted to route the original intake material into a later conversation.');",
    'verify-complete Stage 04 handoff assertion');
  source = replaceExact(source,
    "assert(next.includes('Send the Stage 04 instruction with design-input.pdf'),'Stage 04 next action does not identify the exact material to send with the prompt.');\n  assert(next.includes('The prompt does not include those materials'),'Stage 04 next action does not explain that copying the prompt does not transfer the file.');",
    "assert(!next.includes('design-input.pdf')&&!/attach|provide|send the Stage 04 instruction with/i.test(next),'Stage 04 next action still requests reuse of the original intake file.');\n  assert(next.includes('no original intake file is required or used'),'Stage 04 next action does not state the one-time intake invariant.');",
    'verify-complete Stage 04 next action');
  source = replaceExact(source,
    "assert(appSource.includes('Send the Stage 04 instruction with the required material.'),'Stage 04 UI does not use the existing interaction notice for the concise handoff instruction.');",
    "assert(!appSource.includes('Send the Stage 04 instruction with the required material.')&&appSource.includes('No original intake file is required or used.'),'Stage 04 UI still requests the original intake material or omits the one-time intake rule.');",
    'verify-complete Stage 04 UI assertion');
  source = source.replaceAll('stage04PromptMaterialHandoff:true', 'stage04CanonicalIntakeOnly:true');
  write(file, source);
}

// Replace the prompt regression that formerly required the original file to be sent again.
{
  const file = 'verify-prompt-semantics.mjs';
  let source = read(file);
  const replacement = `// stage04-canonical-intake-only-regression\n{\n  const p=baseProject();\n  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]);\n  p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Canonical deliverable sentinel',ASSUMPTIONS:'Canonical assumptions sentinel',UNKNOWN_INFORMATION:'Canonical unknown sentinel',INPUT_SET_CONTENTS:'Canonical intake content sentinel'};\n  p.stages[1].acceptedData={...p.stages[1].agentData};\n  const scope={inputVersion:p.job.CURRENT_INPUT_VERSION,sourceSetVersion:p.job.CURRENT_SOURCE_SET_VERSION};\n  p.projectData.sources.push({id:'SOURCE-STAGE04',stage:2,active:true,scope,fields:{SOURCE_ID:'SOURCE-STAGE04',TITLE:'Controlling source'}});\n  p.projectData.research.push({id:'RESEARCH-STAGE04',stage:3,active:true,scope,fields:{RESEARCH_ID:'RESEARCH-STAGE04',SOURCE_ID:'SOURCE-STAGE04',MANDATORY_STATEMENTS:'Stage 03 research sentinel',FINDING_CLASSIFICATION:'MANDATORY',SOURCE_EVIDENCE:'evidence'}});\n  p.projectData.candidateRequirements.push({id:'CANDIDATE-STAGE04',stage:3,active:true,scope,fields:{CANDIDATE_REQ_ID:'CANDIDATE-STAGE04',SOURCE_ID:'SOURCE-STAGE04',CANDIDATE_OBLIGATION:'Stage 03 obligation sentinel',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',EVIDENCE:'evidence',STATUS:'ACTIVE'}});\n  const record=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});\n  for(const token of ['ACCEPTED STAGE 01 CANONICAL INTAKE — ORIGINAL MATERIAL IS NOT REUSED','Canonical intake content sentinel','Stage 03 research sentinel','Stage 03 obligation sentinel','no original intake file is required or used'])if(!record.prompt.includes(token))throw new Error('Stage 04 canonical intake context missing: '+token);\n  for(const prohibited of ['MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION','These materials are not embedded in the prompt','Attach or provide them in the agent conversation','ask the human to attach or provide the original','design-input.pdf'])if(record.prompt.includes(prohibited))throw new Error('Stage 04 still requests or exposes original-file reuse: '+prohibited);\n  if(record.contextManifest.executionHandoff?.conversationMaterials?.length)throw new Error('Stage 04 original material is still bound as a conversation handoff.');\n}\nconsole.log(JSON.stringify({stage04CanonicalIntakeOnly:true}));`;
  source = replaceRegex(source, /\/\/ stage04-stage-prompt-material-regression-v3[\s\S]*?console\.log\(JSON\.stringify\(\{stage04PromptMaterialHandoff:true\}\)\);/, replacement, 'replace Stage 04 prompt handoff regression');
  write(file, source);
}

// Replace the browser acceptance that visibly required the file again.
{
  const file = 'verify-browser.mjs';
  let source = read(file);
  const replacement = `await click(cdp,'[data-view="Project"]');await fill(cdp,'[data-job="SUPPLIED_MATERIALS_INVENTORY"]',JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]));await click(cdp,'#save-job');await waitExpr(cdp,\`(async()=>{const p=await globalThis.closedLoopProjectStore.readAll();return p.some(x=>x.job?.JOB_ID==='\${newest.job.JOB_ID}'&&String(x.job?.SUPPLIED_MATERIALS_INVENTORY||'').includes('design-input.pdf'));})()\`,12000);await openStage(cdp,4);await setWidth(cdp,320);const stage04Snapshot=await snapshot(cdp);for(const token of ['No original intake file is required or used.','The current Stage 04 instruction contains the accepted canonical intake and research context.','When the agent finishes, paste its final JSON response here.','ORIGINAL INTAKE NON-REUSE RULE','ACCEPTED STAGE 01 CANONICAL INTAKE — ORIGINAL MATERIAL IS NOT REUSED'])assert(stage04Snapshot.text.includes(token),\`Stage 04 canonical-intake UX missing \${token}.\`);for(const prohibited of ['Send the Stage 04 instruction with the required material.','Attach or provide with the instruction: design-input.pdf.','The prompt does not include those materials.','MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION','Do not assume access to any earlier stage conversation'])assert(!stage04Snapshot.text.includes(prohibited),\`Stage 04 still requests original-file reuse: \${prohibited}\`);const stage04Layout=await evalValue(cdp,\`(()=>({extraPanel:Boolean(document.querySelector('#stage04-material-handoff')),optionalCustody:Boolean(document.querySelector('#stage04-optional-custody')),overflow:document.documentElement.scrollWidth>innerWidth+1}))()\`);assert(stage04Layout&&!stage04Layout.extraPanel&&!stage04Layout.optionalCustody&&!stage04Layout.overflow,\`Stage 04 canonical-intake UI is duplicated or overflows at 320px: \${JSON.stringify(stage04Layout)}\`);await setWidth(cdp,393);`;
  source = replaceRegex(source, /await click\(cdp,'\[data-view="Project"\]'\);await fill\(cdp,'\[data-job="SUPPLIED_MATERIALS_INVENTORY"\]'[\s\S]*?await setWidth\(cdp,393\);/, replacement, 'replace browser Stage 04 reattachment acceptance');
  write(file, source);
}

// Permanent focused regression.
{
  const file = 'verify-stage-input-once.mjs';
  const content = `import fs from 'node:fs';\nimport vm from 'node:vm';\n\nglobalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};\nglobalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);\nfor(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});\nconst core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;\nconst assert=(value,message)=>{if(!value)throw new Error(message);};\nconst p=core.createBlankState('JOB-STAGE-INPUT-ONCE');\nObject.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested product from all supplied information.',SUPPLIED_MATERIALS_INVENTORY:JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]),EXPLICIT_USER_REQUIREMENTS:'Human requirement sentinel',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'});\np.revision=7;p.activeStage=4;engine.ensureShape(p);\np.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Canonical deliverable sentinel',ASSUMPTIONS:'Canonical assumptions sentinel',UNKNOWN_INFORMATION:'Canonical unresolved sentinel',INPUT_SET_CONTENTS:'Canonical intake content sentinel'};\np.stages[1].acceptedData={...p.stages[1].agentData};\nconst scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'};\np.projectData.sources.push({id:'SOURCE-ONCE',stage:2,active:true,scope,fields:{SOURCE_ID:'SOURCE-ONCE',TITLE:'Source'}});\np.projectData.research.push({id:'RESEARCH-ONCE',stage:3,active:true,scope,fields:{RESEARCH_ID:'RESEARCH-ONCE',SOURCE_ID:'SOURCE-ONCE',MANDATORY_STATEMENTS:'External research statement sentinel',FINDING_CLASSIFICATION:'MANDATORY',SOURCE_EVIDENCE:'evidence'}});\np.projectData.candidateRequirements.push({id:'CANDIDATE-ONCE',stage:3,active:true,scope,fields:{CANDIDATE_REQ_ID:'CANDIDATE-ONCE',SOURCE_ID:'SOURCE-ONCE',CANDIDATE_OBLIGATION:'External obligation sentinel',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',EVIDENCE:'evidence',STATUS:'ACTIVE'}});\nconst prompt=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});\nfor(const required of ['Canonical intake content sentinel','Human requirement sentinel','External research statement sentinel','External obligation sentinel','ORIGINAL INTAKE NON-REUSE RULE'])assert(prompt.prompt.includes(required),'Stage 04 omitted canonical data: '+required);\nfor(const prohibited of ['design-input.pdf','MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION','These materials are not embedded in the prompt','Attach or provide them in the agent conversation','ask the human to attach or provide the original'])assert(!prompt.prompt.includes(prohibited),'Stage 04 reused original intake material: '+prohibited);\nconst handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});\nassert(handoff.conversationMaterials.length===0,'Stage 04 created an original-material conversation handoff.');\nassert(handoff.send.length===0,'Stage 04 created a byte handoff for the original intake file.');\nconst next=engine.operationalNextAction(p,4);\nassert(next.includes('no original intake file is required or used'),'Stage 04 next action omits the one-time intake rule.');\nassert(!next.includes('design-input.pdf')&&!/attach|provide the original|send the Stage 04 instruction with/i.test(next),'Stage 04 next action requests original-file reuse.');\nassert(prompts.procedures[1].includes('extract every human-supplied fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue'),'Stage 01 is not configured for complete supplied-information extraction.');\nassert(prompts.procedures[3].includes('Account for every current accepted Stage 02 source and every materially relevant portion'),'Stage 03 is not configured for complete source coverage.');\nassert(prompts.procedures[4].includes('must not be requested, consumed, attached, sent, reselected, reopened, or reused'),'Stage 04 does not prohibit original-file reuse.');\nconst app=fs.readFileSync('app-core.js','utf8');\nfor(const prohibited of ['Send the Stage 04 instruction with the required material.','Attach or provide with the instruction:','The prompt does not include those materials.','no duplicate upload into this application is required'])assert(!app.includes(prohibited),'Visible Stage 04 UI still requests original-file reuse: '+prohibited);\nassert(app.includes('No original intake file is required or used.'),'Visible Stage 04 UI omits the one-time intake rule.');\nconsole.log('verify-stage-input-once: PASS');\n`;
  write(file, content);
}

// Execute the permanent regression in CI and deployment proof.
{
  const file = '.github/workflows/pages.yml';
  let source = read(file);
  source = replaceExact(source,
    '          node --check verify-prompt-semantics.mjs\n          node --check verify-live.mjs',
    '          node --check verify-prompt-semantics.mjs\n          node --check verify-stage-input-once.mjs\n          node --check verify-live.mjs',
    'pages syntax check');
  source = replaceExact(source,
    '      - name: Reject semantic prompt contradictions and operation leakage\n        run: node verify-prompt-semantics.mjs\n      - name: Prove semantic false-acceptance invariant',
    '      - name: Reject semantic prompt contradictions and operation leakage\n        run: node verify-prompt-semantics.mjs\n      - name: Prove one-time intake and prohibit original-file reuse after Stage 01\n        run: node verify-stage-input-once.mjs\n      - name: Prove semantic false-acceptance invariant',
    'pages focused intake regression step');
  source = replaceExact(source,
    'node verify-full-cycle.mjs && node verify-prompt-semantics.mjs && node verify-semantic-invariant.mjs',
    'node verify-full-cycle.mjs && node verify-prompt-semantics.mjs && node verify-stage-input-once.mjs && node verify-semantic-invariant.mjs',
    'deploy focused intake regression');
  write(file, source);
}

// Documentation must not instruct the obsolete handoff.
{
  const file = 'README.md';
  let source = read(file);
  source = source.replaceAll('MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION', 'CANONICAL STAGE 01 INTAKE USED BY STAGE 04');
  source = source.replaceAll('Attach or provide the original material with the Stage 04 instruction.', 'Stage 04 uses the accepted canonical Stage 01 intake; the original material is not reused.');
  source = source.replaceAll('The prompt does not include those materials.', 'The prompt contains the accepted canonical intake required for Stage 04.');
  write(file, source);
}

// Final source-level fail-closed check.
for (const file of ['prompt-engine.js','workflow-engine.js','app-core.js']) {
  const source = read(file);
  for (const phrase of [
    'MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION',
    'Send the Stage 04 instruction with the required material.',
    'Attach or provide with the instruction:',
    'The prompt does not include those materials.',
    'ask the human to attach or provide the original before final JSON'
  ]) assertNoRuntimePhrase(file, source, phrase);
}

console.log(JSON.stringify({stage01CompleteExtraction:true,stage03CompleteCoverage:true,stage04CanonicalIntakeOnly:true,originalIntakeFileReuse:false}, null, 2));
