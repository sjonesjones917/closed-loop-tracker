from pathlib import Path
import re

# workflow-engine.js: Stage 04 must not derive a recurring transfer demand from a filename.
p=Path('workflow-engine.js')
s=p.read_text()
start=s.index('function suppliedMaterialReferences(project){')
end=s.index('function evidenceChainExplanation', start)
block=s[start:end]
exec_start=block.index('function executionHandoff')
exec_text=block[exec_start:]
exec_text=exec_text.replace(',conversationMaterials=[],optionalApplicationCopies=new Map()', '')
stage4_start=exec_text.index('  if(stage===4){')
stage4_end=exec_text.index('  for(const item of items)', stage4_start)
exec_text=exec_text[:stage4_start]+exec_text[stage4_end:]
exec_text=exec_text.replace(',conversationMaterials,optionalApplicationCopies:[...optionalApplicationCopies.values()]', '')
exec_text=re.sub(r"if\(stage===4\)\{const handoff=executionHandoff\(project,\{stage:4,operation:'COMPLETE'\}\),materials=handoff\.conversationMaterials\.map\(item=>item\.label\);if\(materials\.length\)return 'Send the Stage 04 instruction with '\+materials\.join\(', '\)\+'\. The prompt does not include those materials\. When the agent finishes, paste its final JSON response here\.';\}", '', exec_text)
s=s[:start]+exec_text+s[end:]
structured="if(stage===4){const handoff=executionHandoff(project,{stage:4,operation:'COMPLETE'}),materials=handoff.conversationMaterials.map(item=>item.label);if(materials.length)return actionEnvelope(project,stage,{actionType:'CONTINUE_AGENT_CONVERSATION',heading:'Continue requirement compilation with the agent',explanation:'Send the current Stage 04 instruction with '+materials.join(', ')+'. The application does not imply those materials were transferred automatically. When the agent finishes, return its final JSON.',primaryButton:'Continue conversation',filesToSend:handoff.send,filesToWithhold:handoff.withhold,expectedReturnFiles:handoff.expectBack});}"
if s.count(structured)!=1: raise SystemExit(f'Expected one structured Stage 04 attachment action; found {s.count(structured)}')
s=s.replace(structured,'')
p.write_text(s)

# prompt-engine.js: consume captured canonical input and accepted Stage 01 data instead of re-requesting original material.
p=Path('prompt-engine.js')
s=p.read_text()
old="4:'Compile atomic requirement proposals for this current job from authorized User Job Input, supplied project materials sent with this Stage 04 instruction and actually readable in the executing context, and legitimately applicable Stage 03 external-source research, preserving provenance for each obligation. A supplied project material is human-authority input, not automatically independent external authority. Do not assume access to any file, link, package, or conversation used for an earlier stage. When a listed non-inline material is needed for Stage 04, the operator must attach or provide it with this Stage 04 instruction in the agent conversation where this stage is run. If a required material is not actually available, ask the human conversationally to attach or provide the original before final JSON. Do not ask the human to retype or summarize material merely because you cannot access it, and never infer substantive contents from a filename, path, link label, claimed hash, or metadata. If a required material remains inaccessible, return BLOCKED with the exact MISSING_ARTIFACT or MISSING_INPUT reason rather than fabricating a complete requirement set. Each proposed requirement should express one independently testable obligation where possible and record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, and notes. The application assigns REQ_ID and controlled requirement-set identity after validated ingestion. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.',"
new="4:'Compile atomic requirement proposals for this current job from the complete current application-supplied obligation inputs: current User Job Input, the accepted Stage 01 job definition, and legitimately applicable current Stage 03 source research and candidate obligations. The application has already captured and versioned the human-authority information supplied earlier; do not ask the human to reattach, retype, summarize, or restate an original intent file merely because its filename remains in the supplied-material inventory. A filename or material reference is metadata, not a standing attachment requirement. Use the canonical human input and accepted Stage 01/03 context included in this prompt. Request an external artifact only when the application explicitly identifies a specific unresolved byte-dependent input that is not already represented in current canonical input; never infer such a need from a filename alone. Every input obligation must map to one or more atomic requirements, retained nonnormative context, explicit inapplicability with reason, or a blocker with reason; no obligation may disappear. Each proposed requirement should express one independently testable obligation where possible and record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, and notes. The application assigns REQ_ID and controlled requirement-set identity after validated ingestion. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.',"
if old not in s: raise SystemExit('Stage 04 procedure text not found')
s=s.replace(old,new)
needle="function contextFor(stage,state,operation,scope={}){\n const parts=[];"
replacement="function contextFor(stage,state,operation,scope={}){\n const parts=[];\n if(stage===4&&state?.stages?.[1]){const intake={agentData:state.stages[1].agentData||state.stages[1].acceptedData||{},humanData:state.stages[1].humanData||{},derivedData:state.stages[1].derivedData||{}};parts.push(`ACCEPTED STAGE 01 JOB DEFINITION — CURRENT HUMAN-AUTHORITY CAPTURE\\n${show(intake)}`);}"
if needle not in s: raise SystemExit('contextFor insertion point not found')
s=s.replace(needle,replacement)
old_handoff=",materials=Array.isArray(handoff.conversationMaterials)?handoff.conversationMaterials:[];if(!handoff.send.length&&!handoff.withhold.length&&!handoff.expectBack.length&&!materials.length)return '';const lines=['EXECUTION / ARTIFACT HANDOFF — APPLICATION DERIVED'];if(materials.length){lines.push('MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION');for(const item of materials)lines.push('- '+item.label+' — '+item.type);lines.push('These materials are not embedded in the prompt. Attach or provide them in the agent conversation where this Stage 04 instruction is run. Do not assume access to any earlier stage conversation. If a required material is unavailable, ask the human to attach or provide the original before final JSON. Do not ask the human to retype or summarize its contents. Do not infer contents from a filename, path, link label, claimed hash, or metadata. If required material remains inaccessible, return BLOCKED with the exact missing-item reason.');}if(handoff.send.length)"
new_handoff=";if(!handoff.send.length&&!handoff.withhold.length&&!handoff.expectBack.length)return '';const lines=['EXECUTION / ARTIFACT HANDOFF — APPLICATION DERIVED'];if(handoff.send.length)"
if old_handoff not in s: raise SystemExit('prompt handoff material block not found')
s=s.replace(old_handoff,new_handoff)
s=s.replace(',conversationMaterials:handoff.conversationMaterials','')
p.write_text(s)

# app-core.js: remove Stage 04 attachment-loop notice.
p=Path('app-core.js')
s=p.read_text()
old="if(n===4){const materials=safe(engine.executionHandoff(current,{stage:4,operation:selectedOperation(4)}).conversationMaterials).map(item=>String(item.label||'').trim()).filter(Boolean);if(materials.length)return `<div class=\"notice\"><strong>Send the Stage 04 instruction with the required material.</strong><br>Attach or provide with the instruction: ${esc(materials.join(', '))}. The prompt does not include those materials. When the agent finishes, paste only its final JSON response here.</div>`;}"
if old not in s: raise SystemExit('Stage 04 UI attachment notice not found')
s=s.replace(old,'')
p.write_text(s)

# verify-complete.mjs: replace the regression that incorrectly required repeated attachment.
p=Path('verify-complete.mjs')
s=p.read_text()
start=s.index('// stage04-stage-prompt-material-regression-v3')
end=s.index("console.log(JSON.stringify({stage04PromptMaterialHandoff:true}));",start)+len("console.log(JSON.stringify({stage04PromptMaterialHandoff:true}));")
new="""// stage04-captured-input-regression-v3
{
  const p=project('JOB-STAGE04-CAPTURED-INPUT');
  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]);
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='CAPTURED-HUMAN-INTENT-SENTINEL';
  p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'CAPTURED-STAGE01-DELIVERABLE-SENTINEL',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'design-input.pdf accounted for during intake'};
  const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});
  assert(handoff.send.length===0&&handoff.expectBack.length===0,'Stage 04 filename metadata incorrectly became a file-transfer contract.');
  assert(!Object.prototype.hasOwnProperty.call(handoff,'conversationMaterials'),'Stage 04 still exposes the obsolete filename-derived conversation-material handoff.');
  const next=engine.operationalNextAction(p,4);
  assert(!/design-input\\.pdf|attach|provide the original|send the stage 04 instruction with/i.test(next),'Stage 04 next action still re-requests previously supplied material.');
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(!appSource.includes('Send the Stage 04 instruction with the required material.'),'Stage 04 UI still contains the repeated attachment instruction.');
}
console.log(JSON.stringify({stage04CapturedInputReuse:true}));"""
s=s[:start]+new+s[end:]
p.write_text(s)

# verify-prompt-semantics.mjs: require reuse of captured input and prohibit attachment-loop language.
p=Path('verify-prompt-semantics.mjs')
s=p.read_text()
start=s.index('// stage04-stage-prompt-material-regression-v3')
end=s.index("console.log(JSON.stringify({stage04PromptMaterialHandoff:true}));",start)+len("console.log(JSON.stringify({stage04PromptMaterialHandoff:true}));")
new="""// stage04-captured-input-regression-v3
{
  const p=baseProject();
  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]);
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='CAPTURED-HUMAN-INTENT-SENTINEL';
  p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'CAPTURED-STAGE01-DELIVERABLE-SENTINEL',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'design-input.pdf already represented in controlled input'};
  const first=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
  for(const token of ['CAPTURED-HUMAN-INTENT-SENTINEL','CAPTURED-STAGE01-DELIVERABLE-SENTINEL','ACCEPTED STAGE 01 JOB DEFINITION — CURRENT HUMAN-AUTHORITY CAPTURE'])if(!first.prompt.includes(token))throw new Error('Stage 04 omitted captured canonical input: '+token);
  for(const prohibited of ['MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION','Attach or provide them in the agent conversation','Do not assume access to any earlier stage conversation','ask the human to attach or provide the original before final JSON'])if(first.prompt.includes(prohibited))throw new Error('Stage 04 still re-requests previously supplied material: '+prohibited);
  if(Object.prototype.hasOwnProperty.call(first.contextManifest.executionHandoff||{},'conversationMaterials'))throw new Error('Stage 04 prompt identity still binds the obsolete repeated-attachment handoff.');
  p.projectData.artifacts.push({id:'ARTIFACT-STAGE04-CAPTURED',stage:1,active:true,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION},fields:{ARTIFACT_ID:'ARTIFACT-STAGE04-CAPTURED',FILENAME:'design-input.pdf',BYTE_SIZE:4,SHA256:'b'.repeat(64),ROLE:'SUPPLIED_PROJECT_INPUT',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}});
  const withStoredBytes=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
  if(/MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION|Attach or provide.*design-input\\.pdf/i.test(withStoredBytes.prompt))throw new Error('Stored bytes reintroduced a Stage 04 attachment loop.');
}
console.log(JSON.stringify({stage04CapturedInputReuse:true}));"""
s=s[:start]+new+s[end:]
p.write_text(s)

# verify-browser.mjs: browser must show captured input and no repeated Stage 04 attachment demand.
p=Path('verify-browser.mjs')
s=p.read_text()
match=re.search(r"await click\(cdp,'\[data-view=\"Project\"\]'\);await fill\(cdp,'\[data-job=\"SUPPLIED_MATERIALS_INVENTORY\"\]'.*?await setWidth\(cdp,393\);",s,re.S)
if not match: raise SystemExit('Stage 04 browser regression block not found')
new="""await click(cdp,'[data-view=\"Project\"]');await fill(cdp,'[data-job=\"EXACT_USER_OBJECTIVE_VERBATIM\"]','CAPTURED-HUMAN-INTENT-SENTINEL');await fill(cdp,'[data-job=\"SUPPLIED_MATERIALS_INVENTORY\"]',JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]));await click(cdp,'#save-job');await waitExpr(cdp,`(async()=>{const p=await globalThis.closedLoopProjectStore.readAll();return p.some(x=>x.job?.JOB_ID==='${newest.job.JOB_ID}'&&String(x.job?.SUPPLIED_MATERIALS_INVENTORY||'').includes('design-input.pdf'));})()`,12000);await openStage(cdp,4);await setWidth(cdp,320);const stage04Snapshot=await snapshot(cdp);assert(stage04Snapshot.text.includes('CAPTURED-HUMAN-INTENT-SENTINEL'),'Stage 04 does not reuse captured current human input.');for(const prohibited of ['Send the Stage 04 instruction with the required material.','Attach or provide with the instruction: design-input.pdf.','MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION','Do not assume access to any earlier stage conversation'])assert(!stage04Snapshot.text.includes(prohibited),`Stage 04 still repeats original-material attachment guidance: ${prohibited}`);const stage04Layout=await evalValue(cdp,`(()=>({extraPanel:Boolean(document.querySelector('#stage04-material-handoff')),optionalCustody:Boolean(document.querySelector('#stage04-optional-custody')),overflow:document.documentElement.scrollWidth>innerWidth+1}))()`);assert(stage04Layout&&!stage04Layout.extraPanel&&!stage04Layout.optionalCustody&&!stage04Layout.overflow,`Stage 04 captured-input UX is duplicated or overflows at 320px: ${JSON.stringify(stage04Layout)}`);await setWidth(cdp,393);"""
s=s[:match.start()]+new+s[match.end():]
p.write_text(s)

# verify-test-runtime.mjs: prevent the hidden conversationMaterials escape hatch.
p=Path('verify-test-runtime.mjs')
s=p.read_text()
needle="assert.equal(stage4Handoff.send.length,0,'Stage 04 must not infer an outgoing byte handoff from a filename in supplied-material inventory.');assert.equal(stage4Handoff.withhold.length,0);assert.equal(stage4Handoff.expectBack.length,0);"
if needle not in s: raise SystemExit('Stage 04 runtime regression assertion not found')
s=s.replace(needle,needle+"assert.equal(Object.prototype.hasOwnProperty.call(stage4Handoff,'conversationMaterials'),false,'Stage 04 must not retain a filename-derived conversation-material handoff.');")
p.write_text(s)
